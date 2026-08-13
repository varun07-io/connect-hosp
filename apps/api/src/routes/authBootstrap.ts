import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyFirebaseBearerToken } from "../plugins/auth.js";
import { recordAudit } from "../lib/audit.js";

const registerPatientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().max(80).optional(),
});

/**
 * PAT-01 sign-up half of the loop: a brand-new Firebase-authenticated phone
 * number has no User row yet (staff accounts are provisioned separately, by
 * an admin — see ADM-01, Phase 2). This is the one self-serve exception.
 */
export default async function authBootstrapRoutes(app: FastifyInstance) {
  app.post("/api/auth/register-patient", async (request, reply) => {
    const decoded = await verifyFirebaseBearerToken(request.headers.authorization);
    if (!decoded) return reply.code(401).send({ error: "Invalid or missing Firebase token" });

    const parsed = registerPatientSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const existing = await app.prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (existing) return reply.code(409).send({ error: "Account already registered" });

    const user = await app.prisma.user.create({
      data: {
        firebaseUid: decoded.uid,
        role: "PATIENT",
        name: parsed.data.name,
        phone: decoded.phone,
        email: decoded.email,
        patientProfile: { create: { city: parsed.data.city } },
      },
    });

    await recordAudit(app.prisma, {
      actorId: user.id,
      action: "PATIENT_SELF_REGISTERED",
      entityType: "User",
      entityId: user.id,
      after: { name: user.name, phone: user.phone },
    });

    return reply.code(201).send({ id: user.id });
  });
}
