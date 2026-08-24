import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { FE_ROLES } from "@connect-hospital/shared";
import { recordAudit } from "../lib/audit.js";

const logActionSchema = z.object({
  actionType: z.enum(["PHONE_CALL", "PHYSICAL_VISIT", "DOCUMENT_COLLECTED", "ADMISSION_CONFIRMED", "OTHER"]),
  notes: z.string().trim().min(1).max(2000),
  nextStep: z.string().trim().max(500).optional(),
  followUpDate: z.string().datetime(),
});

const updateQueueStatusSchema = z.object({
  followUpStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ESCALATED"]),
  admissionRef: z.string().trim().max(100).optional(),
});

const assignFeSchema = z.object({
  feId: z.string().min(1),
});

/** FE module — field executive dashboard and admin management. */
export default async function fieldExecutiveRoutes(app: FastifyInstance) {
  // --- FE Dashboard ---

  /** Summary stats for the authenticated FE's dashboard.
   *  FE_MANAGER sees platform-wide totals; FE roles see only their own. */
  app.get(
    "/api/fe/stats",
    { preHandler: app.requireRole(...FE_ROLES) },
    async (request) => {
      const isManager = request.authUser!.role === "FE_MANAGER";

      const feProfile = await app.prisma.fieldExecutive.findUnique({
        where: { userId: request.authUser!.id },
      });

      // Managers see platform-wide stats; individual FEs see only their own.
      const queueFilter = isManager ? {} : { feId: feProfile?.id ?? "__none__" };
      const logFilter   = isManager ? {} : { feId: feProfile?.id ?? "__none__" };

      const [total, notStarted, inProgress, completed, escalated, unassigned, admissionsConfirmed] = await Promise.all([
        app.prisma.feBookingQueue.count({ where: queueFilter }),
        app.prisma.feBookingQueue.count({ where: { ...queueFilter, followUpStatus: "NOT_STARTED" } }),
        app.prisma.feBookingQueue.count({ where: { ...queueFilter, followUpStatus: "IN_PROGRESS" } }),
        app.prisma.feBookingQueue.count({ where: { ...queueFilter, followUpStatus: "COMPLETED" } }),
        app.prisma.feBookingQueue.count({ where: { ...queueFilter, followUpStatus: "ESCALATED" } }),
        isManager ? app.prisma.feBookingQueue.count({ where: { feId: null } }) : Promise.resolve(0),
        app.prisma.feFollowUpLog.count({ where: { ...logFilter, actionType: "ADMISSION_CONFIRMED" } }),
      ]);

      // Recent activity
      const recentLogs = await app.prisma.feFollowUpLog.findMany({
        where: logFilter,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          feQueue: {
            include: {
              enquiry: {
                include: {
                  patient: { select: { name: true } },
                  hospital: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      return { total, notStarted, inProgress, completed, escalated, unassigned, admissionsConfirmed, recentLogs };
    },
  );

  /** List queue entries scoped by role:
   *  - FE_MANAGER: all entries assigned to any FE on their team
   *  - FIELD_EXECUTIVE_HOSPITAL: only entries for their hospital
   *  - FIELD_EXECUTIVE_CONNECT: only their personally assigned entries */
  app.get(
    "/api/fe/queue",
    { preHandler: app.requireRole(...FE_ROLES) },
    async (request) => {
      const role = request.authUser!.role;

      if (role === "FE_MANAGER") {
        // Manager sees all entries assigned to their direct reports.
        const manager = await app.prisma.fieldExecutive.findUnique({
          where: { userId: request.authUser!.id },
          include: { reports: { select: { id: true } } },
        });
        const teamIds = manager?.reports.map((r) => r.id) ?? [];
        // Also include unassigned entries so the manager can assign them.
        return {
          items: await app.prisma.feBookingQueue.findMany({
            where: { OR: [{ feId: { in: teamIds } }, { feId: null }] },
            orderBy: { createdAt: "desc" },
            include: {
              enquiry: {
                include: {
                  patient: { select: { name: true, phone: true } },
                  hospital: { select: { name: true, city: true } },
                  treatment: { select: { name: true } },
                },
              },
              followUpLogs: { orderBy: { createdAt: "desc" }, take: 3 },
            },
          }),
        };
      }

      const feProfile = await app.prisma.fieldExecutive.findUnique({
        where: { userId: request.authUser!.id },
      });
      if (!feProfile) return { items: [] };

      // Hospital FEs are scoped to their hospital — enforce server-side.
      const hospitalFilter =
        role === "FIELD_EXECUTIVE_HOSPITAL" && feProfile.hospitalId
          ? { enquiry: { hospitalId: feProfile.hospitalId } }
          : {};

      return {
        items: await app.prisma.feBookingQueue.findMany({
          where: { feId: feProfile.id, ...hospitalFilter },
          orderBy: { createdAt: "desc" },
          include: {
            enquiry: {
              include: {
                patient: { select: { name: true, phone: true } },
                hospital: { select: { name: true, city: true } },
                treatment: { select: { name: true } },
              },
            },
            followUpLogs: { orderBy: { createdAt: "desc" }, take: 3 },
          },
        }),
      };
    },
  );

  /** Get a single queue entry with full follow-up history. */
  app.get(
    "/api/fe/queue/:id",
    { preHandler: app.requireRole(...FE_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const feProfile = await app.prisma.fieldExecutive.findUnique({
        where: { userId: request.authUser!.id },
      });

      const entry = await app.prisma.feBookingQueue.findFirst({
        where: { id, ...(feProfile ? { feId: feProfile.id } : {}) },
        include: {
          enquiry: {
            include: {
              patient: { select: { name: true, phone: true, email: true } },
              hospital: { select: { name: true, city: true, address: true } },
              treatment: { select: { name: true } },
            },
          },
          followUpLogs: { orderBy: { createdAt: "desc" } },
        },
      });
      if (!entry) return reply.code(404).send({ error: "Queue entry not found" });
      return entry;
    },
  );

  /** Log a follow-up action on a queue entry. */
  app.post(
    "/api/fe/queue/:id/logs",
    { preHandler: app.requireRole(...FE_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = logActionSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const feProfile = await app.prisma.fieldExecutive.findUnique({
        where: { userId: request.authUser!.id },
      });
      if (!feProfile) return reply.code(403).send({ error: "No FE profile" });

      const entry = await app.prisma.feBookingQueue.findFirst({ where: { id, feId: feProfile.id } });
      if (!entry) return reply.code(404).send({ error: "Queue entry not found" });

      const log = await app.prisma.feFollowUpLog.create({
        data: {
          feQueueId: id,
          feId: feProfile.id,
          actionType: parsed.data.actionType,
          notes: parsed.data.notes,
          nextStep: parsed.data.nextStep,
          followUpDate: new Date(parsed.data.followUpDate),
        },
      });
      return reply.code(201).send(log);
    },
  );

  /** Update queue entry follow-up status. */
  app.patch(
    "/api/fe/queue/:id/status",
    { preHandler: app.requireRole(...FE_ROLES, "SUPER_ADMIN", "SUPPORT") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateQueueStatusSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const entry = await app.prisma.feBookingQueue.findUnique({ where: { id } });
      if (!entry) return reply.code(404).send({ error: "Queue entry not found" });

      const updated = await app.prisma.feBookingQueue.update({
        where: { id },
        data: {
          followUpStatus: parsed.data.followUpStatus,
          ...(parsed.data.admissionRef !== undefined ? { admissionRef: parsed.data.admissionRef } : {}),
          assignedAt: entry.assignedAt ?? new Date(),
        },
      });

      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "FE_QUEUE_STATUS_UPDATED",
        entityType: "FeBookingQueue",
        entityId: id,
        before: { followUpStatus: entry.followUpStatus },
        after: { followUpStatus: updated.followUpStatus },
      });

      return updated;
    },
  );

  // --- Admin / FE Manager operations ---

  /** List all field executives (FE_MANAGER or SUPER_ADMIN). */
  app.get(
    "/api/admin/field-executives",
    { preHandler: app.requireRole("FE_MANAGER", "SUPER_ADMIN") },
    async () => {
      return app.prisma.fieldExecutive.findMany({
        where: { isDeleted: false },
        include: { user: { select: { name: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
      });
    },
  );

  /** Assign a FE to a queue entry. */
  app.post(
    "/api/admin/fe/queue/:id/assign",
    { preHandler: app.requireRole("FE_MANAGER", "SUPER_ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = assignFeSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const [entry, fe] = await Promise.all([
        app.prisma.feBookingQueue.findUnique({ where: { id } }),
        app.prisma.fieldExecutive.findUnique({ where: { id: parsed.data.feId } }),
      ]);
      if (!entry) return reply.code(404).send({ error: "Queue entry not found" });
      if (!fe || fe.isDeleted) return reply.code(404).send({ error: "Field executive not found" });

      const updated = await app.prisma.feBookingQueue.update({
        where: { id },
        data: { feId: fe.id, assignedAt: new Date() },
      });

      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "FE_ASSIGNED",
        entityType: "FeBookingQueue",
        entityId: id,
        before: { feId: entry.feId },
        after: { feId: fe.id },
      });

      return updated;
    },
  );
}
