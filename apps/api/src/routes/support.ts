import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordAudit } from "../lib/audit.js";

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED"]),
  note: z.string().trim().max(2000).optional(),
});

/** SUP module — ticket list (SUP-02) plus status actions (SUP-03..05). */
export default async function supportRoutes(app: FastifyInstance) {
  app.get(
    "/api/support/tickets",
    { preHandler: app.requireRole("SUPPORT", "SUPER_ADMIN") },
    async () => {
      return app.prisma.supportTicket.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          raisedBy: { select: { name: true, role: true } },
          assignedTo: { select: { name: true } },
        },
      });
    },
  );

  app.patch(
    "/api/support/tickets/:id",
    { preHandler: app.requireRole("SUPPORT", "SUPER_ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateTicketSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const ticket = await app.prisma.supportTicket.findUnique({ where: { id } });
      if (!ticket) return reply.code(404).send({ error: "Ticket not found" });

      const updated = await app.prisma.supportTicket.update({
        where: { id },
        data: {
          status: parsed.data.status,
          assignedToId: ticket.assignedToId ?? request.authUser!.id,
          notes: parsed.data.note ? `${ticket.notes ? ticket.notes + "\n" : ""}${parsed.data.note}` : ticket.notes,
        },
      });

      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "SUPPORT_TICKET_UPDATED",
        entityType: "SupportTicket",
        entityId: id,
        before: { status: ticket.status },
        after: { status: updated.status },
      });

      return updated;
    },
  );
}
