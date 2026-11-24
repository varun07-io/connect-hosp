import * as React from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  PhoneCall,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/shared/TagInput";
import { SPECIALITY_SUGGESTIONS } from "@/lib/hospitalVocab";
import { apiErrorMessage, useRegisterHospital, type RegisterHospitalInput } from "@/hooks/useHospitalAdmin";

const BENEFITS = [
  { icon: Users, title: "Patients who are ready to decide", desc: "Every enquiry comes with a condition summary, a preferred callback time and, often, reports." },
  { icon: Wallet, title: "Free to list during the pilot", desc: "No listing or subscription fee. Optionally take a refundable deposit to filter serious enquiries." },
  { icon: LayoutDashboard, title: "One dashboard for your team", desc: "Enquiry inbox with callback deadlines, doctor assignment, price list and profile — all in one place." },
  { icon: ShieldCheck, title: "A verified badge patients trust", desc: "Only hospitals our team has verified appear in search." },
];

const EMPTY: RegisterHospitalInput = {
  name: "",
  city: "",
  address: "",
  description: "",
  specialities: [],
  contactPersonName: "",
  contactPersonPhone: "",
  contactPersonEmail: "",
  website: "",
};

export function RegisterHospital() {
  const register = useRegisterHospital();
  const [form, setForm] = React.useState<RegisterHospitalInput>(EMPTY);
  const [authorised, setAuthorised] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (register.isSuccess) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [register.isSuccess]);

  const set = <K extends keyof RegisterHospitalInput>(key: K, value: RegisterHospitalInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const errors: Partial<Record<keyof RegisterHospitalInput, string>> = {};
  if (form.name.trim().length < 3) errors.name = "Enter the hospital's registered name";
  if (form.city.trim().length < 2) errors.city = "Enter the city";
  if (form.address.trim().length < 5) errors.address = "Enter the full address";
  if (form.specialities.length === 0) errors.specialities = "Add at least one speciality";
  if (form.contactPersonName.trim().length < 2) errors.contactPersonName = "Enter a contact name";
  if (!/^\+?[0-9]{10,15}$/.test(form.contactPersonPhone.replace(/[\s-]/g, ""))) errors.contactPersonPhone = "Enter a 10-digit mobile number";
  if (!/^\S+@\S+\.\S+$/.test(form.contactPersonEmail.trim())) errors.contactPersonEmail = "Enter a valid email";
  const valid = Object.keys(errors).length === 0 && authorised;
  const show = (k: keyof RegisterHospitalInput) => (touched ? errors[k] : undefined);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    register.mutate({
      ...form,
      contactPersonPhone: form.contactPersonPhone.replace(/[\s-]/g, ""),
      description: form.description?.trim() || undefined,
    });
  }

  if (register.isSuccess) {
    return (
      <div className="container max-w-2xl py-12 md:py-16">
        <Card className="shadow-card">
          <CardContent className="p-6 text-center sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold">Registration received</h1>
            <p className="mt-2 text-muted-foreground">
              Thanks — <span className="font-medium text-foreground">{register.data.name}</span> is in our verification queue.
              Your reference is <span className="font-mono font-semibold text-foreground">#{register.data.reference}</span>.
            </p>
            <ol className="mx-auto mt-8 max-w-md space-y-4 text-left">
              {[
                { icon: ClipboardCheck, title: "Verification review", desc: "Our team reviews your details, usually within 2 working days." },
                { icon: FileCheck2, title: "Documents (if needed)", desc: "We may ask for your registration certificate or accreditation proof by email." },
                { icon: KeyRound, title: "Dashboard access", desc: "Once approved, your contact person gets a login to add doctors and prices — then you go live." },
              ].map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {i + 1}. {s.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button asChild variant="outline" className="mt-8">
              <Link to="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-primary-50/70 to-background">
      <div className="container grid gap-10 py-10 md:py-14 lg:grid-cols-[1fr_560px]">
        <div className="lg:pt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-800">
            <Building2 className="h-3.5 w-3.5" /> For hospitals
          </span>
          <h1 className="mt-4 text-balance font-display text-3xl font-bold leading-tight md:text-4xl">
            Reach patients comparing surgery options — <span className="text-primary-600">in your city</span>
          </h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            List your hospital in about 3 minutes. Our team verifies every listing before it goes live.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
                  <b.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold">{b.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <PhoneCall className="h-4 w-4 text-primary-600" /> Already listed?{" "}
            <Link to="/login" className="font-medium text-primary-700 hover:underline">
              Sign in to your dashboard
            </Link>
          </p>
        </div>

        <Card className="shadow-lift">
          <CardContent className="p-5 sm:p-7">
            <form onSubmit={submit} noValidate className="space-y-6">
              <fieldset className="space-y-4">
                <legend className="mb-1 font-display text-base font-semibold">Hospital details</legend>
                <Field label="Hospital name" error={show("name")} htmlFor="h-name">
                  <Input id="h-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sunrise Multispeciality Hospital" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                  <Field label="City" error={show("city")} htmlFor="h-city">
                    <Input id="h-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Bengaluru" />
                  </Field>
                  <Field label="Address" error={show("address")} htmlFor="h-address">
                    <Input id="h-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, area, PIN code" />
                  </Field>
                </div>
                <Field label="Specialities" error={show("specialities")} htmlFor="h-spec">
                  <TagInput
                    id="h-spec"
                    value={form.specialities}
                    onChange={(v) => set("specialities", v)}
                    suggestions={SPECIALITY_SUGGESTIONS.slice(0, 8)}
                    placeholder="Add a speciality"
                  />
                </Field>
                <Field label="About the hospital" hint="Optional — shown on your public profile" htmlFor="h-desc">
                  <Textarea
                    id="h-desc"
                    rows={3}
                    maxLength={4000}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Beds, years of service, flagship procedures, what patients value about you."
                  />
                </Field>
              </fieldset>

              <fieldset className="space-y-4 border-t border-border pt-5">
                <legend className="mb-1 font-display text-base font-semibold">Contact person</legend>
                <p className="-mt-2 text-xs text-muted-foreground">They'll receive verification updates and dashboard access.</p>
                <Field label="Full name" error={show("contactPersonName")} htmlFor="h-cname">
                  <Input id="h-cname" value={form.contactPersonName} onChange={(e) => set("contactPersonName", e.target.value)} autoComplete="name" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mobile" error={show("contactPersonPhone")} htmlFor="h-phone">
                    <Input
                      id="h-phone"
                      inputMode="tel"
                      autoComplete="tel"
                      value={form.contactPersonPhone}
                      onChange={(e) => set("contactPersonPhone", e.target.value)}
                      placeholder="98765 43210"
                    />
                  </Field>
                  <Field label="Work email" error={show("contactPersonEmail")} htmlFor="h-email">
                    <Input
                      id="h-email"
                      type="email"
                      autoComplete="email"
                      value={form.contactPersonEmail}
                      onChange={(e) => set("contactPersonEmail", e.target.value)}
                      placeholder="admin@hospital.in"
                    />
                  </Field>
                </div>
              </fieldset>

              {/* Honeypot: hidden from people, irresistible to form bots. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={authorised}
                  onChange={(e) => setAuthorised(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-primary-600"
                />
                <span className="text-muted-foreground">
                  I'm authorised to list this hospital, and the details above are accurate. Connect Hospital may contact us to verify them.
                </span>
              </label>
              {touched && !authorised && <p className="-mt-4 text-xs text-destructive">Please confirm you're authorised to list this hospital.</p>}

              {register.isError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">{apiErrorMessage(register.error)}</p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
                {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                Submit for verification
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
