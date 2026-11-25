import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Copy, ExternalLink, Info, MapPin, Navigation, Search, Share2, Stethoscope } from "lucide-react";
import { schemeName } from "@connect-hospital/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SchemeBadge } from "@/components/govt/GovtHospitalCard";
import { useGovtHospitals, type GovtHospital } from "@/hooks/useGovtHospitals";
import { avatarLetter, directionsUrl, locationLine, mapsQuery, typeTone } from "@/lib/govtDirectory";
import { toast } from "@/hooks/useToast";
import { cn, formatDate } from "@/lib/utils";

/** Split specialities into surgical/procedural vs everything else — easier to scan. */
const SURGICAL = /surg|transplant|implant|procedure|tkr|thr|rirs|package|trauma|burns/i;

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${what} copied`, variant: "success" });
  } catch {
    toast({ title: `Couldn't copy ${what.toLowerCase()}`, variant: "destructive" });
  }
}

export function GovtHospitalDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGovtHospitals();
  const hospital = data?.items.find((h) => h.id === id);

  React.useEffect(() => {
    if (hospital) document.title = `${hospital.name} · Government hospital · Connect Hospital`;
  }, [hospital]);

  if (isLoading) {
    return (
      <div className="container space-y-4 py-8">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={Building2}
          title="Hospital not found"
          description="It may have been removed from the list, or the link is incorrect."
          action={
            <Button asChild variant="outline">
              <Link to="/government-hospitals">Browse government hospitals</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <DetailView h={hospital} all={data!.items} />;
}

function DetailView({ h, all }: { h: GovtHospital; all: GovtHospital[] }) {
  const tone = typeTone(h.subType);
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const specs = h.specialities.filter((s) => !needle || s.toLowerCase().includes(needle));
  const groups = [
    { title: "Surgery & procedures", items: specs.filter((s) => SURGICAL.test(s)) },
    { title: "Medical care & other services", items: specs.filter((s) => !SURGICAL.test(s)) },
  ].filter((g) => g.items.length);

  // Nearby: same district, same taluk first, then most specialities in common.
  const nearby = React.useMemo(
    () =>
      all
        .filter((o) => o.id !== h.id && o.district === h.district)
        .map((o) => ({ o, shared: o.specialities.filter((s) => h.specialities.includes(s)).length, sameTaluk: o.taluk === h.taluk }))
        .sort((a, b) => Number(b.sameTaluk) - Number(a.sameTaluk) || b.shared - a.shared)
        .slice(0, 5),
    [all, h],
  );

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: h.name, text: `${h.name} — ${h.address ?? locationLine(h)}`, url });
        return;
      } catch {
        /* cancelled — fall back to copying */
      }
    }
    copy(url, "Link");
  }

  return (
    <div className="bg-muted/20 pb-12">
      <section className="border-b border-border bg-gradient-to-b from-primary-50 to-background">
        <div className="container py-6 md:py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <span>/</span>
            <Link to="/government-hospitals" className="hover:text-foreground">
              Government hospitals
            </Link>
            <span>/</span>
            <span className="truncate text-foreground">{h.name}</span>
          </nav>

          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <span
              className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-bold text-white shadow-card", tone.solid)}
              aria-hidden
            >
              {avatarLetter(h.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold leading-tight md:text-3xl">{h.name}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {h.subType && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", tone.badge)}>{h.subType}</span>}
                {h.schemes.map((s) => (
                  <SchemeBadge key={s} code={s} className="text-xs" />
                ))}
              </div>
              {h.address && (
                <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" /> {h.address}
                </p>
              )}
              <p className="mt-1 pl-[22px] text-xs text-muted-foreground">
                {h.taluk ? `${h.taluk} taluk · ` : ""}
                {h.district} district
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <a href={directionsUrl(h)} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-4 w-4" /> Get directions
                  </a>
                </Button>
                {h.address && (
                  <Button variant="outline" onClick={() => copy(`${h.name}, ${h.address}`, "Address")}>
                    <Copy className="h-4 w-4" /> Copy address
                  </Button>
                )}
                <Button variant="outline" onClick={share}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-6 py-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-background p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Stethoscope className="h-5 w-5 text-primary-600" /> Specialities & services
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{h.specialities.length}</span>
              </h2>
              {h.specialities.length > 10 && (
                <div className="relative sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Find a speciality"
                    className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              )}
            </div>
            {groups.map((g) => (
              <div key={g.title} className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((s) => (
                    <Link
                      key={s}
                      to={`/government-hospitals?spec=${encodeURIComponent(s)}&district=${encodeURIComponent(h.district)}`}
                      title={`Other ${h.district} hospitals offering ${s}`}
                      className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                    >
                      {s}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {specs.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No specialities match “{q}”.</p>}
            <p className="mt-5 text-xs text-muted-foreground">Tip: click a speciality to see other hospitals in {h.district} that offer it.</p>
          </section>

          <section className="rounded-2xl border border-border bg-background p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-lg font-semibold">About this listing</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              {h.schemes.length > 0 && (
                <Field label="Empanelled under">
                  {h.schemes.map((s) => (
                    <span key={s} className="block">
                      {schemeName(s)} <span className="text-muted-foreground">({s})</span>
                    </span>
                  ))}
                </Field>
              )}
              {h.refId && (
                <Field label="Empanelment Ref-ID">
                  <button onClick={() => copy(h.refId!, "Ref-ID")} className="inline-flex items-center gap-1.5 font-mono text-sm hover:text-primary-700">
                    {h.refId} <Copy className="h-3.5 w-3.5" />
                  </button>
                </Field>
              )}
              {h.subType && <Field label="Hospital type">{h.subType}</Field>}
              <Field label="Listing updated">{formatDate(h.updatedAt)}</Field>
            </dl>
            <p className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Details are shown as published in the empanelment list. Please confirm services and scheme eligibility with the hospital before
              visiting.
            </p>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-soft">
            <iframe
              title={`Map of ${h.name}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery(h))}&output=embed`}
              className="h-72 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={directionsUrl(h)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium text-primary-700 hover:bg-muted/50"
            >
              Open in Google Maps <ExternalLink className="h-4 w-4" />
            </a>
          </section>

          {nearby.length > 0 && (
            <section className="rounded-2xl border border-border bg-background p-5 shadow-soft">
              <h2 className="font-display text-base font-semibold">More government hospitals in {h.district}</h2>
              <ul className="mt-3 divide-y divide-border">
                {nearby.map(({ o, shared }) => (
                  <li key={o.id}>
                    <Link to={`/government-hospitals/${o.id}`} className="group flex items-center gap-3 py-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", typeTone(o.subType).solid)}>
                        {avatarLetter(o.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium group-hover:text-primary-700">{o.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {shared > 0 ? `${shared} specialit${shared === 1 ? "y" : "ies"} in common` : o.subType}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button asChild variant="ghost" className="w-full">
            <Link to="/government-hospitals">
              <ArrowLeft className="h-4 w-4" /> Back to all government hospitals
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
