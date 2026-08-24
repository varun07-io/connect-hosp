/** Platform roles. One user row = one role. Hospital-scoped roles also carry a hospitalId. */
export const ROLES = [
  "PATIENT",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "VERIFICATION",
  "SUPPORT",
  "SUPER_ADMIN",
  "FIELD_EXECUTIVE_HOSPITAL",
  "FIELD_EXECUTIVE_CONNECT",
  "FE_MANAGER",
] as const;
export type Role = (typeof ROLES)[number];

export const HOSPITAL_SCOPED_ROLES: Role[] = ["HOSPITAL_ADMIN", "DOCTOR", "FIELD_EXECUTIVE_HOSPITAL"];
export const FE_ROLES: Role[] = ["FIELD_EXECUTIVE_HOSPITAL", "FIELD_EXECUTIVE_CONNECT", "FE_MANAGER"];

export const PAYMENT_STATUSES = ["PENDING", "VERIFIED", "FAILED", "REFUND_INITIATED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_TYPES = ["SLA_AUTO", "PATIENT_CANCEL", "DISPUTE", "MANUAL"] as const;
export type RefundType = (typeof REFUND_TYPES)[number];

export const REFUND_STATUSES = ["INITIATED", "PROCESSING", "COMPLETED", "FAILED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const KYC_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const KYC_TYPES = ["PATIENT", "STAFF"] as const;
export type KycType = (typeof KYC_TYPES)[number];

export const KYC_METHODS = ["DIGILOCKER", "MANUAL"] as const;
export type KycMethod = (typeof KYC_METHODS)[number];

export const KYC_DOC_TYPES = ["AADHAAR", "PAN", "VOTER_ID", "PASSPORT", "MCI_CERT", "HOSPITAL_AUTH", "EMPLOYEE_ID"] as const;
export type KycDocType = (typeof KYC_DOC_TYPES)[number];

export const FE_TYPES = ["HOSPITAL", "CONNECT_HOSPITAL"] as const;
export type FeType = (typeof FE_TYPES)[number];

export const FE_STATUS = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type FeStatus = (typeof FE_STATUS)[number];

export const FOLLOW_UP_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ESCALATED"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_ACTION_TYPES = ["PHONE_CALL", "PHYSICAL_VISIT", "DOCUMENT_COLLECTED", "ADMISSION_CONFIRMED", "OTHER"] as const;
export type FollowUpActionType = (typeof FOLLOW_UP_ACTION_TYPES)[number];

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
