import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import type {
  AdminOverviewResponse,
  AuditLogItem,
  EnquiryListItem,
  HospitalMeResponse,
  HospitalProfileResponse,
  HospitalSearchResponse,
  MedicalRecordItem,
  SupportTicketItem,
  Treatment,
  VerificationQueueItem,
} from "@/types/api";

export interface HospitalSearchParams {
  [key: string]: string | number | undefined;
  city?: string;
  treatmentId?: string;
  /** Comma-separated list — see searchHospitalsSchema in packages/shared. */
  categories?: string;
  minBudget?: number;
  maxBudget?: number;
  minRating?: number;
  sort?: string;
  page?: number;
}

function toQueryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function useHospitalSearch(params: HospitalSearchParams) {
  return useQuery({
    queryKey: ["hospitals", params],
    queryFn: () => apiFetch<HospitalSearchResponse>(`/api/hospitals${toQueryString(params)}`),
    // Keeps the previous page's results (and facet counts) visible while a new
    // filter combination loads, instead of flashing an empty list on every click.
    placeholderData: (previous) => previous,
  });
}

export function useHospitalProfile(slug: string | undefined) {
  return useQuery({
    queryKey: ["hospital", slug],
    queryFn: () => apiFetch<HospitalProfileResponse>(`/api/hospitals/${slug}`),
    enabled: Boolean(slug),
  });
}

export function useTreatments() {
  return useQuery({ queryKey: ["treatments"], queryFn: () => apiFetch<Treatment[]>("/api/treatments") });
}

export function usePatientEnquiries() {
  return useQuery({ queryKey: ["patient", "enquiries"], queryFn: () => apiFetch<EnquiryListItem[]>("/api/patient/enquiries") });
}

export function usePatientRecords() {
  return useQuery({ queryKey: ["patient", "records"], queryFn: () => apiFetch<MedicalRecordItem[]>("/api/patient/records") });
}

export function useHospitalMe() {
  return useQuery({ queryKey: ["hospital", "me"], queryFn: () => apiFetch<HospitalMeResponse>("/api/hospital/me") });
}

export function useHospitalEnquiries() {
  return useQuery({ queryKey: ["hospital", "enquiries"], queryFn: () => apiFetch<EnquiryListItem[]>("/api/hospital/enquiries") });
}

export function useDoctorEnquiries() {
  return useQuery({ queryKey: ["doctor", "enquiries"], queryFn: () => apiFetch<EnquiryListItem[]>("/api/doctor/enquiries") });
}

export function useVerificationQueue() {
  return useQuery({ queryKey: ["verification", "queue"], queryFn: () => apiFetch<VerificationQueueItem[]>("/api/verification/queue") });
}

export function useSupportTickets() {
  return useQuery({ queryKey: ["support", "tickets"], queryFn: () => apiFetch<SupportTicketItem[]>("/api/support/tickets") });
}

export function useAdminOverview() {
  return useQuery({ queryKey: ["admin", "overview"], queryFn: () => apiFetch<AdminOverviewResponse>("/api/admin/overview") });
}

export function useAuditLog() {
  return useQuery({ queryKey: ["admin", "audit-log"], queryFn: () => apiFetch<AuditLogItem[]>("/api/admin/audit-log") });
}
