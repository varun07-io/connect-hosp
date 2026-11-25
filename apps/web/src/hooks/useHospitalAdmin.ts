import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { toast } from "@/hooks/useToast";
import type { HospitalEnquiryDetail, HospitalPricesResponse, HospitalSettings } from "@/types/api";

/** Server validation errors arrive as zod `flatten()` output — surface the first readable one. */
export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong — please try again.";
  return err.message;
}

function onError(title: string) {
  return (err: unknown) => toast({ title, description: apiErrorMessage(err), variant: "destructive" });
}

export function useHospitalSettings() {
  return useQuery({ queryKey: ["hospital", "settings"], queryFn: () => apiFetch<HospitalSettings>("/api/hospital/profile") });
}

export function useUpdateHospitalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<HospitalSettings>) =>
      apiFetch<HospitalSettings>("/api/hospital/profile", { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital"] });
      toast({ title: "Changes saved", description: "Patients will see them on your profile right away.", variant: "success" });
    },
    onError: onError("Couldn't save changes"),
  });
}

export function useHospitalPrices() {
  return useQuery({ queryKey: ["hospital", "prices"], queryFn: () => apiFetch<HospitalPricesResponse>("/api/hospital/prices") });
}

export function useSavePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ treatmentId, indicativePrice, notes }: { treatmentId: string; indicativePrice: number; notes?: string }) =>
      apiFetch(`/api/hospital/prices/${treatmentId}`, { method: "PUT", body: JSON.stringify({ indicativePrice, notes }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital"] });
      toast({ title: "Price saved", variant: "success" });
    },
    onError: onError("Couldn't save price"),
  });
}

export function useRemovePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treatmentId: string) => apiFetch(`/api/hospital/prices/${treatmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital"] });
      toast({ title: "Treatment removed from your price list" });
    },
    onError: onError("Couldn't remove price"),
  });
}

export interface DoctorInput {
  name: string;
  email: string;
  specialisation: string;
  qualifications: string;
  experienceYears: number;
  bio?: string;
}

export function useInviteDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DoctorInput) => apiFetch("/api/hospital/doctors", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital"] });
      toast({ title: "Doctor added", description: "We've emailed them an invite to sign in.", variant: "success" });
    },
    onError: onError("Couldn't add doctor"),
  });
}

export function useUpdateDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<Omit<DoctorInput, "name" | "email">> & { id: string }) =>
      apiFetch(`/api/hospital/doctors/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital"] });
      toast({ title: "Doctor profile updated", variant: "success" });
    },
    onError: onError("Couldn't update doctor"),
  });
}

export function useHospitalEnquiry(id: string | null) {
  return useQuery({
    queryKey: ["hospital", "enquiries", id],
    queryFn: () => apiFetch<HospitalEnquiryDetail>(`/api/hospital/enquiries/${id}`),
    enabled: Boolean(id),
  });
}

export interface RegisterHospitalInput {
  name: string;
  city: string;
  address: string;
  description?: string;
  specialities: string[];
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  website?: string;
}

export function useRegisterHospital() {
  return useMutation({
    mutationFn: (input: RegisterHospitalInput) =>
      apiFetch<{ reference: string; name: string }>("/api/hospitals/register", { method: "POST", body: JSON.stringify(input) }),
  });
}
