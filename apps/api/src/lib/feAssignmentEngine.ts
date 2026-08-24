import type { PrismaClient } from "@prisma/client";

/**
 * FE assignment engine — listens for newly completed/paid enquiries and creates
 * a FeBookingQueue entry, then round-robins assignment to an available FE.
 *
 * In production, wire this to a message queue or Prisma middleware. For dev,
 * call it directly after an enquiry payment is verified.
 */
export async function onBookingPaid(prisma: PrismaClient, enquiryId: string): Promise<void> {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { hospital: true, feQueue: true },
  });
  if (!enquiry) return;
  if (enquiry.feQueue) return; // already queued
  // Only expose to FEs once the enquiry is actually closed/guided.
  if (enquiry.status !== "GUIDED") return;

  // Find an active FIELD_EXECUTIVE_HOSPITAL assigned to the same hospital, or
  // fall back to a FIELD_EXECUTIVE_CONNECT.
  const candidates = await prisma.fieldExecutive.findMany({
    where: {
      status: "ACTIVE",
      isDeleted: false,
      OR: [{ feType: "HOSPITAL", hospitalId: enquiry.hospitalId }, { feType: "CONNECT_HOSPITAL" }],
    },
    include: {
      _count: { select: { assignedBookings: { where: { followUpStatus: { in: ["NOT_STARTED", "IN_PROGRESS"] } } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Pick the FE with the fewest open assignments (load-balance).
  const chosen = candidates.sort((a, b) => a._count.assignedBookings - b._count.assignedBookings)[0];

  const queue = await prisma.feBookingQueue.create({
    data: {
      feId: chosen?.id ?? null,
      assignedAt: chosen ? new Date() : null,
      followUpStatus: "NOT_STARTED",
    },
  });

  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { feQueueId: queue.id },
  });
}
