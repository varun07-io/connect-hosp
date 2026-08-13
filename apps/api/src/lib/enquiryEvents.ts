import type { PrismaClient } from "@prisma/client";
import type { EnquiryStatus, NotificationChannel } from "@connect-hospital/shared";
import { getNotificationProvider } from "./notifications/index.js";

/** BKG-06 status lifecycle — records the transition to the audit-friendly
 *  EnquiryStatusHistory table and updates the enquiry's current status. */
export async function transitionEnquiry(
  prisma: PrismaClient,
  params: { enquiryId: string; fromStatus: EnquiryStatus; toStatus: EnquiryStatus; actorId: string | null; note?: string },
) {
  await prisma.$transaction([
    prisma.enquiry.update({ where: { id: params.enquiryId }, data: { status: params.toStatus } }),
    prisma.enquiryStatusHistory.create({
      data: {
        enquiryId: params.enquiryId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        actorId: params.actorId,
        note: params.note,
      },
    }),
  ]);
}

/** NOT-01..05 — sends via whichever provider is configured (mock in the POC)
 *  and always leaves a Notification delivery-log row, win or lose. */
export async function notifyEnquiry(
  prisma: PrismaClient,
  params: { enquiryId: string; recipient: string; channel: NotificationChannel; template: string; data: Record<string, string> },
) {
  const provider = getNotificationProvider();
  const result = await provider.send({ channel: params.channel, recipient: params.recipient, template: params.template, data: params.data });
  await prisma.notification.create({
    data: {
      enquiryId: params.enquiryId,
      recipient: params.recipient,
      channel: params.channel,
      template: params.template,
      status: result.status,
      providerRef: result.providerRef,
      error: result.error,
      sentAt: result.status === "SENT" ? new Date() : null,
    },
  });
}
