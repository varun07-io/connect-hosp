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
  currency: string;
  avgRating: number | null;
  reviewCount: number;
  doctorCount: number;
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
  doctors: DoctorSummary[];
  treatmentPrices: HospitalTreatmentPrice[];
  reviews: Review[];
  avgRating: number | null;
}

export interface EnquiryListItem {
  id: string;
  intent: EnquiryIntent;
  status: EnquiryStatus;
  condition: string;
  preferredCallbackWindow: string;
  createdAt: string;
  hospital?: { name: string; slug: string };
  patient?: { name: string; phone: string | null };
  treatment?: { name: string } | null;
  assignedDoctor?: { user: { name: string } } | null;
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
  _count: { doctors: number; enquiries: number; treatmentPrices: number };
}

export interface VerificationQueueItem {
  id: string;
  name: string;
  city: string;
  status: HospitalStatus;
  createdAt: string;
  contactPersonName: string;
  contactPersonEmail: string;
  _count: { verificationDocs: number };
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
