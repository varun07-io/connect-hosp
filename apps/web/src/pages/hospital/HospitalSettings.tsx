import * as React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ExternalLink, Info, Loader2, Lock, ShieldCheck, Timer, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TagInput } from "@/components/shared/TagInput";
import { HospitalStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useHospitalSettings, useUpdateHospitalSettings } from "@/hooks/useHospitalAdmin";
import { useAppConfig } from "@/hooks/useApiQueries";
import { FACILITY_SUGGESTIONS, SPECIALITY_SUGGESTIONS } from "@/lib/hospitalVocab";
import type { HospitalSettings as Settings } from "@/types/api";
import { cn, formatCurrency } from "@/lib/utils";

type Editable = Pick<
  Settings,
  | "description"
  | "address"
  | "specialities"
  | "facilities"
  | "contactPersonName"
  | "contactPersonPhone"
  | "contactPersonEmail"
  | "depositRequired"
  | "depositAmountSurgery"
  | "depositAmountSecondOpinion"
  | "slaCallbackHours"
>;

const SLA_OPTIONS = [12, 24, 48, 72];

function pickEditable(s: Settings): Editable {
  return {
    description: s.description ?? "",
    address: s.address,
    specialities: s.specialities,
    facilities: s.facilities,
    contactPersonName: s.contactPersonName,
    contactPersonPhone: s.contactPersonPhone,
    contactPersonEmail: s.contactPersonEmail,
    depositRequired: s.depositRequired,
    depositAmountSurgery: s.depositAmountSurgery,
    depositAmountSecondOpinion: s.depositAmountSecondOpinion,
    slaCallbackHours: s.slaCallbackHours,
  };
}

export function HospitalSettings() {
  const { data, isLoading } = useHospitalSettings();
  const save = useUpdateHospitalSettings();
  const { paymentsEnabled } = useAppConfig();
  const [form, setForm] = React.useState<Editable | null>(null);

  React.useEffect(() => {
    if (data) setForm(pickEditable(data));
  }, [data]);

  if (isLoading || !data || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  const original = pickEditable(data);
  const changed = (Object.keys(form) as (keyof Editable)[]).filter((k) => JSON.stringify(form[k]) !== JSON.stringify(original[k]));
  const dirty = changed.length > 0;
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const depositInvalid = form.depositRequired && form.depositAmountSurgery <= 0 && form.depositAmountSecondOpinion <= 0;
  const contactInvalid =
    !/^\+?[0-9]{10,15}$/.test(form.contactPersonPhone) || !/^\S+@\S+\.\S+$/.test(form.contactPersonEmail) || form.contactPersonName.trim().length < 2;

  function submit() {
    if (!form) return;
    const patch = Object.fromEntries(changed.map((k) => [k, k === "description" ? (form.description?.trim() || null) : form[k]]));
    save.mutate(patch as Partial<Settings>);
  }

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title="Hospital settings"
        description="Your public profile, contact details and booking terms."
        actions={
          <Button asChild variant="outline">
            <Link to={`/hospitals/${data.slug}`} target="_blank">
              View public profile <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Section title="Public profile" desc="What patients see on your hospital page.">
        <div className="grid gap-4 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-3">
          <ReadOnly label="Hospital name" value={data.name} />
          <ReadOnly label="City" value={data.city} />
          <div>
            <p className="text-xs text-muted-foreground">Verification</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <HospitalStatusBadge status={data.status} />
              {data.accreditations.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  <ShieldCheck className="h-3 w-3" /> {a}
                </span>
              ))}
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-3">
            <Lock className="h-3 w-3" /> Name, city and accreditations are verified details — contact support to change them.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-desc">About the hospital</Label>
          <Textarea id="s-desc" rows={4} maxLength={4000} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-address">Address</Label>
          <Input id="s-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-spec">Specialities</Label>
          <TagInput id="s-spec" value={form.specialities} onChange={(v) => set("specialities", v)} suggestions={SPECIALITY_SUGGESTIONS} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-fac">Facilities</Label>
          <TagInput id="s-fac" value={form.facilities} onChange={(v) => set("facilities", v)} suggestions={FACILITY_SUGGESTIONS} />
        </div>
      </Section>

      <Section
        title={paymentsEnabled ? "Booking & deposits" : "Callback commitment"}
        desc={
          paymentsEnabled
            ? "Set how quickly you commit to call patients back, and whether you take a refundable deposit."
            : "Set how quickly you commit to call patients back after they send a request."
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Callback commitment</Label>
              <div className="flex flex-wrap gap-2">
                {SLA_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set("slaCallbackHours", h)}
                    aria-pressed={form.slaCallbackHours === h}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                      form.slaCallbackHours === h ? "border-primary-600 bg-primary-600 text-white" : "border-border hover:bg-muted",
                    )}
                  >
                    {h} hours
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Your inbox counts down to this deadline
                {paymentsEnabled ? ". If you take deposits, patients not called in time are refunded automatically." : "."}
              </p>
            </div>

            {paymentsEnabled && (
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-4">
              <span>
                <span className="block text-sm font-semibold">Take a refundable booking deposit</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Filters out casual enquiries. Patients verify their ID and pay before the callback; it's adjusted against their bill.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.depositRequired}
                onClick={() => set("depositRequired", !form.depositRequired)}
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
                  form.depositRequired ? "bg-primary-600" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    form.depositRequired ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </button>
            </label>
            )}

            {paymentsEnabled && form.depositRequired && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-dep-s">Surgery deposit (₹)</Label>
                  <Input
                    id="s-dep-s"
                    type="number"
                    min={0}
                    step={100}
                    value={form.depositAmountSurgery}
                    onChange={(e) => set("depositAmountSurgery", Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-dep-o">Second-opinion deposit (₹)</Label>
                  <Input
                    id="s-dep-o"
                    type="number"
                    min={0}
                    step={100}
                    value={form.depositAmountSecondOpinion}
                    onChange={(e) => set("depositAmountSecondOpinion", Math.max(0, Number(e.target.value)))}
                  />
                </div>
                {depositInvalid && <p className="text-xs text-destructive sm:col-span-2">Set at least one deposit amount, or turn deposits off.</p>}
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground sm:col-span-2">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" /> Changes apply to new requests only — existing ones keep the terms they were booked under.
                </p>
              </div>
            )}
          </div>

          {/* Live preview of the patient-facing panel */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patients will see</p>
            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-soft">
              <div className="space-y-2 p-4">
                <p className="font-display text-sm font-semibold">{data.name}</p>
                <span className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">
                  Request surgery callback
                </span>
              </div>
              <div className="border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                {form.depositRequired && !depositInvalid ? (
                  <p className="flex items-start gap-2">
                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                    <span>
                      Refundable deposit of {formatCurrency(form.depositAmountSurgery)} (surgery) / {formatCurrency(form.depositAmountSecondOpinion)}{" "}
                      (second opinion).{" "}
                      <span className="font-medium text-foreground">Full refund if no call within {form.slaCallbackHours}h.</span>
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center gap-2">
                    <BadgeCheck className="h-3.5 w-3.5 text-success" /> Free callback — no deposit required
                  </p>
                )}
              </div>
              <p className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] font-medium text-primary-700">
                <span className="font-normal text-muted-foreground">Search card badge:</span>
                <Timer className="h-3 w-3" /> {form.depositRequired && !depositInvalid ? `Call in ${form.slaCallbackHours}h, guaranteed` : "Free callback"}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Contact person" desc="Receives new-enquiry alerts, verification updates and platform notices.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-cn">Name</Label>
            <Input id="s-cn" value={form.contactPersonName} onChange={(e) => set("contactPersonName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-cp">Mobile (for SMS alerts)</Label>
            <Input id="s-cp" value={form.contactPersonPhone} onChange={(e) => set("contactPersonPhone", e.target.value.replace(/[\s-]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-ce">Email</Label>
            <Input id="s-ce" type="email" value={form.contactPersonEmail} onChange={(e) => set("contactPersonEmail", e.target.value)} />
          </div>
        </div>
        {contactInvalid && <p className="text-xs text-destructive">Enter a valid name, 10–15 digit mobile and email.</p>}
      </Section>

      {/* Sticky save bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur transition-transform md:left-64",
          dirty ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <p className="text-sm text-muted-foreground">
            {changed.length} unsaved {changed.length === 1 ? "change" : "changes"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setForm(original)}>
              Discard
            </Button>
            <Button disabled={save.isPending || depositInvalid || contactInvalid} onClick={submit}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
