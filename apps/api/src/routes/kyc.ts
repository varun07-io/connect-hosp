import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { z } from "zod";
import { getKycStorageProvider } from "../lib/storage/index.js";
import { recordAudit } from "../lib/audit.js";
import { getNotificationProvider } from "../lib/notifications/index.js";

async function notifyKyc(
  email: string | null | undefined,
  template: string,
  data: Record<string, string>,
) {
  if (!email) return;
  try {
    await getNotificationProvider().send({ channel: "EMAIL", recipient: email, template, data });
  } catch {
    // fire-and-forget — KYC notification failure must not block the response
  }
}

const reviewSchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED"]),
  rejectedReason: z.string().trim().max(1000).optional(),
});

const uploadDocSchema = z.object({
  docType: z.enum(["AADHAAR", "PAN", "VOTER_ID", "PASSPORT", "MCI_CERT", "HOSPITAL_AUTH", "EMPLOYEE_ID"]),
});

/** KYC module — document upload, submission, review, and signed URL generation. */
export default async function kycRoutes(app: FastifyInstance) {
  /** Get my KYC status and documents. */
  app.get(
    "/api/kyc/me",
    { preHandler: app.authenticate },
    async (request) => {
      const kyc = await app.prisma.kycVerification.findUnique({
        where: { userId: request.authUser!.id },
        include: { documents: { where: { isDeleted: false } } },
      });
      return kyc ?? { status: "UNVERIFIED", documents: [] };
    },
  );

  /** Upload a KYC document (multipart/form-data with docType field). */
  app.post(
    "/api/kyc/documents",
    { preHandler: app.authenticate },
    async (request, reply) => {
      // Iterate all parts so field order doesn't matter.
      let filepart: MultipartFile | undefined;
      let docType = "";

      for await (const part of request.parts()) {
        if (part.type === "file") {
          filepart = part;
        } else {
          docType = (part.value as string) ?? "";
        }
      }

      if (!filepart) return reply.code(400).send({ error: "No file uploaded" });
      if (!docType) return reply.code(400).send({ error: "docType field is required" });

      const parsed = uploadDocSchema.safeParse({ docType });
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const userId = request.authUser!.id;
      let kyc = await app.prisma.kycVerification.findUnique({ where: { userId } });
      if (!kyc) {
        const role = request.authUser!.role;
        const kycType = role === "PATIENT" ? "PATIENT" : "STAFF";
        kyc = await app.prisma.kycVerification.create({
          data: { userId, kycType, status: "UNVERIFIED", method: "MANUAL" },
        });
      }

      const fileBuffer = await filepart.toBuffer();
      const ext = filepart.filename.split(".").pop() ?? "bin";
      const fileRef = `kyc/${kyc.id}/${parsed.data.docType.toLowerCase()}-${Date.now()}.${ext}`;

      const storage = getKycStorageProvider();
      await storage.putObject(fileRef, fileBuffer, filepart.mimetype);

      const doc = await app.prisma.kycDocument.create({
        data: {
          kycId: kyc.id,
          docType: parsed.data.docType,
          fileRef,
          fileSizeKb: Math.ceil(fileBuffer.length / 1024),
        },
      });

      return reply.code(201).send(doc);
    },
  );

  /** Submit KYC for review (patient/staff triggers review queue). */
  app.post(
    "/api/kyc/submit",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const kyc = await app.prisma.kycVerification.findUnique({
        where: { userId: request.authUser!.id },
        include: { documents: { where: { isDeleted: false } } },
      });
      if (!kyc) return reply.code(404).send({ error: "No KYC record found — upload documents first" });
      if (!kyc.documents.length) return reply.code(400).send({ error: "No documents uploaded" });
      if (kyc.status === "VERIFIED") return reply.code(409).send({ error: "KYC already verified" });

      const updated = await app.prisma.kycVerification.update({
        where: { id: kyc.id },
        data: { status: "PENDING" },
      });

      const submitter = await app.prisma.user.update({
        where: { id: request.authUser!.id },
        data: { kycStatus: "PENDING" },
        select: { name: true, email: true },
      });

      // Notify patient that KYC is under review.
      void notifyKyc(submitter.email, "kyc_submitted", { name: submitter.name });
      // Notify verification team (use SUPPORT_EMAIL env or fallback console).
      if (process.env.SUPPORT_EMAIL) {
        void notifyKyc(process.env.SUPPORT_EMAIL, "kyc_pending_review", { name: submitter.name, userId: request.authUser!.id });
      }

      return updated;
    },
  );

  /** Get a signed download URL for a KYC document (own doc or reviewer). */
  app.get(
    "/api/kyc/documents/:docId/url",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { docId } = request.params as { docId: string };
      const doc = await app.prisma.kycDocument.findUnique({ where: { id: docId }, include: { kyc: true } });
      if (!doc || doc.isDeleted) return reply.code(404).send({ error: "Document not found" });

      const isOwner = doc.kyc.userId === request.authUser!.id;
      const isReviewer = ["SUPER_ADMIN", "VERIFICATION", "SUPPORT"].includes(request.authUser!.role);
      if (!isOwner && !isReviewer) return reply.code(403).send({ error: "Forbidden" });

      const storage = getKycStorageProvider();
      const url = await storage.getSignedDownloadUrl(doc.fileRef, 900); // 15 min
      return { url, expiresIn: 900 };
    },
  );

  /** Delete a KYC document (soft delete, only before verification). */
  app.delete(
    "/api/kyc/documents/:docId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { docId } = request.params as { docId: string };
      const doc = await app.prisma.kycDocument.findUnique({ where: { id: docId }, include: { kyc: true } });
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      const isOwner = doc.kyc.userId === request.authUser!.id;
      if (!isOwner) return reply.code(403).send({ error: "Forbidden" });
      if (doc.kyc.status === "VERIFIED") return reply.code(409).send({ error: "Cannot delete documents from a verified KYC" });

      await app.prisma.kycDocument.update({ where: { id: docId }, data: { isDeleted: true } });
      return reply.code(204).send();
    },
  );

  // --- Reviewer (VERIFICATION / SUPER_ADMIN) ---

  /** List KYC submissions pending review. */
  app.get(
    "/api/admin/kyc",
    { preHandler: app.requireRole("VERIFICATION", "SUPER_ADMIN", "SUPPORT") },
    async (request) => {
      const { status } = request.query as { status?: string };
      return app.prisma.kycVerification.findMany({
        where: status ? { status: status as "PENDING" | "VERIFIED" | "REJECTED" } : { status: "PENDING" },
        include: {
          user: { select: { name: true, email: true, phone: true, role: true } },
          documents: { where: { isDeleted: false } },
        },
        orderBy: { updatedAt: "asc" },
      });
    },
  );

  /** Approve or reject a KYC submission. */
  app.post(
    "/api/admin/kyc/:kycId/review",
    { preHandler: app.requireRole("VERIFICATION", "SUPER_ADMIN") },
    async (request, reply) => {
      const { kycId } = request.params as { kycId: string };
      const parsed = reviewSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const kyc = await app.prisma.kycVerification.findUnique({
        where: { id: kycId },
        include: { user: { select: { name: true, email: true } } },
      });
      if (!kyc) return reply.code(404).send({ error: "KYC record not found" });
      if (kyc.status !== "PENDING") return reply.code(409).send({ error: "KYC is not in PENDING state" });

      const isApproved = parsed.data.decision === "VERIFIED";

      const [updated] = await Promise.all([
        app.prisma.kycVerification.update({
          where: { id: kycId },
          data: {
            status: parsed.data.decision,
            verifiedAt: isApproved ? new Date() : null,
            rejectedReason: parsed.data.rejectedReason,
            reviewedById: request.authUser!.id,
          },
        }),
        app.prisma.user.update({
          where: { id: kyc.userId },
          data: {
            kycStatus: parsed.data.decision,
            kycVerifiedAt: isApproved ? new Date() : null,
          },
        }),
      ]);

      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: `KYC_${parsed.data.decision}`,
        entityType: "KycVerification",
        entityId: kycId,
        before: { status: kyc.status },
        after: { status: parsed.data.decision },
      });

      // Notify patient of the review outcome.
      void notifyKyc(
        kyc.user.email,
        isApproved ? "kyc_approved" : "kyc_rejected",
        { name: kyc.user.name, ...(parsed.data.rejectedReason ? { reason: parsed.data.rejectedReason } : {}) },
      );

      return updated;
    },
  );
}
