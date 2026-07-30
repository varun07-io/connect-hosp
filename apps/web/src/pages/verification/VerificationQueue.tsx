import * as React from "react";
import { CheckCircle2, HelpCircle, ListChecks, Loader2, MapPin, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { HospitalStatusBadge } from "@/components/shared/StatusBadge";
import { useVerificationQueue } from "@/hooks/useApiQueries";
import { useDecideVerification } from "@/hooks/useApiMutations";
import type { VerificationQueueItem } from "@/types/api";
import { formatDate } from "@/lib/utils";

export function VerificationQueue() {
  const { data, isLoading } = useVerificationQueue();
  const decide = useDecideVerification();
  const [rejectTarget, setRejectTarget] = React.useState<VerificationQueueItem | null>(null);
  const [reason, setReason] = React.useState("");

  function approve(hospital: VerificationQueueItem) {
    decide.mutate({ hospitalId: hospital.id, decision: "APPROVED" });
  }

  function submitReject() {
    if (!rejectTarget || !reason.trim()) return;
    decide.mutate(
      { hospitalId: rejectTarget.id, decision: "REJECTED", reason },
      { onSuccess: () => { setRejectTarget(null); setReason(""); } },
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Verification queue" description="Review documents and approve or reject hospital registrations." />

      {isLoading && <Skeleton className="h-48 rounded-xl" />}

      {!isLoading && data?.length === 0 && (
        <EmptyState icon={ListChecks} title="Queue is clear" description="New hospital registrations awaiting review will appear here." />
      )}

      <div className="space-y-3">
        {data?.map((hospital) => (
          <Card key={hospital.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-sm font-semibold">{hospital.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {hospital.city} · submitted {formatDate(hospital.createdAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Contact: {hospital.contactPersonName} ({hospital.contactPersonEmail}) · {hospital._count.verificationDocs} document(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <HospitalStatusBadge status={hospital.status} />
                <Button
                  size="sm"
                  variant="subtle"
                  disabled={decide.isPending}
                  onClick={() => approve(hospital)}
                >
                  {decide.isPending && decide.variables?.hospitalId === hospital.id && decide.variables.decision === "APPROVED" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRejectTarget(hospital); setReason(""); }}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.name}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> A reason is required and will be emailed to the hospital.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Missing accreditation documents." required />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject} disabled={!reason.trim() || decide.isPending}>
              {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
