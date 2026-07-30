import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./routes/health.js";
import meRoutes from "./routes/me.js";
import hospitalRoutes from "./routes/hospitals.js";
import patientRoutes from "./routes/patient.js";
import hospitalDashboardRoutes from "./routes/hospitalDashboard.js";
import doctorRoutes from "./routes/doctor.js";
import verificationRoutes from "./routes/verification.js";
import supportRoutes from "./routes/support.js";
import adminRoutes from "./routes/admin.js";
import filesRoutes from "./routes/files.js";
import devRoutes from "./routes/dev.js";
import authBootstrapRoutes from "./routes/authBootstrap.js";

const app = Fastify({
  logger:
    env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
      : true,
});

app.setErrorHandler((error, request, reply) => {
  const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
  if (statusCode >= 500) request.log.error(error);
  reply.code(statusCode).send({ error: error.message || "Internal server error" });
});

await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
await app.register(prismaPlugin);
await app.register(authPlugin);

await app.register(healthRoutes);
await app.register(meRoutes);
await app.register(hospitalRoutes);
await app.register(patientRoutes);
await app.register(hospitalDashboardRoutes);
await app.register(doctorRoutes);
await app.register(verificationRoutes);
await app.register(supportRoutes);
await app.register(adminRoutes);
await app.register(filesRoutes);
await app.register(devRoutes);
await app.register(authBootstrapRoutes);

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then((address) => app.log.info(`Connect Hospital API listening on ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
