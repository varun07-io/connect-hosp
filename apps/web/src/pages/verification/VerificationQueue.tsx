import * as React from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  KeyRound,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  MessageSquareWarning,
  Phone,
  UserRound,
  XCircle,
} from "lucide-react";
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
import type { VerificationDecisionResult, VerificationQueueItem } from "@/types/api";
import { cn, formatRelative } from "@/lib/utils";

type Decision = "APPROVED" | "REJECTED" | "INFO_REQUESTED";

const CHECKS = [
  "Hospital name and address match the registration certificate",
  "Contact person reached on the phone number given",
  "Accreditations (e.g. NABH) verified if claimed",
  "Specialities are plausible for the facility",
];

export function VerificationQueue() {
  const { data, isLoading } = useVerificationQueue();
  const decide = useDecideVerification();
  const [target, setTarget] = React.useState<{ hospital: VerificationQueueItem; decision: Decision } | null>(null);
  const [reason, setReason] = React.useState("");
  const [approved, setApproved] = React.useState<{ hospital: VerificationQueueItem; result: VerificationDecisionResult } | null>(null);

  const pending = data?.filter((h) => h.status === "PENDING").length ?? 0;
  const inReview = data?.filter((h) => h.status === "IN_REVIEW").length ?? 0;

  function open(hospital: VerificationQueueItem, decision: Decision) {
    setTarget({ hospital, decision });
    setReason("");
  }

  function submit() {
    if (!target) return;
    if (target.decision !== "APPROVED" && !reason.trim()) return;
    const { hospital, decision } = target;
    decide.mutate(
      { hospitalId: hospital.id, decision, reason: reason.trim() || undefined },
      {
        onSuccess: (result) => {
          setTarget(null);
          if (decision === "APPROVED") setApproved({ hospital, result });
        },
      },
    );
  }

  const copy = {
    APPROVED: { title: "Approve and publish", button: "Approve & publish", tone: "default" as const },
    INFO_REQUESTED: { title: "Ask for more information", button: "Send request", tone: "outline" as const },
    REJECTED: { title: "Reject registration", button: "Reject", tone: "destructive" as const },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Verification queue"
        description="Check each registration before it goes live. Approving publishes the hospital and creates its dashboard login."
      />

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="font-display text-2xl font-bold text-amber-900">{pending}</p>
            <p className="text-xs text-amber-800">New registrations</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="font-display text-2xl font-bold">{inReview}</p>
            <p className="text-xs text-muted-foreground">Waiting on the hospital</p>
          </div>
        </div>
      )}

      {isLoading && <Skeleton className="h-48 rounded-xl" />}

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="Queue is clear"
          description="New registrations from the “List your hospital” page appear here for review."
          action={
            <Button asChild variant="outline">
              <Link to="/list-your-hospital" target="_blank">
                Open the registration page <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      )}

      <div className="space-y-3">
        {data?.map((h, i) => (
          <RegistrationCard key={h.id} h={h} defaultOpen={i === 0} busy={decide.isPending && decide.variables?.hospitalId === h.id} onDecide={(d) => open(h, d)} />
        ))}
      </div>

      {/* Decision dialog */}
      <Dialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          {target && (
            <>
              <DialogHeader>
                <DialogTitle>{copy[target.decision].title}</DialogTitle>
                <DialogDescription>{target.hospital.name}</DialogDescription>
              </DialogHeader>
              {target.decision === "APPROVED" ? (
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> The hospital appears in patient search with a Verified badge.
                  </li>
                  <li className="flex gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                    <span>
                      A Hospital Admin login is created for <span className="font-medium">{target.hospital.contactPersonName}</span> (
                      {target.hospital.contactPersonEmail}) so they can add doctors and prices.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> They're notified by email.
                  </li>
                </ul>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {target.decision === "REJECTED"
                      ? "Explain why — this is emailed to the hospital."
                      : "Say exactly what's missing — this is emailed to the hospital and the registration moves to “waiting on the hospital”."}
                  </p>
                  <Textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder={target.decision === "REJECTED" ? "e.g. Address could not be verified." : "e.g. Please send your registration certificate."}
                  />
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant={copy[target.decision].tone}
                  disabled={decide.isPending || (target.decision !== "APPROVED" && !reason.trim())}
                  onClick={submit}
                >
                  {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {copy[target.decision].button}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval result */}
      <Dialog open={Boolean(approved)} onOpenChange={(o) => !o && setApproved(null)}>
        <DialogContent>
          {approved && (
            <div className="flex flex-col items-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </span>
              <DialogTitle className="mt-3">{approved.hospital.name} is live</DialogTitle>
              {approved.result.admin?.created ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Hospital Admin login created for <span className="font-medium text-foreground">{approved.result.admin.email}</span>. In local
                  demo mode it appears on the login page as <span className="font-medium text-foreground">{approved.hospital.contactPersonName}</span>{" "}
                  under “Hospital Admin”.
                </p>
              ) : (
                <p className="mt-2 text-sm text-amber-800">{approved.result.admin?.note}</p>
              )}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setApproved(null)}>
                  Back to queue
                </Button>
                <Button asChild>
                  <Link to="/search" target="_blank">
                    See it in search <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrationCard({
  h,
  busy,
  defaultOpen,
  onDecide,
}: {
  h: VerificationQueueItem;
  busy: boolean;
  defaultOpen: boolean;
  onDecide: (d: Decision) => void;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card>
      <CardContent className="p-0">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-semibold">{h.name}</p>
              <HospitalStatusBadge status={h.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {h.city}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> submitted {formatRelative(h.createdAt)}
              </span>
              <span className="font-mono">Ref #{h.id.slice(-8).toUpperCase()}</span>
            </p>
          </div>
          <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="grid gap-5 border-t border-border p-4 sm:p-5 md:grid-cols-[1fr_260px]">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
                <p className="mt-1">{h.address}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialities</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {h.specialities.length ? (
                    h.specialities.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">None listed</span>
                  )}
                </div>
              </div>
              {h.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{h.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviewer checklist</p>
                <ul className="mt-1.5 space-y-1">
                  {CHECKS.map((c) => (
                    <li key={c} className="flex gap-2 text-xs text-muted-foreground">
                      <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-border p-3 text-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" /> Contact person
                </p>
                <p className="mt-1.5 font-medium">{h.contactPersonName}</p>
                <a href={`tel:${h.contactPersonPhone}`} className="mt-1 flex items-center gap-1.5 text-primary-700 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {h.contactPersonPhone}
                </a>
                <a href={`mailto:${h.contactPersonEmail}`} className="mt-0.5 flex items-center gap-1.5 break-all text-primary-700 hover:underline">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {h.contactPersonEmail}
                </a>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> {h._count.verificationDocs} document{h._count.verificationDocs === 1 ? "" : "s"} uploaded
              </p>
              <div className="flex flex-col gap-2">
                <Button disabled={busy} onClick={() => onDecide("APPROVED")}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide("INFO_REQUESTED")}>
                    <MessageSquareWarning className="h-3.5 w-3.5" /> Ask for info
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} className="text-destructive hover:bg-red-50" onClick={() => onDecide("REJECTED")}>
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
