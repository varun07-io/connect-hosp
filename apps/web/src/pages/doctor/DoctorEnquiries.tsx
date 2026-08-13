import * as React from "react";
import { Loader2, PhoneCall } from "lucide-react";
import type { CallbackOutcome } from "@connect-hospital/shared";
import { EnquiryTable } from "@/components/shared/EnquiryTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useDoctorEnquiries } from "@/hooks/useApiQueries";
import { useLogCallback } from "@/hooks/useApiMutations";
import type { EnquiryListItem } from "@/types/api";
import { cn } from "@/lib/utils";

const OUTCOMES: { value: CallbackOutcome; label: string }[] = [
  { value: "REACHED", label: "Reached & guided" },
  { value: "NOT_REACHED", label: "Not reached" },
  { value: "CALL_BACK_LATER", label: "Call back later" },
];

export function DoctorEnquiries() {
  const { data, isLoading } = useDoctorEnquiries();
  const logCallback = useLogCallback();
  const [target, setTarget] = React.useState<EnquiryListItem | null>(null);
  const [outcome, setOutcome] = React.useState<CallbackOutcome>("REACHED");
  const [notes, setNotes] = React.useState("");

  function openLog(item: EnquiryListItem) {
    setTarget(item);
    setOutcome("REACHED");
    setNotes("");
  }

  function submit() {
    if (!target || !notes.trim()) return;
    logCallback.mutate(
      { enquiryId: target.id, outcome, notes },
      { onSuccess: () => setTarget(null) },
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Assigned enquiries" description="Call the patient, guide them, then log the outcome." />
      <EnquiryTable
        items={data}
        isLoading={isLoading}
        showPatient
        emptyDescription="Enquiries the hospital assigns to you will show up here."
        renderActions={(item) =>
          ["ASSIGNED", "CONTACTED"].includes(item.status) ? (
            <Button size="sm" variant="subtle" onClick={() => openLog(item)}>
              <PhoneCall className="h-3.5 w-3.5" /> Log callback
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        }
      />

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log callback outcome</DialogTitle>
            <DialogDescription>Call with {target?.patient?.name}, then record what happened.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <div className="grid grid-cols-1 gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm font-medium",
                      outcome === o.value ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border text-muted-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="callback-notes">Notes</Label>
              <Textarea
                id="callback-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Summary of the conversation and recommended next step."
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={submit} disabled={!notes.trim() || logCallback.isPending}>
              {logCallback.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
