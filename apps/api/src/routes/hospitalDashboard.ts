import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { transitionEnquiry, notifyEnquiry } from "../lib/enquiryEvents.js";
import { recordAudit } from "../lib/audit.js";

const assignSchema = z.object({ doctorId: z.string().cuid() });

/** HSP module — profile/doctor/price CRUD lands in Phase 2; the enquiry
 *  inbox (HSP-05/06) is real and drives the core BKG loop end to end. */
export default async function hospitalDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/hospital/me",
    { preHandler: app.requireRole("HOSPITAL_ADMIN") },
    async (request, reply) => {
      const hospitalId = request.authUser!.hospitalId;
      if (!hospitalId) return reply.code(409).send({ error: "This account is not linked to a hospital" });

      const hospital = await app.prisma.hospital.findUnique({
        where: { id: hospitalId },
        include: { _count: { select: { doctors: true, enquiries: true, treatmentPrices: true } } },
      });
      if (!hospital) return reply.code(404).send({ error: "Hospital not found" });
      return hospital;
    },
  );

  app.get(
    "/api/hospital/enquiries",
    { preHandler: app.requireRole("HOSPITAL_ADMIN") },
    async (request, reply) => {
      const hospitalId = request.authUser!.hospitalId;
      if (!hospitalId) return reply.code(409).send({ error: "This account is not linked to a hospital" });

      app.assertHospitalScope(request, hospitalId);
      return app.prisma.enquiry.findMany({
        where: { hospitalId },
        orderBy: { createdAt: "desc" },
        include: {
          patient: { select: { name: true, phone: true } },
          treatment: { select: { name: true } },
          assignedDoctor: { select: { user: { select: { name: true } } } },
          payment: { select: { status: true, amount: true } },
          _count: { select: { attachments: true } },
        },
      });
    },
  );

  app.patch(
    "/api/hospital/enquiries/:id/acknowledge",
    { preHandler: app.requireRole("HOSPITAL_ADMIN") },
    async (request, reply) => {
      const hospitalId = request.authUser!.hospitalId;
      const { id } = request.params as { id: string };
      if (!hospitalId) return reply.code(409).send({ error: "This account is not linked to a hospital" });
      app.assertHospitalScope(request, hospitalId);

      const enquiry = await app.prisma.enquiry.findFirst({ where: { id, hospitalId } });
      if (!enquiry) return reply.code(404).send({ error: "Enquiry not found" });
      if (enquiry.status !== "NEW") return reply.code(409).send({ error: `Cannot acknowledge an enquiry in status ${enquiry.status}` });

      await transitionEnquiry(app.prisma, {
        enquiryId: id,
        fromStatus: enquiry.status,
        toStatus: "ACKNOWLEDGED",
        actorId: request.authUser!.id,
        note: "Acknowledged by hospital.",
      });
      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "ENQUIRY_ACKNOWLEDGED",
        entityType: "Enquiry",
        entityId: id,
        before: { status: enquiry.status },
        after: { status: "ACKNOWLEDGED" },
      });

      return { ok: true };
    },
  );

  app.patch(
    "/api/hospital/enquiries/:id/assign",
    { preHandler: app.requireRole("HOSPITAL_ADMIN") },
    async (request, reply) => {
      const hospitalId = request.authUser!.hospitalId;
      const { id } = request.params as { id: string };
      if (!hospitalId) return reply.code(409).send({ error: "This account is not linked to a hospital" });
      app.assertHospitalScope(request, hospitalId);

      const parsed = assignSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const [enquiry, doctor] = await Promise.all([
        app.prisma.enquiry.findFirst({ where: { id, hospitalId } }),
        app.prisma.doctor.findFirst({
          where: { id: parsed.data.doctorId, hospitalId },
          include: { user: true },
        }),
      ]);
      if (!enquiry) return reply.code(404).send({ error: "Enquiry not found" });
      if (!doctor) return reply.code(404).send({ error: "Doctor not found at this hospital" });
      if (!["NEW", "ACKNOWLEDGED"].includes(enquiry.status)) {
        return reply.code(409).send({ error: `Cannot assign an enquiry in status ${enquiry.status}` });
      }

      await app.prisma.enquiry.update({ where: { id }, data: { assignedDoctorId: doctor.id } });
      await transitionEnquiry(app.prisma, {
        enquiryId: id,
        fromStatus: enquiry.status,
        toStatus: "ASSIGNED",
        actorId: request.authUser!.id,
        note: `Assigned to Dr. ${doctor.user.name}.`,
      });
      if (doctor.user.email) {
        await notifyEnquiry(app.prisma, {
          enquiryId: id,
          recipient: doctor.user.email,
          channel: "EMAIL",
          template: "enquiry_assigned",
          data: { doctorName: doctor.user.name },
        });
      }
      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "ENQUIRY_ASSIGNED",
        entityType: "Enquiry",
        entityId: id,
        before: { status: enquiry.status, assignedDoctorId: enquiry.assignedDoctorId },
        after: { status: "ASSIGNED", assignedDoctorId: doctor.id },
      });

      return { ok: true };
    },
  );
}
