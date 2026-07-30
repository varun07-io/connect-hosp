import type { FastifyInstance } from "fastify";

/** ADM module shell — management actions (ADM-01..05, 08) land in Phase 2. */
export default async function adminRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/overview",
    { preHandler: app.requireRole("SUPER_ADMIN") },
    async () => {
      const [hospitals, patients, doctors, enquiries] = await Promise.all([
        app.prisma.hospital.count(),
        app.prisma.user.count({ where: { role: "PATIENT" } }),
        app.prisma.doctor.count(),
        app.prisma.enquiry.count(),
      ]);
      return { hospitals, patients, doctors, enquiries };
    },
  );

  app.get(
    "/api/admin/audit-log",
    { preHandler: app.requireRole("SUPER_ADMIN") },
    async () => {
      return app.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: { select: { name: true, role: true } } },
      });
    },
  );
}
