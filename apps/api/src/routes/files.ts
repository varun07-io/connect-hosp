import type { FastifyInstance } from "fastify";
import { LocalDiskStorageProvider } from "../lib/storage/localDiskProvider.js";
import { verifySignedDownload } from "../lib/storage/index.js";

/** Serves the expiring, signed links LocalDiskStorageProvider issues (VLT-06 in dev mode). */
export default async function filesRoutes(app: FastifyInstance) {
  app.get("/files/download", async (request, reply) => {
    const { key, exp, token } = request.query as { key?: string; exp?: string; token?: string };
    if (!key || !exp || !token || !verifySignedDownload(key, Number(exp), token)) {
      return reply.code(403).send({ error: "Invalid or expired link" });
    }
    const provider = new LocalDiskStorageProvider();
    try {
      const buffer = await provider.readObject(key);
      reply.header("Cache-Control", "private, max-age=0, no-store");
      return reply.send(buffer);
    } catch {
      return reply.code(404).send({ error: "File not found" });
    }
  });
}
