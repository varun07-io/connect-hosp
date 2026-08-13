import type { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const [{ now }] = await app.prisma.$queryRaw<{ now: Date }[]>`select now()`;
    return { status: "ok", time: now };
  });
}
