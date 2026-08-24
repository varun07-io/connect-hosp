import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
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
import fieldExecutiveRoutes from "./routes/fieldExecutive.js";
import paymentsRoutes from "./routes/payments.js";
import kycRoutes from "./routes/kyc.js";
import { runSlaRefundJob } from "./lib/slaRefundJob.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

const app = Fastify({
  logger:
    env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
      : true,
});

// Store raw body for Razorpay webhook HMAC verification.
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
  try {
    const rawBuf = body as Buffer;
    _req.rawBody = rawBuf;
    // Empty body is valid for bodyless routes (DELETE, etc.) — don't JSON.parse it.
    done(null, rawBuf.length > 0 ? JSON.parse(rawBuf.toString()) : undefined);
  } catch (e) {
    done(e as Error, undefined);
  }
});

app.setErrorHandler((error, request, reply) => {
  const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
  if (statusCode >= 500) request.log.error(error);
  reply.code(statusCode).send({ error: error.message || "Internal server error" });
});

await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB per KYC doc
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
await app.register(fieldExecutiveRoutes);
await app.register(paymentsRoutes);
await app.register(kycRoutes);

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then((address) => {
    app.log.info(`Connect Hospital API listening on ${address}`);
    // SLA refund check every hour.
    setInterval(() => runSlaRefundJob(app.prisma).catch((e) => app.log.error(e, "SLA refund job error")), 60 * 60 * 1000);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
