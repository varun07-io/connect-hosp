import type { FastifyInstance } from "fastify";
import {
  changedGovtHospitalFields,
  govtHospitalImportSchema,
  govtHospitalKey,
  normalizeGovtHospital,
  type GovtHospitalImportResult,
  type GovtHospitalInput,
} from "@connect-hospital/shared";
import { recordAudit } from "../lib/audit.js";

const LIST_SELECT = {
  id: true,
  key: true,
  refId: true,
  name: true,
  district: true,
  taluk: true,
  address: true,
  specialities: true,
  subType: true,
  updatedAt: true,
} as const;

/** Government hospital directory — public listing + Super Admin Excel import. */
export default async function govtHospitalRoutes(app: FastifyInstance) {
  /** Whole directory in one response: it's a few hundred to a few thousand
   *  short rows, and having it all client-side makes search/filters instant. */
  app.get("/api/govt-hospitals", async () => {
    const items = await app.prisma.govtHospital.findMany({ select: LIST_SELECT, orderBy: { name: "asc" } });
    const lastUpdated = items.reduce<Date | null>((max, h) => (!max || h.updatedAt > max ? h.updatedAt : max), null);
    return { items, total: items.length, lastUpdated };
  });

  app.post(
    "/api/admin/govt-hospitals/import",
    { preHandler: app.requireRole("SUPER_ADMIN"), bodyLimit: 15 * 1024 * 1024 },
    async (request, reply) => {
      const parsed = govtHospitalImportSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      // Re-normalise and de-duplicate server-side (first occurrence wins), so the
      // result never depends on the client having done it right.
      const incoming = new Map<string, GovtHospitalInput>();
      let duplicatesSkipped = 0;
      for (const raw of parsed.data.rows) {
        const row = normalizeGovtHospital(raw);
        if (!row.name || !row.district) continue;
        const key = govtHospitalKey(row);
        if (incoming.has(key)) {
          duplicatesSkipped++;
          continue;
        }
        incoming.set(key, row);
      }

      const existing = await app.prisma.govtHospital.findMany();
      const byKey = new Map(existing.map((h) => [h.key, h]));

      const toCreate: (GovtHospitalInput & { key: string })[] = [];
      const toUpdate: { id: string; data: GovtHospitalInput }[] = [];
      let unchanged = 0;
      for (const [key, row] of incoming) {
        const current = byKey.get(key);
        if (!current) toCreate.push({ key, ...row });
        else if (changedGovtHospitalFields(current, row).length > 0) toUpdate.push({ id: current.id, data: row });
        else unchanged++;
      }
      const toRemove = parsed.data.mode === "replace" ? existing.filter((h) => !incoming.has(h.key)).map((h) => h.id) : [];

      await app.prisma.$transaction([
        app.prisma.govtHospital.createMany({ data: toCreate }),
        ...toUpdate.map((u) => app.prisma.govtHospital.update({ where: { id: u.id }, data: u.data })),
        ...(toRemove.length ? [app.prisma.govtHospital.deleteMany({ where: { id: { in: toRemove } } })] : []),
      ]);

      const result: GovtHospitalImportResult = {
        created: toCreate.length,
        updated: toUpdate.length,
        unchanged,
        removed: toRemove.length,
        duplicatesSkipped,
      };
      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "GOVT_HOSPITALS_IMPORTED",
        entityType: "GovtHospital",
        entityId: "directory",
        after: { mode: parsed.data.mode, rowsReceived: parsed.data.rows.length, ...result },
      });
      return result;
    },
  );
}
