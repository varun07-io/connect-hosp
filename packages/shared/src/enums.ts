/** Platform roles. One user row = one role. Hospital-scoped roles also carry a hospitalId. */
export const ROLES = [
  "PATIENT",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "VERIFICATION",
  "SUPPORT",
  "SUPER_ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

export const HOSPITAL_SCOPED_ROLES: Role[] = ["HOSPITAL_ADMIN", "DOCTOR"];

export const HOSPITAL_STATUSES = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"] as const;
export type HospitalStatus = (typeof HOSPITAL_STATUSES)[number];

export const ENQUIRY_INTENTS = ["SURGERY", "SECOND_OPINION"] as const;
export type EnquiryIntent = (typeof ENQUIRY_INTENTS)[number];

/** Shared vocabulary per scope doc Section 7: New -> Acknowledged -> Assigned -> Contacted -> Guided/Closed,
 *  with side states Cancelled / No-response / Re-opened. */
export const ENQUIRY_STATUSES = [
  "NEW",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "CONTACTED",
  "GUIDED",
  "CLOSED",
  "CANCELLED",
  "NO_RESPONSE",
  "REOPENED",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ["SMS", "WHATSAPP", "EMAIL", "IN_APP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["QUEUED", "SENT", "DELIVERED", "FAILED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const RECORD_CATEGORIES = ["LAB_REPORT", "PRESCRIPTION", "IMAGING", "OTHER"] as const;
export type RecordCategory = (typeof RECORD_CATEGORIES)[number];

export const VERIFICATION_DECISIONS = ["APPROVED", "REJECTED", "INFO_REQUESTED"] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

export const CALLBACK_OUTCOMES = ["REACHED", "NOT_REACHED", "CALL_BACK_LATER"] as const;
export type CallbackOutcome = (typeof CALLBACK_OUTCOMES)[number];
