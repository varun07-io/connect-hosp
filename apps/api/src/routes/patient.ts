import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { z } from "zod";
import { createEnquirySchema, type EnquiryStatus } from "@connect-hospital/shared";
import { notifyEnquiry, transitionEnquiry } from "../lib/enquiryEvents.js";
import { recordAudit } from "../lib/audit.js";
import { getStorageProvider } from "../lib/storage/index.js";

/** Before the doctor has guided the patient, the patient may withdraw. */
const PATIENT_CANCELLABLE: EnquiryStatus[] = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "CONTACTED", "NO_RESPONSE", "REOPENED"];

const cancelEnquirySchema = z.object({ reason: z.string().trim().max(500).optional() });

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

      // Snapshot the deposit requirement at booking time, so later changes to
      // the hospital's settings never retroactively demand payment.
      const depositAmount = intent === "SURGERY" ? hospital.depositAmountSurgery : hospital.depositAmountSecondOpinion;

      const enquiry = await app.prisma.enquiry.create({
        data: {
          patientId: request.authUser!.id,
          hospitalId,
          intent,
          paymentRequired: hospital.depositRequired && depositAmount > 0,
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
          hospital: { select: { name: true, slug: true, city: true, depositRequired: true } },
          treatment: { select: { name: true } },
          assignedDoctor: { select: { user: { select: { name: true } } } },
          payment: { select: { status: true, amount: true } },
        },
      });
    },
  );

  /** Full enquiry view for the patient: progress timeline, doctor, callback
   *  notes, shared records and deposit state — everything "what happens next" needs. */
  app.get(
    "/api/patient/enquiries/:id",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const enquiry = await app.prisma.enquiry.findFirst({
        where: { id, patientId: request.authUser!.id },
        include: {
          hospital: {
            select: {
              name: true,
              slug: true,
              city: true,
              address: true,
              depositRequired: true,
              depositAmountSurgery: true,
              depositAmountSecondOpinion: true,
              slaCallbackHours: true,
            },
          },
          treatment: { select: { name: true, category: true } },
          assignedDoctor: {
            select: { specialisation: true, qualifications: true, experienceYears: true, user: { select: { name: true } } },
          },
          statusHistory: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true } },
          attachments: { select: { medicalRecord: { select: { id: true, title: true, category: true } } } },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              verifiedAt: true,
              refunds: { select: { id: true, amount: true, status: true, reason: true, createdAt: true } },
            },
          },
        },
      });
      if (!enquiry) return reply.code(404).send({ error: "Enquiry not found" });
      return enquiry;
    },
  );

  /** Patient-initiated cancellation. Any verified deposit is queued for a full
   *  refund (PATIENT_CANCEL) the same way the SLA job queues one — ops/the
   *  gateway settle it from there. */
  app.patch(
    "/api/patient/enquiries/:id/cancel",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = cancelEnquirySchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const enquiry = await app.prisma.enquiry.findFirst({
        where: { id, patientId: request.authUser!.id },
        include: { hospital: true, payment: true },
      });
      if (!enquiry) return reply.code(404).send({ error: "Enquiry not found" });
      if (!PATIENT_CANCELLABLE.includes(enquiry.status)) {
        return reply.code(409).send({ error: `An enquiry that is ${enquiry.status.toLowerCase().replace("_", " ")} can't be cancelled.` });
      }

      const reason = parsed.data.reason?.trim() || "Cancelled by patient.";
      await transitionEnquiry(app.prisma, {
        enquiryId: id,
        fromStatus: enquiry.status,
        toStatus: "CANCELLED",
        actorId: request.authUser!.id,
        note: reason,
      });

      let refundQueued = false;
      if (enquiry.payment?.status === "VERIFIED") {
        await app.prisma.$transaction([
          app.prisma.payment.update({ where: { id: enquiry.payment.id }, data: { status: "REFUND_INITIATED" } }),
          app.prisma.paymentRefund.create({
            data: {
              paymentId: enquiry.payment.id,
              amount: enquiry.payment.amount,
              reason: `Patient cancelled: ${reason}`,
              refundType: "PATIENT_CANCEL",
              status: "INITIATED",
              initiatedById: request.authUser!.id,
            },
          }),
        ]);
        refundQueued = true;
      }

      await notifyEnquiry(app.prisma, {
        enquiryId: id,
        recipient: enquiry.hospital.contactPersonEmail,
        channel: "EMAIL",
        template: "enquiry_cancelled",
        data: { hospitalName: enquiry.hospital.name, patientName: request.authUser!.name },
      });
      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "ENQUIRY_CANCELLED",
        entityType: "Enquiry",
        entityId: id,
        before: { status: enquiry.status },
        after: { status: "CANCELLED", refundQueued },
      });

      return { ok: true, status: "CANCELLED", refundQueued };
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
