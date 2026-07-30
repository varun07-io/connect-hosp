import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Stethoscope, ArrowRight, Quote, ShieldCheck, Wallet, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CityAutocomplete } from "@/components/shared/CityAutocomplete";
import { HospitalCard } from "@/components/shared/HospitalCard";
import { useHospitalSearch } from "@/hooks/useApiQueries";
import { Skeleton } from "@/components/ui/skeleton";
import { SURGERY_CATEGORIES } from "@/lib/surgeryCategories";
import { initials } from "@/lib/utils";

const PILOT_CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"];

const STEPS = [
  { step: "1", title: "Search & compare", desc: "Filter by location, treatment and budget to shortlist hospitals." },
  { step: "2", title: "Book a visit or opinion", desc: "Share your condition and, if you like, attach medical records." },
  { step: "3", title: "Get a guided callback", desc: "A hospital doctor calls you within minutes to guide next steps." },
];

const TESTIMONIALS = [
  {
    quote: "Compared three hospitals here and the cost difference was huge. The doctor called back the same afternoon.",
    name: "Ramesh Kumar",
    context: "Knee Replacement · Bengaluru",
  },
  {
    quote: "Clean, transparent pricing and a real conversation with a doctor before I committed to anything.",
    name: "Sunita Verma",
    context: "Second opinion · Mysuru",
  },
  {
    quote: "Straightforward process from search to callback. I knew the indicative cost before I even visited.",
    name: "Arjun Menon",
    context: "Cataract Surgery · Mangaluru",
  },
];

export function Home() {
  const [city, setCity] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading } = useHospitalSearch({ page: 1 });

  // Jump to the #for-hospitals CTA when arriving via the nav link from another page
  // (React Router doesn't auto-scroll to hash targets on route change).
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/search${city.trim() ? `?city=${encodeURIComponent(city.trim())}` : ""}`);
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-background to-background">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-100 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-primary-100 blur-3xl" />
        <div className="container relative pb-10 pt-10 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="accent" className="mb-3">Compare surgery costs across verified hospitals</Badge>
            <h1 className="text-balance font-display text-3xl font-bold leading-[1.15] sm:text-4xl md:text-5xl md:leading-[1.1]">
              Elective surgery, <span className="text-primary-600">at the right price</span>
            </h1>
            <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
              Compare hospitals by location, surgery cost, doctors and rating — then book a guided callback from a
              real person at the hospital.
            </p>
          </div>

          {/* Location and procedure are the two equally-valid ways to start a
              search, so they live in one panel, both visible without scrolling —
              not a hero search bar followed by a separate section further down. */}
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-border bg-background/90 p-3 shadow-lift backdrop-blur sm:p-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search by location</p>
            <form onSubmit={onSearch} className="mt-2 flex flex-col gap-2 sm:flex-row">
              <CityAutocomplete
                value={city}
                onChange={setCity}
                onSelect={(c) => navigate(`/search?city=${encodeURIComponent(c)}`)}
                popularCities={PILOT_CITIES}
                placeholder="Search any city in India"
                className="flex-1 rounded-xl border border-border sm:border-0"
                inputClassName="h-11"
              />
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </form>

            <div className="my-3 flex items-center gap-3 px-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">or browse by procedure</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {SURGERY_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => navigate(`/search?categories=${encodeURIComponent(cat.name)}`)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  <cat.icon className="h-4 w-4 text-primary-600" />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary trust signals — kept below the location+procedure panel
              on mobile so that panel stays inside the first viewport; they're
              a short scroll away rather than competing for the same fold. */}
          <div className="mx-auto mt-4 hidden max-w-xl flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:flex">
            {[
              { icon: ShieldCheck, text: "Verified hospitals only" },
              { icon: Wallet, text: "No booking fee" },
              { icon: PhoneCall, text: "Free doctor callback" },
            ].map((t) => (
              <span key={t.text} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <t.icon className="h-3.5 w-3.5 text-primary-600" />
                {t.text}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-6 hidden max-w-2xl grid-cols-3 divide-x divide-border rounded-xl border border-border bg-background/70 py-4 text-center sm:grid md:mt-10">
            <div>
              <p className="font-display text-2xl font-bold text-primary-700">{isLoading ? "—" : `${data?.total ?? 0}+`}</p>
              <p className="text-xs text-muted-foreground">Verified hospitals</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-primary-700">100%</p>
              <p className="text-xs text-muted-foreground">Transparent pricing</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-primary-700">Minutes</p>
              <p className="text-xs text-muted-foreground">To a guided callback</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Verified hospitals near you</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live from the pilot catalogue.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/search")}>
            View all <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[340px] rounded-xl" />)}
          {!isLoading && data?.items.slice(0, 6).map((hospital) => <HospitalCard key={hospital.id} hospital={hospital} />)}
          {!isLoading && data?.items.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No verified hospitals yet — run the seed script to populate the pilot catalogue.
            </p>
          )}
        </div>
      </section>

      <section className="bg-muted/40 py-16">
        <div className="container">
          <h2 className="text-center font-display text-2xl font-bold">How Connect Hospital works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="relative rounded-xl border border-border bg-background p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white">
                  {s.step}
                </span>
                <p className="mt-4 font-display text-base font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-16">
        <h2 className="text-center font-display text-2xl font-bold">What patients say</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name}>
              <CardContent className="p-6">
                <Quote className="h-6 w-6 text-primary-200" />
                <p className="mt-3 text-sm leading-relaxed text-foreground">{t.quote}</p>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(t.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.context}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="for-hospitals" className="container py-16">
        <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-primary-600 px-8 py-12 text-center text-white md:flex-row md:text-left">
          <div>
            <h2 className="font-display text-2xl font-bold">Are you a hospital?</h2>
            <p className="mt-2 max-w-md text-primary-50">
              Get a qualified, intent-rich enquiry channel with instant SMS/WhatsApp alerts and a dashboard to
              manage doctors, prices and enquiries.
            </p>
          </div>
          <Button variant="accent" size="lg" onClick={() => navigate("/login")}>
            <Stethoscope className="h-4 w-4" />
            List your hospital for free
          </Button>
        </div>
      </section>
    </div>
  );
}
