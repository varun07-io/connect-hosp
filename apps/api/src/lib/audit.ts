import type { PrismaClient } from "@prisma/client";

/** Every privileged/status-changing write should go through this (Section 9, Auditability; ADM-06). */
export async function recordAudit(
  prisma: PrismaClient,
  params: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before === undefined ? undefined : (params.before as object),
      after: params.after === undefined ? undefined : (params.after as object),
    },
  });
}
