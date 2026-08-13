import { z } from "zod";
import {
  ENQUIRY_INTENTS,
  RECORD_CATEGORIES,
  ROLES,
} from "./enums.js";

/** PAT-02 profile management */
export const patientProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
  email: z.string().trim().email().optional(),
});
export type PatientProfileInput = z.infer<typeof patientProfileSchema>;

/** BKG-01/02 booking form */
export const createEnquirySchema = z.object({
  hospitalId: z.string().cuid(),
  intent: z.enum(ENQUIRY_INTENTS),
  treatmentId: z.string().cuid().optional(),
  condition: z.string().trim().min(1).max(2000),
  preferredCallbackWindow: z.string().trim().min(1).max(120),
  recordIds: z.array(z.string().cuid()).max(20).default([]),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Consent to share details with the hospital is required" }),
  }),
});
export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

/** VLT-02 vault record metadata */
export const uploadRecordSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(RECORD_CATEGORIES),
  recordedAt: z.coerce.date().optional(),
});
export type UploadRecordInput = z.infer<typeof uploadRecordSchema>;

/** VER-01 hospital registration */
export const registerHospitalSchema = z.object({
  name: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactPersonName: z.string().trim().min(1).max(120),
  contactPersonPhone: z.string().trim().regex(/^\+?[0-9]{10,15}$/),
  contactPersonEmail: z.string().trim().email(),
  description: z.string().trim().max(4000).optional(),
});
export type RegisterHospitalInput = z.infer<typeof registerHospitalSchema>;

/** DIS-02 search/filter params */
export const searchHospitalsSchema = z.object({
  city: z.string().trim().optional(),
  treatmentId: z.string().cuid().optional(),
  /** Comma-separated so multi-select stays in a shareable URL: ?categories=Knee,Heart.
   *  `category` (singular) is still accepted for older links and merged in. */
  categories: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  category: z.string().trim().optional(),
  minBudget: z.coerce.number().nonnegative().optional(),
  maxBudget: z.coerce.number().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["recommended", "cost_asc", "cost_desc", "rating_desc"]).default("recommended"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchHospitalsInput = z.infer<typeof searchHospitalsSchema>;

/** ADM-01 staff user creation (hospital admin / doctor / verification / support / super admin) */
export const createStaffUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  role: z.enum(ROLES).exclude(["PATIENT"]),
  hospitalId: z.string().cuid().optional(),
});
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;

/** DOC-04 callback logging */
export const logCallbackSchema = z.object({
  outcome: z.enum(["REACHED", "NOT_REACHED", "CALL_BACK_LATER"]),
  notes: z.string().trim().min(1).max(4000),
});
export type LogCallbackInput = z.infer<typeof logCallbackSchema>;
