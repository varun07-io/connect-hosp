import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { toast } from "@/hooks/useToast";
import type { EnquiryIntent, CallbackOutcome } from "@connect-hospital/shared";
import type { HospitalDoctor, VerificationDecisionResult } from "@/types/api";

export type HospitalDoctorOption = HospitalDoctor;

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "Something went wrong — please try again.";
}

export function useHospitalDoctors() {
  return useQuery({
    queryKey: ["hospital", "doctors"],
    queryFn: () => apiFetch<HospitalDoctorOption[]>("/api/hospital/doctors"),
  });
}

export function useCreateEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      hospitalId: string;
      intent: EnquiryIntent;
      treatmentId?: string;
      condition: string;
      preferredCallbackWindow: string;
      recordIds?: string[];
      consentAccepted: true;
    }) => apiFetch<{ id: string }>("/api/patient/enquiries", { method: "POST", body: JSON.stringify({ recordIds: [], ...input }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", "enquiries"] });
    },
    onError: (err) => toast({ title: "Couldn't send enquiry", description: errorMessage(err), variant: "destructive" }),
  });
}

export function useCancelEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enquiryId, reason }: { enquiryId: string; reason?: string }) =>
      apiFetch<{ ok: true; refundQueued: boolean }>(`/api/patient/enquiries/${enquiryId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patient"] });
      toast({
        title: "Enquiry cancelled",
        description: data.refundQueued ? "Your deposit refund has been initiated — it usually lands in 5–7 working days." : "The hospital has been informed.",
        variant: "success",
      });
    },
    onError: (err) => toast({ title: "Couldn't cancel enquiry", description: errorMessage(err), variant: "destructive" }),
  });
}

export function useAcknowledgeEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enquiryId: string) => apiFetch(`/api/hospital/enquiries/${enquiryId}/acknowledge`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
      toast({ title: "Enquiry acknowledged", variant: "success" });
    },
    onError: (err) => toast({ title: "Couldn't acknowledge enquiry", description: errorMessage(err), variant: "destructive" }),
  });
}

export function useAssignEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enquiryId, doctorId }: { enquiryId: string; doctorId: string }) =>
      apiFetch(`/api/hospital/enquiries/${enquiryId}/assign`, { method: "PATCH", body: JSON.stringify({ doctorId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
      toast({ title: "Doctor assigned", description: "They've been notified and will call the patient.", variant: "success" });
    },
    onError: (err) => toast({ title: "Couldn't assign doctor", description: errorMessage(err), variant: "destructive" }),
  });
}

export function useLogCallback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enquiryId, outcome, notes }: { enquiryId: string; outcome: CallbackOutcome; notes: string }) =>
      apiFetch(`/api/doctor/enquiries/${enquiryId}/callback`, { method: "PATCH", body: JSON.stringify({ outcome, notes }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor", "enquiries"] });
      toast({ title: "Callback logged", variant: "success" });
    },
    onError: (err) => toast({ title: "Couldn't log callback", description: errorMessage(err), variant: "destructive" }),
  });
}

export function useDecideVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hospitalId, decision, reason }: { hospitalId: string; decision: "APPROVED" | "REJECTED" | "INFO_REQUESTED"; reason?: string }) =>
      apiFetch<VerificationDecisionResult>(`/api/verification/hospitals/${hospitalId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision, reason }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["verification", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      if (variables.decision !== "APPROVED") {
        toast({
          title: variables.decision === "REJECTED" ? "Hospital rejected" : "More information requested",
          description: "The hospital has been emailed your note.",
        });
      }
    },
    onError: (err) => toast({ title: "Couldn't record decision", description: errorMessage(err), variant: "destructive" }),
  });
}

export function useUpdateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, status, note }: { ticketId: string; status: string; note?: string }) =>
      apiFetch(`/api/support/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
      toast({ title: `Ticket ${variables.status.toLowerCase().replace("_", " ")}`, variant: "success" });
    },
    onError: (err) => toast({ title: "Couldn't update ticket", description: errorMessage(err), variant: "destructive" }),
  });
}
