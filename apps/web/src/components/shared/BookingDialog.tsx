import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartHandshake,
  Loader2,
  Lock,
  PhoneCall,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Wallet,
} from "lucide-react";
import type { EnquiryIntent } from "@connect-hospital/shared";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useCreateEnquiry } from "@/hooks/useApiMutations";
import { useMyKyc, usePatientRecords } from "@/hooks/useApiQueries";
import { RazorpayCheckout } from "@/components/shared/RazorpayCheckout";
import { CALLBACK_WINDOWS } from "@/lib/enquiryProgress";
import { cn, formatCurrency } from "@/lib/utils";
import { ApiError } from "@/lib/apiClient";

export interface BookingTreatmentOption {
  id: string;
  name: string;
  price?: number;
  currency?: string;
}

export interface DepositConfig {
  required: boolean;
  surgery: number;
  secondOpinion: number;
  slaCallbackHours: number;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitalId: string;
  hospitalName: string;
  treatments: BookingTreatmentOption[];
  defaultIntent: EnquiryIntent;
  defaultTreatmentId?: string;
  deposit?: DepositConfig;
}

type Step = "request" | "details" | "review" | "payment" | "kyc" | "done";
const FORM_STEPS: { key: Step; label: string }[] = [
  { key: "request", label: "Your request" },
  { key: "details", label: "Reports & callback" },
  { key: "review", label: "Review" },
];

const INTENT_OPTIONS: { value: EnquiryIntent; title: string; desc: string; icon: typeof PhoneCall }[] = [
  { value: "SURGERY", title: "Plan a surgery", desc: "Discuss the procedure, cost and dates with a surgeon.", icon: Stethoscope },
  { value: "SECOND_OPINION", title: "Second opinion", desc: "Have a specialist review a diagnosis you've been given.", icon: HeartHandshake },
];

export function BookingDialog({
  open,
  onOpenChange,
  hospitalId,
  hospitalName,
  treatments,
  defaultIntent,
  defaultTreatmentId,
  deposit,
}: BookingDialogProps) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const createEnquiry = useCreateEnquiry();
  const isPatient = me?.user.role === "PATIENT";
  const { data: kyc } = useMyKyc(open && isPatient);
  const { data: records } = usePatientRecords(open && isPatient);
  const kycVerified = kyc?.status === "VERIFIED";

  const [step, setStep] = React.useState<Step>("request");
  const [enquiryId, setEnquiryId] = React.useState<string | null>(null);
  const [paid, setPaid] = React.useState(false);
  const [intent, setIntent] = React.useState<EnquiryIntent>(defaultIntent);
  const [treatmentId, setTreatmentId] = React.useState<string>("none");
  const [condition, setCondition] = React.useState("");
  const [callbackWindow, setCallbackWindow] = React.useState(CALLBACK_WINDOWS[1]);
  const [customWindow, setCustomWindow] = React.useState("");
  const [recordIds, setRecordIds] = React.useState<string[]>([]);
  const [consent, setConsent] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setIntent(defaultIntent);
      setTreatmentId(defaultTreatmentId ?? "none");
      setStep("request");
      setEnquiryId(null);
      setPaid(false);
      setCondition("");
      setCallbackWindow(CALLBACK_WINDOWS[1]);
      setCustomWindow("");
      setRecordIds([]);
      setConsent(false);
      createEnquiry.reset();
    }
  }, [open, defaultIntent, defaultTreatmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isPatient || !me) return null;

  const depositAmount = deposit?.required ? (intent === "SURGERY" ? deposit.surgery : deposit.secondOpinion) : 0;
  const needsDeposit = depositAmount > 0;
  const selectedTreatment = treatments.find((t) => t.id === treatmentId);
  const effectiveWindow = callbackWindow === "custom" ? customWindow.trim() : callbackWindow;
  const conditionOk = condition.trim().length >= 10;
  const stepIndex = FORM_STEPS.findIndex((s) => s.key === step);

  async function submit() {
    if (!consent || !conditionOk || !effectiveWindow) return;
    try {
      const created = await createEnquiry.mutateAsync({
        hospitalId,
        intent,
        treatmentId: treatmentId === "none" ? undefined : treatmentId,
        condition: condition.trim(),
        preferredCallbackWindow: effectiveWindow,
        recordIds: kycVerified ? recordIds : [],
        consentAccepted: true,
      });
      setEnquiryId(created.id);
      if (!needsDeposit) setStep("done");
      else setStep(kycVerified ? "payment" : "kyc");
    } catch {
      // surfaced inline below via createEnquiry.error
    }
  }

  function toggleRecord(id: string) {
    setRecordIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  const submitError = createEnquiry.error instanceof ApiError ? createEnquiry.error.message : createEnquiry.isError ? "Something went wrong — please try again." : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        {/* ── Form steps ─────────────────────────────────────────────── */}
        {stepIndex >= 0 && (
          <div className="flex flex-col">
            <div className="border-b border-border px-6 pb-4 pt-6">
              <DialogHeader className="mb-4">
                <DialogTitle>{intent === "SURGERY" ? "Request a surgery consultation" : "Request a second opinion"}</DialogTitle>
                <DialogDescription>
                  at <span className="font-medium text-foreground">{hospitalName}</span> ·{" "}
                  {needsDeposit ? `doctor callback within ${deposit?.slaCallbackHours ?? 48}h, guaranteed` : "free doctor callback"}
                </DialogDescription>
              </DialogHeader>
              <ol className="flex items-center gap-2">
                {FORM_STEPS.map((s, i) => (
                  <li key={s.key} className="flex flex-1 items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        i < stepIndex && "bg-primary-600 text-white",
                        i === stepIndex && "bg-primary-600 text-white ring-4 ring-primary-100",
                        i > stepIndex && "bg-muted text-muted-foreground",
                      )}
                    >
                      {i < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={cn("hidden text-xs font-medium sm:inline", i === stepIndex ? "text-foreground" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                    {i < FORM_STEPS.length - 1 && <span className={cn("h-px flex-1", i < stepIndex ? "bg-primary-600" : "bg-border")} />}
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-5 px-6 py-5">
              {step === "request" && (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {INTENT_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setIntent(o.value)}
                        aria-pressed={intent === o.value}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                          intent === o.value
                            ? "border-primary-600 bg-primary-50 ring-1 ring-primary-600"
                            : "border-border hover:border-primary-300 hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            intent === o.value ? "bg-primary-600 text-white" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <o.icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{o.title}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{o.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Treatment</Label>
                    <Select value={treatmentId} onValueChange={setTreatmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a treatment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not sure yet — let the doctor advise</SelectItem>
                        {treatments.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.price !== undefined ? ` · ${formatCurrency(t.price, t.currency)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTreatment?.price !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Indicative cost at this hospital:{" "}
                        <span className="font-semibold text-primary-700">{formatCurrency(selectedTreatment.price, selectedTreatment.currency)}</span>.
                        The doctor confirms the final estimate on the call.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <Label htmlFor="condition">Tell the doctor what's going on</Label>
                      <span className={cn("text-[11px]", conditionOk ? "text-muted-foreground" : "text-amber-700")}>
                        {condition.trim().length}/2000
                      </span>
                    </div>
                    <Textarea
                      id="condition"
                      value={condition}
                      maxLength={2000}
                      rows={4}
                      onChange={(e) => setCondition(e.target.value)}
                      placeholder="e.g. Knee pain for 6 months, worse on stairs. Local orthopaedic suggested replacement after an X-ray."
                    />
                    <p className="text-xs text-muted-foreground">Symptoms, how long, and any diagnosis so far help the doctor prepare for your call.</p>
                  </div>
                </>
              )}

              {step === "details" && (
                <>
                  <div className="space-y-2">
                    <Label>When should the doctor call you?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[...CALLBACK_WINDOWS, "custom"].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setCallbackWindow(w)}
                          aria-pressed={callbackWindow === w}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                            callbackWindow === w
                              ? "border-primary-600 bg-primary-600 text-white"
                              : "border-border text-foreground hover:border-primary-300 hover:bg-primary-50",
                          )}
                        >
                          {w === "custom" ? "Other…" : w}
                        </button>
                      ))}
                    </div>
                    {callbackWindow === "custom" && (
                      <Input
                        autoFocus
                        value={customWindow}
                        onChange={(e) => setCustomWindow(e.target.value)}
                        placeholder="e.g. Saturday morning before 11am"
                        maxLength={120}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <Label>Share reports with the doctor <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      {kycVerified && recordIds.length > 0 && (
                        <span className="text-xs font-medium text-primary-700">{recordIds.length} selected</span>
                      )}
                    </div>

                    {!kycVerified ? (
                      <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">Report sharing needs a verified ID</p>
                          <p className="mt-0.5">
                            To protect your medical data, reports can only be shared after a quick ID check. You can still
                            send this request now and share reports on the call.{" "}
                            <Link to="/patient/kyc" className="font-medium text-primary-700 hover:underline" onClick={() => onOpenChange(false)}>
                              Verify ID
                            </Link>
                          </p>
                        </div>
                      </div>
                    ) : !records || records.length === 0 ? (
                      <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                          Your records vault is empty.{" "}
                          <Link to="/patient/vault" className="font-medium text-primary-700 hover:underline" onClick={() => onOpenChange(false)}>
                            Upload reports
                          </Link>{" "}
                          to share them with doctors in one tap.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {records.map((r) => {
                          const checked = recordIds.includes(r.id);
                          return (
                            <label
                              key={r.id}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                                checked ? "border-primary-600 bg-primary-50" : "border-border hover:bg-muted/40",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRecord(r.id)}
                                className="h-4 w-4 rounded border-input accent-primary-600"
                              />
                              <FileText className="h-4 w-4 shrink-0 text-primary-600" />
                              <span className="min-w-0 flex-1 truncate">{r.title}</span>
                              <span className="shrink-0 text-[11px] uppercase text-muted-foreground">{r.category.replace("_", " ").toLowerCase()}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {step === "review" && (
                <>
                  <dl className="divide-y divide-border rounded-xl border border-border text-sm">
                    <ReviewRow label="Request" value={intent === "SURGERY" ? "Surgery consultation" : "Second opinion"} onEdit={() => setStep("request")} />
                    <ReviewRow label="Treatment" value={selectedTreatment?.name ?? "Doctor to advise"} onEdit={() => setStep("request")} />
                    <ReviewRow label="Your condition" value={condition.trim()} clamp onEdit={() => setStep("request")} />
                    <ReviewRow label="Callback" value={effectiveWindow} onEdit={() => setStep("details")} />
                    <ReviewRow
                      label="Reports shared"
                      value={kycVerified && recordIds.length ? `${recordIds.length} report${recordIds.length > 1 ? "s" : ""}` : "None"}
                      onEdit={() => setStep("details")}
                    />
                  </dl>

                  {needsDeposit ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                          <div>
                            <p className="text-sm font-semibold text-primary-900">Refundable booking deposit</p>
                            <p className="mt-0.5 text-xs text-primary-800">
                              Adjusted against your final bill. Fully refunded if the hospital doesn't call you within{" "}
                              {deposit?.slaCallbackHours ?? 48} hours, or if you cancel before your consultation.
                            </p>
                          </div>
                        </div>
                        <span className="font-display text-lg font-bold text-primary-800">{formatCurrency(depositAmount)}</span>
                      </div>
                      {!kycVerified && (
                        <p className="mt-3 flex items-center gap-1.5 border-t border-primary-200 pt-3 text-xs text-primary-800">
                          <UserCheck className="h-3.5 w-3.5" /> A quick ID check is needed before paying — we'll guide you right after this step.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      <BadgeCheck className="h-4 w-4 shrink-0" /> No deposit needed — this request is completely free.
                    </div>
                  )}

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input accent-primary-600"
                    />
                    <span className="text-muted-foreground">
                      I consent to share my name, phone number, condition{recordIds.length && kycVerified ? " and selected reports" : ""} with{" "}
                      <span className="font-medium text-foreground">{hospitalName}</span> so a doctor can call me back.
                    </span>
                  </label>

                  {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">{submitError}</p>}
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-6 py-4">
              {stepIndex === 0 ? (
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setStep(FORM_STEPS[stepIndex - 1].key)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}

              {step === "request" && (
                <Button type="button" disabled={!conditionOk} onClick={() => setStep("details")}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "details" && (
                <Button type="button" disabled={!effectiveWindow} onClick={() => setStep("review")}>
                  Review <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "review" && (
                <Button type="button" disabled={!consent || createEnquiry.isPending} onClick={submit}>
                  {createEnquiry.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {needsDeposit ? "Send request & continue" : "Send request"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Deposit: ID check needed first ─────────────────────────── */}
        {step === "kyc" && enquiryId && (
          <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <div>
              <DialogTitle>Request saved — one quick step left</DialogTitle>
              <DialogDescription className="mx-auto mt-2 max-w-sm">
                {hospitalName} takes a refundable {formatCurrency(depositAmount)} deposit to confirm bookings. Verify your
                ID (about 2 minutes with DigiLocker), then pay from your enquiry page.
              </DialogDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="outline" onClick={() => navigate(`/patient/enquiries/${enquiryId}`)}>
                I'll do it later
              </Button>
              <Button onClick={() => navigate("/patient/kyc", { state: { returnTo: `/patient/enquiries/${enquiryId}` } })}>
                <UserCheck className="h-4 w-4" /> Verify my ID
              </Button>
            </div>
          </div>
        )}

        {/* ── Deposit payment ────────────────────────────────────────── */}
        {step === "payment" && enquiryId && (
          <div className="flex flex-col gap-4 px-6 py-6">
            <DialogHeader className="mb-0">
              <DialogTitle>Confirm with a refundable deposit</DialogTitle>
              <DialogDescription>Your request is saved. Paying the deposit locks in your callback guarantee.</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Deposit · {intent === "SURGERY" ? "Surgery" : "Second opinion"}</span>
                <span className="font-display text-2xl font-bold">{formatCurrency(depositAmount)}</span>
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Adjusted against your final hospital bill</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Full refund if no call within {deposit?.slaCallbackHours ?? 48} hours</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Cancel any time before your consultation for a full refund</li>
              </ul>
            </div>
            <RazorpayCheckout
              enquiryId={enquiryId}
              amount={depositAmount}
              intent={intent}
              patientName={me.user.name}
              patientEmail={me.user.email ?? undefined}
              onSuccess={() => {
                setPaid(true);
                setStep("done");
              }}
            />
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setStep("done")}>
              Pay later from my enquiry page
            </Button>
          </div>
        )}

        {/* ── Confirmation ───────────────────────────────────────────── */}
        {step === "done" && (
          <div className="px-6 py-8">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </span>
              <DialogTitle className="mt-3">Request sent to {hospitalName}</DialogTitle>
              <DialogDescription className="mt-1">
                {paid ? "Deposit received — your callback guarantee is active." : "We've notified the hospital's care desk."}
                {needsDeposit && !paid && " Remember to pay the deposit to confirm your booking."}
              </DialogDescription>
            </div>

            <ol className="mt-6 space-y-3 rounded-xl border border-border p-4">
              {[
                { icon: ClipboardList, title: "Hospital reviews your request", desc: "Usually within a few hours." },
                { icon: Stethoscope, title: "A doctor is assigned to you", desc: "You'll get an SMS with their name." },
                { icon: PhoneCall, title: "The doctor calls you", desc: `During your preferred window: ${effectiveWindow}.` },
              ].map((s, i) => (
                <li key={s.title} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">
                      <span className="text-muted-foreground">{i + 1}.</span> {s.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Keep browsing
              </Button>
              <Button onClick={() => navigate(enquiryId ? `/patient/enquiries/${enquiryId}` : "/patient")}>
                Track my request <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value, onEdit, clamp }: { label: string; value: string; onEdit: () => void; clamp?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 flex-1 text-sm", clamp && "line-clamp-2")}>{value}</dd>
      <button type="button" onClick={onEdit} className="shrink-0 text-xs font-medium text-primary-700 hover:underline">
        Edit
      </button>
    </div>
  );
}
