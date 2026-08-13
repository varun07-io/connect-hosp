import { Suspense, lazy, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Star, ShieldCheck, Stethoscope, PhoneCall, HeartHandshake, Info } from "lucide-react";
import type { EnquiryIntent } from "@connect-hospital/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingDialog } from "@/components/shared/BookingDialog";
import { useHospitalProfile } from "@/hooks/useApiQueries";

// Leaflet is a heavy, map-only dependency — keep it out of the main bundle.
const HospitalMap = lazy(() => import("@/components/shared/HospitalMap").then((m) => ({ default: m.HospitalMap })));
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export function HospitalProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { data: hospital, isLoading } = useHospitalProfile(slug);
  const { isAuthenticated, me } = useAuth();
  const navigate = useNavigate();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingIntent, setBookingIntent] = useState<EnquiryIntent>("SURGERY");
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

  function startBooking(intent: EnquiryIntent) {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (me?.user.role !== "PATIENT") {
      setRoleNotice("You're signed in as staff — log in as a patient account to book a visit or request a second opinion.");
      return;
    }
    setRoleNotice(null);
    setBookingIntent(intent);
    setBookingOpen(true);
  }

  if (isLoading) {
    return (
      <div className="container space-y-4 py-8">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!hospital) {
    return <div className="container py-16 text-center text-muted-foreground">Hospital not found.</div>;
  }

  return (
    <div>
      <div className="border-b border-border bg-muted/30">
        <div className="container flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold md:text-3xl">{hospital.name}</h1>
              {hospital.status === "APPROVED" && (
                <Badge variant="success"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
              )}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {hospital.address}, {hospital.city}</span>
              {hospital.avgRating && (
                <span className="flex items-center gap-1 font-medium text-amber-700">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" /> {hospital.avgRating.toFixed(1)} ({hospital.reviews.length} reviews)
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hospital.specialities.map((s) => <Badge key={s} variant="muted">{s}</Badge>)}
            </div>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button variant="outline" size="lg" onClick={() => startBooking("SECOND_OPINION")}>
              <HeartHandshake className="h-4 w-4" /> Get a second opinion
            </Button>
            <Button size="lg" onClick={() => startBooking("SURGERY")}>
              <PhoneCall className="h-4 w-4" /> Book a visit
            </Button>
          </div>
        </div>
        {roleNotice && (
          <div className="container pb-6">
            <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {roleNotice}
            </div>
          </div>
        )}
      </div>

      <BookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        hospitalId={hospital.id}
        hospitalName={hospital.name}
        treatments={hospital.treatmentPrices.map((p) => ({ id: p.treatment.id, name: p.treatment.name }))}
        defaultIntent={bookingIntent}
      />

      <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="doctors">Doctors ({hospital.doctors.length})</TabsTrigger>
              <TabsTrigger value="prices">Surgery costs</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({hospital.reviews.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <p className="text-sm leading-relaxed text-muted-foreground">{hospital.description}</p>

              <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/30 py-4 text-center">
                <div>
                  <p className="font-display text-xl font-bold text-primary-700">{hospital.doctors.length}</p>
                  <p className="text-xs text-muted-foreground">Doctors on staff</p>
                </div>
                <div>
                  <p className="font-display text-xl font-bold text-primary-700">{hospital.treatmentPrices.length}</p>
                  <p className="text-xs text-muted-foreground">Treatments priced</p>
                </div>
                <div>
                  <p className="font-display text-xl font-bold text-primary-700">{hospital.avgRating ? hospital.avgRating.toFixed(1) : "New"}</p>
                  <p className="text-xs text-muted-foreground">Patient rating</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-display text-sm font-semibold">Facilities</h3>
                <div className="flex flex-wrap gap-1.5">
                  {hospital.facilities.map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
                </div>
              </div>

              {hospital.accreditations.length > 0 && (
                <div>
                  <h3 className="mb-2 font-display text-sm font-semibold">Accreditations</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {hospital.accreditations.map((a) => (
                      <Badge key={a} variant="success"><ShieldCheck className="h-3 w-3" /> {a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {hospital.treatmentPrices.length > 0 && (
                <div>
                  <h3 className="mb-2 font-display text-sm font-semibold">Popular treatments here</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...hospital.treatmentPrices]
                      .sort((a, b) => Number(a.indicativePrice) - Number(b.indicativePrice))
                      .slice(0, 4)
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                          <span>{p.treatment.name}</span>
                          <span className="font-semibold text-primary-700">{formatCurrency(Number(p.indicativePrice), p.currency)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="doctors">
              <div className="grid gap-4 sm:grid-cols-2">
                {hospital.doctors.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="flex gap-3 p-5">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>{initials(doc.user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-display text-sm font-semibold">{doc.user.name}</p>
                        <p className="text-xs text-primary-700">{doc.specialisation}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{doc.qualifications} · {doc.experienceYears} yrs experience</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {hospital.doctors.length === 0 && (
                  <p className="text-sm text-muted-foreground">No doctors listed yet.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="prices">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Treatment</th>
                      <th className="px-4 py-3 font-medium">Indicative price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospital.treatmentPrices.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.treatment.name}</p>
                          <p className="text-xs text-muted-foreground">{p.treatment.category}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary-700">
                          {formatCurrency(Number(p.indicativePrice), p.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Indicative only — the hospital confirms final cost on callback.
              </p>
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4">
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

        <div className="space-y-4">
          {hospital.latitude && hospital.longitude && (
            <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
              <HospitalMap lat={hospital.latitude} lng={hospital.longitude} name={hospital.name} />
            </Suspense>
          )}
          <Card>
            <CardContent className="space-y-3 p-5 text-sm">
              <p className="flex items-center gap-2 font-display text-sm font-semibold"><Stethoscope className="h-4 w-4 text-primary-600" /> At a glance</p>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Doctors</span><span className="font-medium">{hospital.doctors.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Treatments priced</span><span className="font-medium">{hospital.treatmentPrices.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">City</span><span className="font-medium">{hospital.city}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
