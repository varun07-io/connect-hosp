import type { EnquiryIntent, EnquiryStatus, HospitalStatus } from "@connect-hospital/shared";

export interface HospitalSummary {
  id: string;
  name: string;
  slug: string;
  city: string;
  specialities: string[];
  photos: string[];
  accreditations: string[];
  startingPrice: number | null;
  startingTreatment?: string | null;
  currency: string;
  avgRating: number | null;
  reviewCount: number;
  doctorCount: number;
  depositRequired?: boolean;
  slaCallbackHours?: number;
  treatmentCount?: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface SearchFacets {
  categories: FacetBucket[];
  cities: FacetBucket[];
  priceRange: { min: number; max: number };
}

export interface HospitalSearchResponse {
  items: HospitalSummary[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
}

export interface Treatment {
  id: string;
  name: string;
  category: string;
}

export interface HospitalTreatmentPrice {
  id: string;
  indicativePrice: string;
  currency: string;
  notes: string | null;
  treatment: Treatment;
}

export interface DoctorSummary {
  id: string;
  specialisation: string;
  qualifications: string;
  experienceYears: number;
  bio: string | null;
  photoUrl: string | null;
  user: { name: string };
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface HospitalProfileResponse {
  id: string;
  name: string;
  slug: string;
  status: HospitalStatus;
  description: string | null;
  specialities: string[];
  facilities: string[];
  accreditations: string[];
  photos: string[];
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  depositRequired: boolean;
  depositAmountSurgery: number;
  depositAmountSecondOpinion: number;
  slaCallbackHours: number;
  doctors: DoctorSummary[];
  treatmentPrices: HospitalTreatmentPrice[];
  reviews: Review[];
  avgRating: number | null;
}

export type PaymentStatus = "PENDING" | "VERIFIED" | "FAILED" | "REFUND_INITIATED" | "REFUNDED";

export interface EnquiryListItem {
  id: string;
  intent: EnquiryIntent;
  status: EnquiryStatus;
  condition: string;
  preferredCallbackWindow: string;
  createdAt: string;
  updatedAt?: string;
  paymentRequired?: boolean;
  hospital?: { name: string; slug: string; city?: string; depositRequired?: boolean };
  patient?: { name: string; phone: string | null };
  treatment?: { name: string } | null;
  assignedDoctor?: { user: { name: string } } | null;
  payment?: { status: PaymentStatus; amount: number } | null;
  _count?: { attachments: number };
}

export interface EnquiryDetail {
  id: string;
  intent: EnquiryIntent;
  status: EnquiryStatus;
  condition: string;
  preferredCallbackWindow: string;
  callbackOutcome: "REACHED" | "NOT_REACHED" | "CALL_BACK_LATER" | null;
  callbackNotes: string | null;
  paymentRequired: boolean;
  createdAt: string;
  updatedAt: string;
  hospital: {
    name: string;
    slug: string;
    city: string;
    address: string;
    depositRequired: boolean;
    depositAmountSurgery: number;
    depositAmountSecondOpinion: number;
    slaCallbackHours: number;
  };
  treatment: { name: string; category: string } | null;
  assignedDoctor: {
    specialisation: string;
    qualifications: string;
    experienceYears: number;
    user: { name: string };
  } | null;
  statusHistory: { id: string; fromStatus: EnquiryStatus | null; toStatus: EnquiryStatus; note: string | null; createdAt: string }[];
  attachments: { medicalRecord: { id: string; title: string; category: string } }[];
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    verifiedAt: string | null;
    refunds: { id: string; amount: number; status: string; reason: string; createdAt: string }[];
  } | null;
}

export interface KycSummary {
  id?: string;
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  documents: { id: string; docType: string }[];
  rejectedReason?: string | null;
}

export interface MedicalRecordItem {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  mimeType: string;
  sizeBytes: number;
}

export interface HospitalMeResponse {
  id: string;
  name: string;
  slug: string;
  status: HospitalStatus;
  city: string;
  description: string | null;
  photos: string[];
  specialities: string[];
  facilities: string[];
  depositRequired: boolean;
  slaCallbackHours: number;
  _count: { doctors: number; enquiries: number; treatmentPrices: number };
}

/** Editable hospital profile + payment configuration (HSP-02). */
export interface HospitalSettings {
  id: string;
  name: string;
  slug: string;
  status: HospitalStatus;
  city: string;
  address: string;
  description: string | null;
  specialities: string[];
  facilities: string[];
  accreditations: string[];
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  depositRequired: boolean;
  depositAmountSurgery: number;
  depositAmountSecondOpinion: number;
  slaCallbackHours: number;
}

export interface MarketStat {
  min: number;
  max: number;
  avg: number;
  hospitals: number;
}

export interface HospitalPricesResponse {
  prices: { id: string; treatmentId: string; indicativePrice: number; currency: string; notes: string | null; treatment: Treatment }[];
  catalogue: Treatment[];
  market: Record<string, MarketStat>;
}

export interface HospitalDoctor {
  id: string;
  specialisation: string;
  qualifications: string;
  experienceYears: number;
  bio: string | null;
  user: { name: string; email: string | null };
  invitePending: boolean;
  openEnquiries: number;
}

export interface HospitalEnquiryDetail {
  id: string;
  intent: EnquiryIntent;
  status: EnquiryStatus;
  condition: string;
  preferredCallbackWindow: string;
  callbackOutcome: string | null;
  callbackNotes: string | null;
  paymentRequired: boolean;
  createdAt: string;
  patient: { name: string; phone: string | null; email: string | null };
  treatment: { name: string; category: string } | null;
  assignedDoctor: { id: string; specialisation: string; user: { name: string } } | null;
  statusHistory: { id: string; toStatus: EnquiryStatus; note: string | null; createdAt: string; actor: { name: string } | null }[];
  attachments: { medicalRecord: { id: string; title: string; category: string } }[];
  payment: { status: PaymentStatus; amount: number; verifiedAt: string | null } | null;
}

export interface VerificationQueueItem {
  id: string;
  name: string;
  city: string;
  address: string;
  description: string | null;
  specialities: string[];
  status: HospitalStatus;
  createdAt: string;
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  _count: { verificationDocs: number; doctors: number; treatmentPrices: number };
}

export interface VerificationDecisionResult {
  ok: true;
  status: HospitalStatus;
  admin: { created: boolean; email: string; note?: string } | null;
}

export interface SupportTicketItem {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  raisedBy: { name: string; role: string };
  assignedTo: { name: string } | null;
}

export interface AdminOverviewResponse {
  hospitals: number;
  patients: number;
  doctors: number;
  enquiries: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { name: string; role: string } | null;
}
