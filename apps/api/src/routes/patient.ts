import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { createEnquirySchema } from "@connect-hospital/shared";
import { notifyEnquiry } from "../lib/enquiryEvents.js";
import { getStorageProvider } from "../lib/storage/index.js";

/** PAT + BKG modules — discovery-to-callback core loop (Episode A/B). */
export default async function patientRoutes(app: FastifyInstance) {
  app.post(
    "/api/patient/enquiries",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      const parsed = createEnquirySchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const { hospitalId, intent, treatmentId, condition, preferredCallbackWindow, recordIds, consentAccepted: _consentAccepted } = parsed.data;

      const hospital = await app.prisma.hospital.findUnique({ where: { id: hospitalId } });
      if (!hospital || hospital.status !== "APPROVED") return reply.code(404).send({ error: "Hospital not found" });

      // KYC gate: attaching medical records requires verified identity (§5.2.1).
      if (recordIds.length > 0) {
        const actor = await app.prisma.user.findUnique({ where: { id: request.authUser!.id }, select: { kycStatus: true } });
        if (!actor || actor.kycStatus !== "VERIFIED") {
          return reply.code(403).send({ error: "Identity verification (KYC) required before attaching medical records to an enquiry." });
        }
      }

      const patient = await app.prisma.patient.findUnique({ where: { userId: request.authUser!.id } });
      if (!patient) return reply.code(409).send({ error: "Complete your patient profile before booking" });

      const enquiry = await app.prisma.enquiry.create({
        data: {
          patientId: request.authUser!.id,
          hospitalId,
          intent,
          treatmentId,
          condition,
          preferredCallbackWindow,
          status: "NEW",
          statusHistory: {
            create: { toStatus: "NEW", actorId: request.authUser!.id, note: "Enquiry submitted by patient." },
          },
          consents: { create: { patientId: patient.id, recordsShared: recordIds.length > 0 } },
          ...(recordIds.length > 0
            ? { attachments: { create: recordIds.map((medicalRecordId) => ({ medicalRecordId })) } }
            : {}),
        },
        include: { hospital: { select: { name: true, slug: true } }, treatment: { select: { name: true } } },
      });

      await notifyEnquiry(app.prisma, {
        enquiryId: enquiry.id,
        recipient: hospital.contactPersonPhone,
        channel: "SMS",
        template: "new_enquiry",
        data: { hospitalName: hospital.name, patientName: request.authUser!.name },
      });
      await notifyEnquiry(app.prisma, {
        enquiryId: enquiry.id,
        recipient: hospital.contactPersonEmail,
        channel: "EMAIL",
        template: "new_enquiry",
        data: { hospitalName: hospital.name, patientName: request.authUser!.name },
      });

      return reply.code(201).send(enquiry);
    },
  );

  app.get(
    "/api/patient/enquiries",
    { preHandler: app.requireRole("PATIENT") },
    async (request) => {
      const patientId = request.authUser!.id;
      return app.prisma.enquiry.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        include: {
          hospital: { select: { name: true, slug: true } },
          treatment: { select: { name: true } },
          assignedDoctor: { select: { user: { select: { name: true } } } },
        },
      });
    },
  );

  app.get(
    "/api/patient/records",
    { preHandler: app.requireRole("PATIENT") },
    async (request) => {
      const patient = await app.prisma.patient.findUnique({ where: { userId: request.authUser!.id } });
      if (!patient) return [];
      return app.prisma.medicalRecord.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: "desc" },
      });
    },
  );

  /** Upload a medical record to the patient vault (multipart/form-data). */
  app.post(
    "/api/patient/records",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      let filepart: MultipartFile | undefined;
      let title = "";
      let category = "OTHER";

      for await (const part of request.parts()) {
        if (part.type === "file") {
          filepart = part;
        } else if (part.fieldname === "title") {
          title = (part.value as string) ?? "";
        } else if (part.fieldname === "category") {
          category = (part.value as string) ?? "OTHER";
        }
      }

      if (!filepart) return reply.code(400).send({ error: "No file uploaded" });
      if (!title.trim()) title = filepart.filename;

      const validCategories = ["LAB_REPORT", "PRESCRIPTION", "IMAGING", "OTHER"];
      if (!validCategories.includes(category)) category = "OTHER";

      const patient = await app.prisma.patient.findUnique({ where: { userId: request.authUser!.id } });
      if (!patient) return reply.code(409).send({ error: "Complete your patient profile first" });

      const fileBuffer = await filepart.toBuffer();
      const ext = filepart.filename.split(".").pop() ?? "bin";
      const fileKey = `vault/${patient.id}/${Date.now()}-${category.toLowerCase()}.${ext}`;

      const storage = getStorageProvider();
      await storage.putObject(fileKey, fileBuffer, filepart.mimetype);

      const record = await app.prisma.medicalRecord.create({
        data: {
          patientId: patient.id,
          title: title.trim(),
          category: category as "LAB_REPORT" | "PRESCRIPTION" | "IMAGING" | "OTHER",
          fileKey,
          mimeType: filepart.mimetype,
          sizeBytes: fileBuffer.length,
        },
      });

      return reply.code(201).send(record);
    },
  );

  /** Get a signed download URL for a patient's own record. */
  app.get(
    "/api/patient/records/:id/url",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const patient = await app.prisma.patient.findUnique({ where: { userId: request.authUser!.id } });
      if (!patient) return reply.code(404).send({ error: "Patient profile not found" });

      const record = await app.prisma.medicalRecord.findFirst({ where: { id, patientId: patient.id } });
      if (!record) return reply.code(404).send({ error: "Record not found" });

      const storage = getStorageProvider();
      const url = await storage.getSignedDownloadUrl(record.fileKey, 900);
      return { url, expiresIn: 900 };
    },
  );

  /** List the authenticated patient's payment history. */
  app.get(
    "/api/patient/payments",
    { preHandler: app.requireRole("PATIENT") },
    async (request) => {
      const enquiries = await app.prisma.enquiry.findMany({
        where: { patientId: request.authUser!.id, paymentId: { not: null } },
        select: {
          id: true,
          intent: true,
          condition: true,
          createdAt: true,
          hospital: { select: { name: true } },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              gateway: true,
              gatewayPaymentId: true,
              verifiedAt: true,
              createdAt: true,
              refunds: { select: { id: true, amount: true, status: true, reason: true, createdAt: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return enquiries;
    },
  );

  /** Delete a patient's own record. */
  app.delete(
    "/api/patient/records/:id",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const patient = await app.prisma.patient.findUnique({ where: { userId: request.authUser!.id } });
      if (!patient) return reply.code(404).send({ error: "Not found" });

      const record = await app.prisma.medicalRecord.findFirst({ where: { id, patientId: patient.id } });
      if (!record) return reply.code(404).send({ error: "Record not found" });

      const storage = getStorageProvider();
      await storage.deleteObject(record.fileKey);
      await app.prisma.medicalRecord.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
}
