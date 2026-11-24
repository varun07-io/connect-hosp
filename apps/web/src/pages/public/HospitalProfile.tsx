import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  Info,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Star,
  Stethoscope,
  Wallet,
} from "lucide-react";
import type { EnquiryIntent } from "@connect-hospital/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookingDialog } from "@/components/shared/BookingDialog";
import { useHospitalProfile } from "@/hooks/useApiQueries";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { loginPathFor } from "@/lib/redirect";

// Leaflet is a heavy, map-only dependency — keep it out of the main bundle.
const HospitalMap = lazy(() => import("@/components/shared/HospitalMap").then((m) => ({ default: m.HospitalMap })));

function parseIntent(value: string | null): EnquiryIntent | null {
  if (!value) return null;
  const v = value.toUpperCase().replace("-", "_");
  return v === "SURGERY" || v === "SECOND_OPINION" ? v : null;
}

export function HospitalProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: hospital, isLoading } = useHospitalProfile(slug);
  const { isAuthenticated, isLoading: authLoading, me } = useAuth();
  const navigate = useNavigate();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingIntent, setBookingIntent] = useState<EnquiryIntent>("SURGERY");
  const [bookingTreatment, setBookingTreatment] = useState<string | undefined>();
  const [roleNotice, setRoleNotice] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  // Visitors arriving from "Get a second opinion" see that as the primary action.
  const preferredIntent: EnquiryIntent = parseIntent(searchParams.get("intent")) ?? "SURGERY";

  function startBooking(intent: EnquiryIntent, treatmentId?: string) {
    if (!isAuthenticated) {
      const qs = new URLSearchParams({ book: intent });
      if (treatmentId) qs.set("treatment", treatmentId);
      navigate(loginPathFor(`/hospitals/${slug}?${qs.toString()}`));
      return;
    }
    if (me?.user.role !== "PATIENT") {
      setRoleNotice("You're signed in as staff — log in with a patient account to request a callback.");
      return;
    }
    setRoleNotice(null);
    setBookingIntent(intent);
    setBookingTreatment(treatmentId);
    setBookingOpen(true);
  }

  // Resume a booking started before login (`?book=SURGERY&treatment=…`).
  useEffect(() => {
    const intent = parseIntent(searchParams.get("book"));
    if (!intent || !hospital || authLoading) return;
    const treatment = searchParams.get("treatment") ?? undefined;
    const next = new URLSearchParams(searchParams);
    next.delete("book");
    next.delete("treatment");
    setSearchParams(next, { replace: true });
    startBooking(intent, treatment);
  }, [hospital, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="container space-y-4 py-8">
        <Skeleton className="h-56 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={Stethoscope}
          title="Hospital not found"
          description="It may not be listed yet, or the link is incorrect."
          action={
            <Button asChild variant="outline">
              <Link to="/search">Browse verified hospitals</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const prices = [...hospital.treatmentPrices].sort((a, b) => Number(a.indicativePrice) - Number(b.indicativePrice));
  const fromPrice = prices[0] ? Number(prices[0].indicativePrice) : null;
  const deposit = {
    required: hospital.depositRequired,
    surgery: hospital.depositAmountSurgery,
    secondOpinion: hospital.depositAmountSecondOpinion,
    slaCallbackHours: hospital.slaCallbackHours ?? 48,
  };
  const secondaryIntent: EnquiryIntent = preferredIntent === "SURGERY" ? "SECOND_OPINION" : "SURGERY";
  const intentLabel = (i: EnquiryIntent) => (i === "SURGERY" ? "Request surgery callback" : "Get a second opinion");
  const IntentIcon = (i: EnquiryIntent) => (i === "SURGERY" ? PhoneCall : HeartHandshake);
  const PrimaryIcon = IntentIcon(preferredIntent);
  const SecondaryIcon = IntentIcon(secondaryIntent);

  return (
    <div className="pb-24 lg:pb-0">
      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-b from-primary-50/70 to-background">
        <div className="container py-6 md:py-8">
          <Link to="/search" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to results
          </Link>
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-muted md:h-32 md:w-48">
              {hospital.photos[0] && <img src={hospital.photos[0]} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold md:text-3xl">{hospital.name}</h1>
                {hospital.status === "APPROVED" && (
                  <Badge variant="success">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {hospital.address}, {hospital.city}
                </span>
                {hospital.avgRating !== null && (
                  <button onClick={() => setTab("reviews")} className="flex items-center gap-1 font-medium text-amber-700 hover:underline">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" /> {hospital.avgRating.toFixed(1)}
                    <span className="font-normal text-muted-foreground">({hospital.reviews.length} reviews)</span>
                  </button>
                )}
                <span className="flex items-center gap-1">
                  <Stethoscope className="h-4 w-4" /> {hospital.doctors.length} doctors
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hospital.accreditations.map((a) => (
                  <Badge key={a} variant="outline" className="border-green-200 bg-green-50 text-green-800">
                    <BadgeCheck className="h-3 w-3" /> {a}
                  </Badge>
                ))}
                {hospital.specialities.map((s) => (
                  <Badge key={s} variant="muted">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          {roleNotice && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {roleNotice}
            </div>
          )}
        </div>
      </div>

      <BookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        hospitalId={hospital.id}
        hospitalName={hospital.name}
        treatments={prices.map((p) => ({ id: p.treatment.id, name: p.treatment.name, price: Number(p.indicativePrice), currency: p.currency }))}
        defaultIntent={bookingIntent}
        defaultTreatmentId={bookingTreatment}
        deposit={deposit}
      />

      <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="prices">Costs ({prices.length})</TabsTrigger>
              <TabsTrigger value="doctors">Doctors ({hospital.doctors.length})</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({hospital.reviews.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {hospital.description && <p className="text-sm leading-relaxed text-muted-foreground">{hospital.description}</p>}

              {prices.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold">Most affordable procedures here</h3>
                    <button onClick={() => setTab("prices")} className="text-xs font-medium text-primary-700 hover:underline">
                      See all costs
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {prices.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => startBooking("SURGERY", p.treatment.id)}
                        className="group flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-primary-300 hover:bg-primary-50/50"
                      >
                        <span>{p.treatment.name}</span>
                        <span className="font-semibold text-primary-700">{formatCurrency(Number(p.indicativePrice), p.currency)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 font-display text-sm font-semibold">Facilities</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {hospital.facilities.map((f) => (
                    <span key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" /> {f}
                    </span>
                  ))}
                </div>
              </div>

              {hospital.latitude && hospital.longitude && (
                <div>
                  <h3 className="mb-2 font-display text-sm font-semibold">Location</h3>
                  <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
                    <HospitalMap lat={hospital.latitude} lng={hospital.longitude} name={hospital.name} />
                  </Suspense>
                </div>
              )}
            </TabsContent>

            <TabsContent value="prices">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Treatment</th>
                      <th className="px-4 py-3 font-medium">Indicative cost</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.treatment.name}</p>
                          <p className="text-xs text-muted-foreground">{p.treatment.category}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary-700">{formatCurrency(Number(p.indicativePrice), p.currency)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="subtle" onClick={() => startBooking("SURGERY", p.treatment.id)}>
                            Request
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Indicative only — the doctor confirms your final estimate on the call.
              </p>
            </TabsContent>

            <TabsContent value="doctors">
              <div className="grid gap-4 sm:grid-cols-2">
                {hospital.doctors.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="flex gap-3 p-5">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>{initials(doc.user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-semibold">{doc.user.name}</p>
                        <p className="text-xs text-primary-700">{doc.specialisation}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {doc.qualifications} · {doc.experienceYears} yrs experience
                        </p>
                        {doc.bio && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{doc.bio}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {hospital.doctors.length === 0 && <p className="text-sm text-muted-foreground">No doctors listed yet.</p>}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4">
              {hospital.avgRating !== null && (
                <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <p className="font-display text-4xl font-bold">{hospital.avgRating.toFixed(1)}</p>
                  <div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.round(hospital.avgRating ?? 0) ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Based on {hospital.reviews.length} patient reviews</p>
                  </div>
                </div>
              )}
              {hospital.reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-500" : "fill-none text-muted-foreground"}`} />
                    ))}
                  </div>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                </div>
              ))}
              {hospital.reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky conversion panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <Card className="overflow-hidden shadow-card">
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Talk to a doctor here</p>
                  {fromPrice !== null && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Procedures from <span className="font-display text-lg font-bold text-primary-700">{formatCurrency(fromPrice)}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Button size="lg" className="w-full" onClick={() => startBooking(preferredIntent)}>
                    <PrimaryIcon className="h-4 w-4" /> {intentLabel(preferredIntent)}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => startBooking(secondaryIntent)}>
                    <SecondaryIcon className="h-4 w-4" /> {intentLabel(secondaryIntent)}
                  </Button>
                </div>
                <ol className="space-y-2.5 border-t border-border pt-4 text-sm">
                  {[
                    { icon: ClipboardList, text: "Share your condition — 2 minutes" },
                    { icon: Stethoscope, text: "Hospital assigns the right doctor" },
                    { icon: PhoneCall, text: "Doctor calls you at your chosen time" },
                  ].map((s) => (
                    <li key={s.text} className="flex items-center gap-2.5 text-muted-foreground">
                      <s.icon className="h-4 w-4 shrink-0 text-primary-600" /> {s.text}
                    </li>
                  ))}
                </ol>
              </CardContent>
              <div className="border-t border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
                {deposit.required ? (
                  <p className="flex items-start gap-2">
                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                    <span>
                      Refundable deposit of {formatCurrency(deposit.surgery)} (surgery) / {formatCurrency(deposit.secondOpinion)} (second
                      opinion). <span className="font-medium text-foreground">Full refund if no call within {deposit.slaCallbackHours}h.</span>
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center gap-2">
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" /> Free callback — no deposit required
                  </p>
                )}
              </div>
            </Card>
          </div>
        </aside>
      </div>

      {/* Mobile CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="container flex items-center gap-3 px-0">
          <div className="min-w-0 flex-1">
            {fromPrice !== null ? (
              <p className="text-xs text-muted-foreground">
                from <span className="font-display text-base font-bold text-primary-700">{formatCurrency(fromPrice)}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Pricing on call</p>
            )}
            <p className="truncate text-[11px] text-muted-foreground">
              {deposit.required ? `Refundable deposit · ${deposit.slaCallbackHours}h callback guarantee` : "Free doctor callback"}
            </p>
          </div>
          <Button variant="outline" size="icon" aria-label={intentLabel(secondaryIntent)} onClick={() => startBooking(secondaryIntent)}>
            <SecondaryIcon className="h-4 w-4" />
          </Button>
          <Button onClick={() => startBooking(preferredIntent)}>
            <PrimaryIcon className="h-4 w-4" /> {preferredIntent === "SURGERY" ? "Request callback" : "Second opinion"}
          </Button>
        </div>
      </div>
    </div>
  );
}
