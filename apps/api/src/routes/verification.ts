import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getNotificationProvider } from "../lib/notifications/index.js";
import { recordAudit } from "../lib/audit.js";

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "INFO_REQUESTED"]),
  reason: z.string().trim().max(2000).optional(),
});

/** VER module — queue (VER-02) plus the approve/reject/info-request decision (VER-03..06). */
export default async function verificationRoutes(app: FastifyInstance) {
  app.get(
    "/api/verification/queue",
    { preHandler: app.requireRole("VERIFICATION", "SUPER_ADMIN") },
    async () => {
      return app.prisma.hospital.findMany({
        where: { status: { in: ["PENDING", "IN_REVIEW"] } },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { verificationDocs: true } } },
      });
    },
  );

  app.patch(
    "/api/verification/hospitals/:id/decision",
    { preHandler: app.requireRole("VERIFICATION", "SUPER_ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = decisionSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const hospital = await app.prisma.hospital.findUnique({ where: { id } });
      if (!hospital) return reply.code(404).send({ error: "Hospital not found" });
      if (!["PENDING", "IN_REVIEW"].includes(hospital.status)) {
        return reply.code(409).send({ error: `Hospital is already ${hospital.status.toLowerCase()}` });
      }

      const nextStatus = parsed.data.decision === "APPROVED" ? "APPROVED" : parsed.data.decision === "REJECTED" ? "REJECTED" : "IN_REVIEW";

      await app.prisma.$transaction([
        app.prisma.hospital.update({ where: { id }, data: { status: nextStatus } }),
        app.prisma.verificationDecision.create({
          data: {
            hospitalId: id,
            reviewerId: request.authUser!.id,
            decision: parsed.data.decision,
            reason: parsed.data.reason,
          },
        }),
      ]);

      const provider = getNotificationProvider();
      const sendResult = await provider.send({
        channel: "EMAIL",
        recipient: hospital.contactPersonEmail,
        template: "verification_decision",
        data: { hospitalName: hospital.name, decision: parsed.data.decision },
      });
      await app.prisma.notification.create({
        data: {
          recipient: hospital.contactPersonEmail,
          channel: "EMAIL",
          template: "verification_decision",
          status: sendResult.status,
          providerRef: sendResult.providerRef,
          sentAt: sendResult.status === "SENT" ? new Date() : null,
        },
      });

      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: `HOSPITAL_${parsed.data.decision}`,
        entityType: "Hospital",
        entityId: id,
        before: { status: hospital.status },
        after: { status: nextStatus, reason: parsed.data.reason },
      });

      return { ok: true, status: nextStatus };
    },
  );
}
