import type { EnquiryStatus } from "@connect-hospital/shared";

/** The patient-facing journey. Internal statuses (BKG-06) map onto these five
 *  milestones so patients always see "where am I, what happens next" rather
 *  than raw workflow states. */
export const JOURNEY_STEPS = [
  { key: "sent", label: "Request sent" },
  { key: "review", label: "Hospital reviewing" },
  { key: "doctor", label: "Doctor assigned" },
  { key: "call", label: "Doctor call" },
  { key: "guided", label: "Guided" },
] as const;

const STAGE_INDEX: Record<EnquiryStatus, number> = {
  NEW: 0,
  ACKNOWLEDGED: 1,
  REOPENED: 1,
  ASSIGNED: 2,
  CONTACTED: 3,
  NO_RESPONSE: 3,
  GUIDED: 4,
  CLOSED: 4,
  CANCELLED: -1,
};

export function journeyStage(status: EnquiryStatus) {
  return STAGE_INDEX[status];
}

export const ACTIVE_STATUSES: EnquiryStatus[] = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "CONTACTED", "NO_RESPONSE", "REOPENED"];
export const PATIENT_CANCELLABLE: EnquiryStatus[] = ACTIVE_STATUSES;

export function isActive(status: EnquiryStatus) {
  return ACTIVE_STATUSES.includes(status);
}

/** Patient-friendly status label (staff dashboards keep the raw vocabulary). */
export const PATIENT_STATUS_LABEL: Record<EnquiryStatus, string> = {
  NEW: "Sent to hospital",
  ACKNOWLEDGED: "Hospital reviewing",
  REOPENED: "Re-opened",
  ASSIGNED: "Doctor assigned",
  CONTACTED: "Doctor in touch",
  NO_RESPONSE: "Missed call",
  GUIDED: "Guided",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export type Tone = "primary" | "success" | "warning" | "muted" | "destructive";

export function statusTone(status: EnquiryStatus): Tone {
  if (status === "GUIDED" || status === "CLOSED") return "success";
  if (status === "NO_RESPONSE") return "warning";
  if (status === "CANCELLED") return "muted";
  return "primary";
}

/** Headline + next-step copy for the current state. */
export function nextStepCopy(
  status: EnquiryStatus,
  ctx: { hospitalName: string; doctorName?: string | null; callbackWindow: string },
): { title: string; body: string } {
  switch (status) {
    case "NEW":
      return {
        title: `Sent to ${ctx.hospitalName}`,
        body: "The hospital's care desk will review your request and match you with the right doctor.",
      };
    case "ACKNOWLEDGED":
    case "REOPENED":
      return {
        title: "The hospital is reviewing your request",
        body: "They're matching you with a doctor for your condition. You'll be notified as soon as one is assigned.",
      };
    case "ASSIGNED":
      return {
        title: `${ctx.doctorName ?? "Your doctor"} will call you`,
        body: `Expect a call during your preferred window (${ctx.callbackWindow}). Keep your phone handy and your reports nearby.`,
      };
    case "CONTACTED":
      return {
        title: "You're in conversation with your doctor",
        body: "Your doctor has been in touch and will follow up with the recommended next step.",
      };
    case "NO_RESPONSE":
      return {
        title: "We couldn't reach you",
        body: "The doctor tried calling but couldn't get through. They'll try again — make sure calls from unknown numbers aren't blocked.",
      };
    case "GUIDED":
      return {
        title: "You've been guided by your doctor",
        body: "A care coordinator will help you with admission, documents and scheduling from here.",
      };
    case "CLOSED":
      return { title: "This enquiry is closed", body: "Need more help? Start a new enquiry any time." };
    case "CANCELLED":
      return { title: "This enquiry was cancelled", body: "You can book again with this or any other hospital whenever you're ready." };
  }
}

/** Common callback windows, offered as one-tap chips in the booking flow. */
export const CALLBACK_WINDOWS = [
  "Anytime today",
  "Weekdays, 10am – 1pm",
  "Weekdays, 2pm – 6pm",
  "Evenings after 6pm",
  "Weekends",
];
