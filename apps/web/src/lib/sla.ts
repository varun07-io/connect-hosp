import type { EnquiryStatus } from "@connect-hospital/shared";

/** Statuses where the hospital still owes the patient a first call. */
export const AWAITING_CALLBACK: EnquiryStatus[] = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "REOPENED"];

export type SlaTone = "ok" | "soon" | "overdue";

/** Callback-deadline state for an enquiry: `createdAt + slaCallbackHours`. */
export function slaState(createdAt: string, status: EnquiryStatus, slaHours: number, now = Date.now()) {
  if (!AWAITING_CALLBACK.includes(status)) return null;
  const deadline = new Date(createdAt).getTime() + slaHours * 3_600_000;
  const msLeft = deadline - now;
  const tone: SlaTone = msLeft < 0 ? "overdue" : msLeft < Math.min(4 * 3_600_000, slaHours * 900_000) ? "soon" : "ok";
  return { deadline, msLeft, tone, label: msLeft < 0 ? `Overdue ${duration(-msLeft)}` : `Call within ${duration(msLeft)}` };
}

function duration(ms: number) {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h${mins % 60 && hours < 6 ? ` ${mins % 60}m` : ""}`;
  return `${Math.round(hours / 24)}d`;
}
