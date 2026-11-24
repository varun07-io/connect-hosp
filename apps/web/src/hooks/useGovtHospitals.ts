import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GovtHospitalImportInput, GovtHospitalImportResult } from "@connect-hospital/shared";
import { apiFetch } from "@/lib/apiClient";

export interface GovtHospital {
  id: string;
  key: string;
  refId: string | null;
  name: string;
  district: string;
  taluk: string | null;
  address: string | null;
  specialities: string[];
  subType: string | null;
  updatedAt: string;
}

export interface GovtHospitalList {
  items: GovtHospital[];
  total: number;
  lastUpdated: string | null;
}

export function useGovtHospitals() {
  return useQuery({
    queryKey: ["govt-hospitals"],
    queryFn: () => apiFetch<GovtHospitalList>("/api/govt-hospitals"),
    staleTime: 5 * 60_000,
  });
}

export function useImportGovtHospitals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GovtHospitalImportInput) =>
      apiFetch<GovtHospitalImportResult>("/api/admin/govt-hospitals/import", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["govt-hospitals"] }),
  });
}
