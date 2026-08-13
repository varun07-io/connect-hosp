import type { FastifyInstance } from "fastify";
import { createEnquirySchema } from "@connect-hospital/shared";
import { notifyEnquiry } from "../lib/enquiryEvents.js";

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
}
