import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { env } from "../env.js";
import { recordAudit } from "../lib/audit.js";
import { onBookingPaid } from "../lib/feAssignmentEngine.js";
import { notifyEnquiry } from "../lib/enquiryEvents.js";

function getRazorpay(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

const createOrderSchema = z.object({
  enquiryId: z.string().min(1),
});

const refundSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
  refundType: z.enum(["SLA_AUTO", "PATIENT_CANCEL", "DISPUTE", "MANUAL"]),
});

/** Payment module — Razorpay order creation, webhook verification, and refund management. */
export default async function paymentsRoutes(app: FastifyInstance) {
  /** Create a Razorpay order for an enquiry deposit. */
  app.post(
    "/api/payments/orders",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      const parsed = createOrderSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      // KYC gate — block paid bookings until identity is verified (AC-K01).
      const payer = await app.prisma.user.findUnique({ where: { id: request.authUser!.id }, select: { kycStatus: true } });
      if (!payer || payer.kycStatus !== "VERIFIED") {
        return reply.code(403).send({ error: "KYC verification required before making a paid booking. Please complete identity verification in your dashboard." });
      }

      const enquiry = await app.prisma.enquiry.findFirst({
        where: { id: parsed.data.enquiryId, patientId: request.authUser!.id },
        include: { hospital: true },
      });
      if (!enquiry) return reply.code(404).send({ error: "Enquiry not found" });
      if (!enquiry.hospital.depositRequired) return reply.code(400).send({ error: "No deposit required for this hospital" });
      if (enquiry.paymentId) return reply.code(409).send({ error: "Payment already initiated" });

      const depositAmount =
        enquiry.intent === "SURGERY"
          ? enquiry.hospital.depositAmountSurgery
          : enquiry.hospital.depositAmountSecondOpinion;

      const rz = getRazorpay();
      const order = await rz.orders.create({
        amount: depositAmount * 100, // paise
        currency: "INR",
        receipt: enquiry.id,
      });

      const payment = await app.prisma.payment.create({
        data: {
          amount: depositAmount,
          currency: "INR",
          gateway: "razorpay",
          gatewayOrderId: order.id,
          status: "PENDING",
        },
      });

      await app.prisma.enquiry.update({
        where: { id: enquiry.id },
        data: { paymentId: payment.id },
      });

      return {
        orderId: order.id,
        amount: depositAmount,
        currency: "INR",
        keyId: env.RAZORPAY_KEY_ID,
      };
    },
  );

  /** Verify payment after Razorpay checkout completes (client-side callback). */
  app.post(
    "/api/payments/verify",
    { preHandler: app.requireRole("PATIENT") },
    async (request, reply) => {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = request.body as Record<string, string>;
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return reply.code(400).send({ error: "Missing verification fields" });
      }

      if (!env.RAZORPAY_KEY_SECRET) return reply.code(503).send({ error: "Payment gateway not configured" });

      const expectedSig = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      const sigBuffer = Buffer.from(razorpaySignature, "hex");
      const expectedBuffer = Buffer.from(expectedSig, "hex");
      const isValid = sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);

      if (!isValid) return reply.code(400).send({ error: "Invalid payment signature" });

      const payment = await app.prisma.payment.findFirst({ where: { gatewayOrderId: razorpayOrderId } });
      if (!payment) return reply.code(404).send({ error: "Payment record not found" });

      await app.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "VERIFIED", gatewayPaymentId: razorpayPaymentId, verifiedAt: new Date() },
      });

      // Trigger FE assignment for the linked enquiry (fire-and-forget).
      const enquiry = await app.prisma.enquiry.findFirst({ where: { paymentId: payment.id } });
      if (enquiry) onBookingPaid(app.prisma, enquiry.id).catch(() => null);

      return { verified: true };
    },
  );

  /** Razorpay webhook endpoint — receives async payment events and archives payload. */
  app.post(
    "/api/payments/webhook",
    async (request, reply) => {
      if (!env.RAZORPAY_WEBHOOK_SECRET) return reply.code(200).send({ received: true });

      const sig = request.headers["x-razorpay-signature"] as string | undefined;
      if (!sig) return reply.code(400).send({ error: "Missing signature" });

      const body = request.rawBody;
      if (!body) return reply.code(400).send({ error: "Missing body" });
      const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");

      const sigBuf = Buffer.from(sig, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return reply.code(400).send({ error: "Invalid webhook signature" });
      }

      const event = request.body as { event: string; payload: { payment?: { entity?: { order_id?: string; id?: string } } } };

      if (event.event === "payment.captured") {
        const orderId = event.payload?.payment?.entity?.order_id;
        const paymentId = event.payload?.payment?.entity?.id;
        if (orderId) {
          await app.prisma.payment.updateMany({
            where: { gatewayOrderId: orderId, status: "PENDING" },
            data: { status: "VERIFIED", gatewayPaymentId: paymentId, verifiedAt: new Date(), webhookPayload: event as object },
          });
          // Advance the linked enquiry from any pre-active state to NEW and notify hospital.
          const payment = await app.prisma.payment.findFirst({ where: { gatewayOrderId: orderId } });
          if (payment) {
            const enquiry = await app.prisma.enquiry.findFirst({
              where: { paymentId: payment.id },
              include: { hospital: true, patient: { select: { name: true, email: true } } },
            });
            if (enquiry && !["GUIDED", "CANCELLED", "NO_RESPONSE"].includes(enquiry.status)) {
              await app.prisma.enquiry.update({ where: { id: enquiry.id }, data: { status: "NEW" } });
              // Notify hospital of new paid booking.
              await notifyEnquiry(app.prisma, {
                enquiryId: enquiry.id,
                recipient: enquiry.hospital.contactPersonPhone,
                channel: "SMS",
                template: "new_enquiry",
                data: { hospitalName: enquiry.hospital.name, patientName: enquiry.patient?.name ?? "Patient" },
              });
              await notifyEnquiry(app.prisma, {
                enquiryId: enquiry.id,
                recipient: enquiry.hospital.contactPersonEmail,
                channel: "EMAIL",
                template: "new_enquiry",
                data: { hospitalName: enquiry.hospital.name, patientName: enquiry.patient?.name ?? "Patient" },
              });
            }
          }
        }
      }

      if (event.event === "payment.failed") {
        const orderId = event.payload?.payment?.entity?.order_id;
        if (orderId) {
          await app.prisma.payment.updateMany({
            where: { gatewayOrderId: orderId },
            data: { status: "FAILED", webhookPayload: event as object },
          });
        }
      }

      return reply.code(200).send({ received: true });
    },
  );

  /** Initiate a refund for a verified payment. */
  app.post(
    "/api/payments/refunds",
    { preHandler: app.requireRole("SUPER_ADMIN", "SUPPORT") },
    async (request, reply) => {
      const parsed = refundSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const payment = await app.prisma.payment.findUnique({ where: { id: parsed.data.paymentId } });
      if (!payment) return reply.code(404).send({ error: "Payment not found" });
      if (payment.status !== "VERIFIED") return reply.code(400).send({ error: "Only verified payments can be refunded" });

      const rz = getRazorpay();
      let gatewayRefundId: string | undefined;
      if (payment.gatewayPaymentId) {
        const refund = await rz.payments.refund(payment.gatewayPaymentId, { amount: payment.amount * 100 });
        gatewayRefundId = refund.id;
      }

      await app.prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUND_INITIATED" } });

      const record = await app.prisma.paymentRefund.create({
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          reason: parsed.data.reason,
          refundType: parsed.data.refundType,
          status: "INITIATED",
          initiatedById: request.authUser!.id,
          gatewayRefundId,
        },
      });

      await recordAudit(app.prisma, {
        actorId: request.authUser!.id,
        action: "REFUND_INITIATED",
        entityType: "Payment",
        entityId: payment.id,
        before: { status: "VERIFIED" },
        after: { status: "REFUND_INITIATED", gatewayRefundId },
      });

      return reply.code(201).send(record);
    },
  );

  /** List all payments (admin). */
  app.get(
    "/api/admin/payments",
    { preHandler: app.requireRole("SUPER_ADMIN", "SUPPORT") },
    async () => {
      return app.prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        include: { refunds: true },
      });
    },
  );
}
