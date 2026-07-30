import type { FastifyInstance } from "fastify";
import { logCallbackSchema } from "@connect-hospital/shared";
import type { EnquiryStatus } from "@connect-hospital/shared";
import { transitionEnquiry, notifyEnquiry } from "../lib/enquiryEvents.js";
import { recordAudit } from "../lib/audit.js";

/** DOC module — assigned-enquiry list (DOC-02/03) plus callback logging (DOC-04/05). */
export default async function doctorRoutes(app: FastifyInstance) {
  app.get(
    "/api/doctor/enquiries",
    { preHandler: app.requireRole("DOCTOR") },
    async (request, reply) => {
      const doctor = await app.prisma.doctor.findUnique({ where: { userId: request.authUser!.id } });
      if (!doctor) return reply.code(409).send({ error: "This account is not linked to a doctor profile" });

      return app.prisma.enquiry.findMany({
        where: { assignedDoctorId: doctor.id },
        orderBy: { createdAt: "desc" },
        include: {
          patient: { select: { name: true } },
          treatment: { select: { name: true } },
        },
      });
    },
  );

  app.patch(
    "/api/doctor/enquiries/:id/callback",
    { preHandler: app.requireRole("DOCTOR") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = logCallbackSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const doctor = await app.prisma.doctor.findUnique({ where: { userId: request.authUser!.id } });
      if (!doctor) return reply.code(409).send({ error: "This account is not linked to a doctor profile" });

      const enquiry = await app.prisma.enquiry.findFirst({ where: { id, assignedDoctorId: doctor.id } });
      if (!enquiry) return reply.code(404).send({ error: "Enquiry not found" });
      if (!["ASSIGNED", "CONTACTED"].includes(enquiry.status)) {
        return reply.code(409).send({ error: `Cannot log a callback for an enquiry in status ${enquiry.status}` });
      }

      // DOC-04/05: outcome drives the next lifecycle step (BKG-06).
      const nextStatus: EnquiryStatus =
        parsed.data.outcome === "REACHED" ? "GUIDED" : parsed.data.outcome === "NOT_REACHED" ? "NO_RESPONSE" : "CONTACTED";

      await app.prisma.enquiry.update({
        where: { id },
        data: { callbackOutcome: parsed.data.outcome, callbackNotes: parsed.data.notes },
      });
      await transitionEnquiry(app.prisma, {
        enquiryId: id,
        fromStatus: enquiry.status,
        toStatus: nextStatus,
        actorId: request.authUser!.id,
        note: parsed.data.notes,
      });

      const patient = await app.prisma.user.findUnique({ where: { id: enquiry.patientId } });
      if (patient?.email) {
        await notifyEnquiry(app.prisma, {
          enquiryId: id,
          recipient: patient.email,
          channel: "EMAIL",
          template: "callback_logged",
          data: { outcome: parsed.data.outcome },
        });
      }
      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "CALLBACK_LOGGED",
        entityType: "Enquiry",
        entityId: id,
        before: { status: enquiry.status },
        after: { status: nextStatus, outcome: parsed.data.outcome },
      });

      return { ok: true, status: nextStatus };
    },
  );
}
