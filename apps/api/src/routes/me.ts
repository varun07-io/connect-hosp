import type { FastifyInstance } from "fastify";

export default async function meRoutes(app: FastifyInstance) {
  app.get("/api/me", { preHandler: app.authenticate }, async (request) => {
    const user = request.authUser!;
    const hospital = user.hospitalId
      ? await app.prisma.hospital.findUnique({
          where: { id: user.hospitalId },
          select: { id: true, name: true, slug: true, status: true },
        })
      : null;
    return { user, hospital };
  });
}
