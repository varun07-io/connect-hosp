import type { PrismaClient } from "@prisma/client";

/**
 * SLA auto-refund job — runs periodically and refunds deposits for enquiries
 * where no callback was made within the hospital's slaCallbackHours window.
 *
 * Call this from a cron/setInterval in your application startup.
 */
export async function runSlaRefundJob(prisma: PrismaClient): Promise<void> {
  // Find verified payments whose enquiry is still in NEW/ACKNOWLEDGED status
  // and the hospital's SLA window has elapsed since the enquiry was created.
  const candidates = await prisma.payment.findMany({
    where: { status: "VERIFIED" },
    include: {
      enquiry: {
        include: {
          hospital: { select: { slaCallbackHours: true } },
        },
      },
    },
  });

  const now = new Date();

  for (const payment of candidates) {
    // payment.enquiry is a single Enquiry (one-to-one via Enquiry.paymentId)
    const enquiry = payment.enquiry;
    if (!enquiry) continue;
    if (!["NEW", "ACKNOWLEDGED"].includes(enquiry.status)) continue;

    const slaMs = (enquiry.hospital.slaCallbackHours ?? 48) * 60 * 60 * 1000;
    const elapsed = now.getTime() - enquiry.createdAt.getTime();
    if (elapsed < slaMs) continue;

    // Mark refund initiated — actual gateway call would be triggered here in production.
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REFUND_INITIATED" },
      }),
      prisma.paymentRefund.create({
        data: {
          paymentId: payment.id,
          amount: payment.amount,
          reason: `SLA breach: no callback within ${enquiry.hospital.slaCallbackHours}h`,
          refundType: "SLA_AUTO",
          status: "INITIATED",
        },
      }),
    ]);
  }
}
