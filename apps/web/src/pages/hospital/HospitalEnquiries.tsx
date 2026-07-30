import * as React from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { EnquiryTable } from "@/components/shared/EnquiryTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHospitalEnquiries } from "@/hooks/useApiQueries";
import { useAcknowledgeEnquiry, useAssignEnquiry, useHospitalDoctors } from "@/hooks/useApiMutations";
import type { EnquiryListItem } from "@/types/api";

export function HospitalEnquiries() {
  const { data, isLoading } = useHospitalEnquiries();
  const { data: doctors } = useHospitalDoctors();
  const acknowledge = useAcknowledgeEnquiry();
  const assign = useAssignEnquiry();
  const [assignTarget, setAssignTarget] = React.useState<EnquiryListItem | null>(null);
  const [doctorId, setDoctorId] = React.useState<string>("");

  function handleAssign() {
    if (!assignTarget || !doctorId) return;
    assign.mutate(
      { enquiryId: assignTarget.id, doctorId },
      { onSuccess: () => { setAssignTarget(null); setDoctorId(""); } },
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Enquiries" description="Acknowledge, assign to a doctor and track every patient enquiry." />
      <EnquiryTable
        items={data}
        isLoading={isLoading}
        showPatient
        showDoctor
        emptyDescription="Enquiries submitted by patients on your hospital profile will appear here in real time."
        renderActions={(item) => (
          <div className="flex gap-2">
            {item.status === "NEW" && (
              <Button
                size="sm"
                variant="subtle"
                disabled={acknowledge.isPending}
                onClick={() => acknowledge.mutate(item.id)}
              >
                {acknowledge.isPending && acknowledge.variables === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Acknowledge
              </Button>
            )}
            {(item.status === "NEW" || item.status === "ACKNOWLEDGED") && (
              <Button size="sm" variant="outline" onClick={() => setAssignTarget(item)}>
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </Button>
            )}
            {!["NEW", "ACKNOWLEDGED"].includes(item.status) && <span className="text-xs text-muted-foreground">—</span>}
          </div>
        )}
      />

      <Dialog open={Boolean(assignTarget)} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to a doctor</DialogTitle>
            <DialogDescription>{assignTarget?.patient?.name}'s enquiry will be routed for a callback.</DialogDescription>
          </DialogHeader>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors?.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.user.name} — {d.specialisation}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!doctorId || assign.isPending}>
              {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
