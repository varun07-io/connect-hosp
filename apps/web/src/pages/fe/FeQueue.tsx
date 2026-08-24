import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Phone, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface FeQueueEntry {
  id: string;
  followUpStatus: string;
  admissionRef: string | null;
  assignedAt: string | null;
  createdAt: string;
  enquiry: {
    id: string;
    intent: string;
    status: string;
    condition: string;
    patient: { name: string; phone: string | null };
    hospital: { name: string; city: string };
    treatment: { name: string } | null;
  } | null;
  followUpLogs: Array<{ id: string; actionType: string; notes: string; createdAt: string }>;
}

const STATUS_COLOR: Record<string, "muted" | "default" | "outline" | "destructive"> = {
  NOT_STARTED: "muted",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  ESCALATED: "destructive",
};

function LogForm({ queueId, onDone }: { queueId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [actionType, setActionType] = useState("PHONE_CALL");
  const [notes, setNotes] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/fe/queue/${queueId}/logs`, {
        method: "POST",
        body: JSON.stringify({
          actionType,
          notes,
          nextStep: nextStep || undefined,
          // datetime-local gives "2026-08-24T14:30" — backend requires full ISO with timezone
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : "",
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fe-queue"] });
      onDone();
    },
  });

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <select
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      >
        {["PHONE_CALL", "PHYSICAL_VISIT", "DOCUMENT_COLLECTED", "ADMISSION_CONFIRMED", "OTHER"].map((t) => (
          <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
        ))}
      </select>
      <textarea
        placeholder="Notes (required)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm resize-none"
      />
      <input
        placeholder="Next step (optional)"
        value={nextStep}
        onChange={(e) => setNextStep(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      <input
        type="datetime-local"
        value={followUpDate}
        onChange={(e) => setFollowUpDate(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={!notes || !followUpDate || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save log"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function QueueCard({ entry }: { entry: FeQueueEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const enquiry = entry.enquiry;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{enquiry?.patient.name ?? "—"}</p>
              <Badge variant={STATUS_COLOR[entry.followUpStatus]}>
                {entry.followUpStatus.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline">{enquiry?.intent}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{enquiry?.treatment?.name ?? enquiry?.condition}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{enquiry?.patient.phone ?? "—"}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{enquiry?.hospital.name}, {enquiry?.hospital.city}</span>
              <span>Added {formatDate(entry.createdAt)}</span>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="mt-1 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2">
            {entry.followUpLogs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent logs</p>
                {entry.followUpLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-medium">{log.actionType.replace(/_/g, " ")}</span> — {log.notes}
                    <span className="ml-2 text-muted-foreground">{formatDate(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
            {showLogForm ? (
              <LogForm queueId={entry.id} onDone={() => setShowLogForm(false)} />
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowLogForm(true)}>Log follow-up action</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FeQueue() {
  const { data, isLoading } = useQuery({
    queryKey: ["fe-queue"],
    queryFn: () => apiFetch<{ items: FeQueueEntry[] }>("/api/fe/queue"),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="My Bookings" description="All enquiries assigned to you for follow-up." />

      {isLoading && <Skeleton className="h-40 rounded-xl" />}

      {!isLoading && !data?.items.length && (
        <EmptyState icon={ClipboardList} title="No assignments yet" description="Check back once enquiries are assigned to you." />
      )}

      {data?.items.map((entry) => <QueueCard key={entry.id} entry={entry} />)}
    </div>
  );
}
