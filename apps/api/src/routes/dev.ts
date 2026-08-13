import type { FastifyInstance } from "fastify";
import { env } from "../env.js";

/**
 * Dev-only "log in as" directory so the whole app is clickable with zero Firebase
 * setup: the frontend lists these and sends the chosen id back as `x-dev-user`
 * (see plugins/auth.ts). Registered only when DEV_AUTH_BYPASS is on, which is
 * itself refused at boot in production (see env.ts).
 */
export default async function devRoutes(app: FastifyInstance) {
  if (!env.DEV_AUTH_BYPASS) return;

  app.get("/api/dev/users", async () => {
    return app.prisma.user.findMany({
      select: { id: true, name: true, role: true, hospitalId: true, email: true, hospital: { select: { name: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  });
}
