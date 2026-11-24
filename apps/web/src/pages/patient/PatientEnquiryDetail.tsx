import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageSquareText,
  PhoneCall,
  PhoneMissed,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { EnquiryProgress } from "@/components/shared/EnquiryProgress";
import { RazorpayCheckout } from "@/components/shared/RazorpayCheckout";
import { useMyKyc, usePatientEnquiry } from "@/hooks/useApiQueries";
import { useCancelEnquiry } from "@/hooks/useApiMutations";
import { useAuth } from "@/context/AuthContext";
import { PATIENT_CANCELLABLE, PATIENT_STATUS_LABEL, nextStepCopy, statusTone, type Tone } from "@/lib/enquiryProgress";
import type { EnquiryDetail, PaymentStatus } from "@/types/api";
import { cn, formatCurrency, formatDate, formatDateTime, formatRelative, initials } from "@/lib/utils";

const TONE_BADGE: Record<Tone, BadgeProps["variant"]> = {
  primary: "default",
  success: "success",
  warning: "warning",
  muted: "muted",
  destructive: "destructive",
};

const PAYMENT_LABEL: Record<PaymentStatus, { label: string; variant: BadgeProps["variant"] }> = {
  PENDING: { label: "Awaiting payment", variant: "warning" },
  VERIFIED: { label: "Paid", variant: "success" },
  FAILED: { label: "Payment failed", variant: "destructive" },
  REFUND_INITIATED: { label: "Refund in progress", variant: "default" },
  REFUNDED: { label: "Refunded", variant: "muted" },
};

export function PatientEnquiryDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: enquiry, isLoading, isError } = usePatientEnquiry(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !enquiry) {
    return (
      <EmptyState
        icon={FileText}
        title="Request not found"
        description="It may have been removed, or the link is incorrect."
        action={
          <Button asChild variant="outline">
            <Link to="/patient">Back to my requests</Link>
          </Button>
        }
      />
    );
  }

  return <EnquiryDetailView enquiry={enquiry} />;
}

function EnquiryDetailView({ enquiry }: { enquiry: EnquiryDetail }) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const doctorName = enquiry.assignedDoctor?.user.name ?? null;
  const next = nextStepCopy(enquiry.status, {
    hospitalName: enquiry.hospital.name,
    doctorName,
    callbackWindow: enquiry.preferredCallbackWindow,
  });
  const tone = statusTone(enquiry.status);
  const canCancel = PATIENT_CANCELLABLE.includes(enquiry.status);
  const depositAmount =
    enquiry.intent === "SURGERY" ? enquiry.hospital.depositAmountSurgery : enquiry.hospital.depositAmountSecondOpinion;
  const paymentDue =
    enquiry.paymentRequired &&
    canCancel &&
    (!enquiry.payment || ["PENDING", "FAILED"].includes(enquiry.payment.status));

  const NextIcon =
    enquiry.status === "NO_RESPONSE"
      ? PhoneMissed
      : enquiry.status === "CANCELLED"
        ? XCircle
        : tone === "success"
          ? Sparkles
          : enquiry.status === "ASSIGNED"
            ? PhoneCall
            : Clock;

  return (
    <div className="space-y-5">
      <Link to="/patient" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All requests
      </Link>

      {/* Summary + journey */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-bold sm:text-2xl">{enquiry.hospital.name}</h1>
                <Badge variant={TONE_BADGE[tone]}>{PATIENT_STATUS_LABEL[enquiry.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {enquiry.intent === "SURGERY" ? "Surgery consultation" : "Second opinion"}
                {enquiry.treatment ? ` · ${enquiry.treatment.name}` : ""} · Sent {formatDate(enquiry.createdAt)}
              </p>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">Ref #{enquiry.id.slice(-8).toUpperCase()}</p>
          </div>
          <div className="border-t border-border bg-muted/20 px-3 py-5 sm:px-6">
            <EnquiryProgress status={enquiry.status} />
          </div>
        </CardContent>
      </Card>

      {/* What happens next */}
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between",
          tone === "warning" && "border-amber-200 bg-amber-50",
          tone === "success" && "border-green-200 bg-green-50",
          tone === "muted" && "border-border bg-muted/40",
          tone === "primary" && "border-primary-200 bg-primary-50",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              tone === "warning" && "bg-amber-100 text-amber-700",
              tone === "success" && "bg-green-100 text-green-700",
              tone === "muted" && "bg-muted text-muted-foreground",
              tone === "primary" && "bg-primary-100 text-primary-700",
            )}
          >
            <NextIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What happens next</p>
            <p className="mt-0.5 font-display text-base font-semibold">{next.title}</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{next.body}</p>
          </div>
        </div>
        {(enquiry.status === "CANCELLED" || enquiry.status === "CLOSED") && (
          <Button asChild variant="outline" className="shrink-0 bg-background">
            <Link to={`/hospitals/${enquiry.hospital.slug}`}>Book again</Link>
          </Button>
        )}
      </div>

      {paymentDue && <DepositDueCard enquiry={enquiry} amount={depositAmount} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {enquiry.assignedDoctor && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your doctor</p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{initials(enquiry.assignedDoctor.user.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-display font-semibold">{enquiry.assignedDoctor.user.name}</p>
                    <p className="text-sm text-primary-700">{enquiry.assignedDoctor.specialisation}</p>
                    <p className="text-xs text-muted-foreground">
                      {enquiry.assignedDoctor.qualifications} · {enquiry.assignedDoctor.experienceYears} yrs experience
                    </p>
                  </div>
                </div>
                {enquiry.callbackNotes && enquiry.callbackOutcome === "REACHED" && (
                  <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <MessageSquareText className="h-3.5 w-3.5" /> Doctor's summary of your call
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{enquiry.callbackNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-4 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your request</p>
              <p className="whitespace-pre-line text-sm leading-relaxed">{enquiry.condition}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile icon={CalendarClock} label="Preferred callback" value={enquiry.preferredCallbackWindow} />
                <InfoTile icon={Stethoscope} label="Treatment" value={enquiry.treatment?.name ?? "Doctor to advise"} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Reports shared with the hospital</p>
                {enquiry.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None shared.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {enquiry.attachments.map(({ medicalRecord: r }) => (
                      <span key={r.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                        <FileText className="h-3.5 w-3.5 text-primary-600" /> {r.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
              <ol className="mt-4 space-y-0">
                {[...enquiry.statusHistory].reverse().map((h, i, arr) => (
                  <li key={h.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < arr.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-border" />}
                    <span
                      className={cn(
                        "relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2",
                        i === 0 ? "border-primary-600 bg-primary-600" : "border-border bg-background",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-medium">{PATIENT_STATUS_LABEL[h.toStatus]}</p>
                        <time className="text-xs text-muted-foreground" title={formatDateTime(h.createdAt)}>
                          {formatRelative(h.createdAt)}
                        </time>
                      </div>
                      {h.note && !h.note.startsWith("Seeded") && <p className="mt-0.5 text-sm text-muted-foreground">{h.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hospital</p>
              <p className="font-display font-semibold">{enquiry.hospital.name}</p>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {enquiry.hospital.address}, {enquiry.hospital.city}
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={`/hospitals/${enquiry.hospital.slug}`}>
                  View hospital profile <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {enquiry.payment && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deposit</p>
                  <Badge variant={PAYMENT_LABEL[enquiry.payment.status].variant}>{PAYMENT_LABEL[enquiry.payment.status].label}</Badge>
                </div>
                <p className="font-display text-2xl font-bold">{formatCurrency(enquiry.payment.amount, enquiry.payment.currency)}</p>
                {enquiry.payment.verifiedAt && (
                  <p className="text-xs text-muted-foreground">Paid {formatDateTime(enquiry.payment.verifiedAt)}</p>
                )}
                {enquiry.payment.refunds.map((r) => (
                  <div key={r.id} className="rounded-lg bg-muted/50 p-3 text-xs">
                    <p className="font-medium">
                      Refund of {formatCurrency(r.amount)} · {r.status.toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{r.reason}</p>
                    <p className="mt-1 text-muted-foreground">Usually credited in 5–7 working days.</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {enquiry.paymentRequired && enquiry.status !== "CANCELLED" && (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              <p>
                <span className="font-medium text-foreground">Callback guarantee:</span> if the hospital doesn't call within{" "}
                {enquiry.hospital.slaCallbackHours} hours, your deposit is refunded automatically.
              </p>
            </div>
          )}

          {canCancel && (
            <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4" /> Cancel this request
            </Button>
          )}
        </div>
      </div>

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        enquiryId={enquiry.id}
        hospitalName={enquiry.hospital.name}
        hasPaidDeposit={enquiry.payment?.status === "VERIFIED"}
      />
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function DepositDueCard({ enquiry, amount }: { enquiry: EnquiryDetail; amount: number }) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const { data: kyc, isLoading } = useMyKyc();
  const verified = kyc?.status === "VERIFIED";
  const pendingReview = kyc?.status === "PENDING";

  return (
    <div className="rounded-xl border-2 border-accent-300 bg-accent-50/60 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-semibold">
              Confirm your booking with a {formatCurrency(amount)} refundable deposit
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {enquiry.payment?.status === "FAILED"
                ? "Your last payment attempt didn't go through — you can try again."
                : `Activates the ${enquiry.hospital.slaCallbackHours}-hour callback guarantee and is adjusted against your bill.`}
            </p>
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-56">
          {isLoading ? (
            <Button disabled className="w-full"><Loader2 className="h-4 w-4 animate-spin" /></Button>
          ) : verified && me ? (
            <RazorpayCheckout
              enquiryId={enquiry.id}
              amount={amount}
              intent={enquiry.intent}
              patientName={me.user.name}
              patientEmail={me.user.email ?? undefined}
              onSuccess={() => undefined}
            />
          ) : pendingReview ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0 text-amber-500" /> ID under review — you'll be able to pay once it's verified.
            </div>
          ) : (
            <Button className="w-full" onClick={() => navigate("/patient/kyc", { state: { returnTo: `/patient/enquiries/${enquiry.id}` } })}>
              <UserCheck className="h-4 w-4" /> Verify ID to pay
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  enquiryId,
  hospitalName,
  hasPaidDeposit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiryId: string;
  hospitalName: string;
  hasPaidDeposit: boolean;
}) {
  const cancel = useCancelEnquiry();
  const [reason, setReason] = React.useState("");
  const REASONS = ["Found another hospital", "Condition improved", "Cost is too high", "Wrong details submitted"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this request?</DialogTitle>
          <DialogDescription>
            {hospitalName} will be told you no longer need a callback.
            {hasPaidDeposit && " Your deposit will be refunded in full."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reason (optional — helps us improve)</Label>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  reason === r ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} placeholder="Anything else?" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep request
          </Button>
          <Button
            variant="destructive"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate({ enquiryId, reason: reason.trim() || undefined }, { onSuccess: () => onOpenChange(false) })
            }
          >
            {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Yes, cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
