import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Columns3,
  ExternalLink,
  MapPin,
  PhoneCall,
  Plus,
  ShieldCheck,
  Star,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { MAX_COMPARE, useCompare } from "@/context/CompareContext";
import { apiFetch } from "@/lib/apiClient";
import type { HospitalProfileResponse } from "@/types/api";
import { cn, formatCurrency } from "@/lib/utils";

interface PriceRow {
  treatmentId: string;
  name: string;
  category: string;
  prices: (number | null)[];
  lowest: number | null;
  offeredByAll: boolean;
}

export function Compare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const compare = useCompare();

  // URL is the shareable source of truth; fall back to the saved shortlist.
  const slugs = React.useMemo(() => {
    const fromUrl = (searchParams.get("h") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return (fromUrl.length ? fromUrl : compare.items.map((i) => i.slug)).slice(0, MAX_COMPARE);
  }, [searchParams, compare.items]);

  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ["hospital", slug],
      queryFn: () => apiFetch<HospitalProfileResponse>(`/api/hospitals/${slug}`),
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const hospitals = results.map((r) => r.data).filter((h): h is HospitalProfileResponse => Boolean(h));

  // Keep the saved shortlist in step with a shared/opened compare link.
  React.useEffect(() => {
    for (const h of hospitals) {
      if (!compare.has(h.slug) && compare.items.length < MAX_COMPARE) {
        compare.toggle({ slug: h.slug, name: h.name, city: h.city, photo: h.photos[0] });
      }
    }
  }, [hospitals.map((h) => h.slug).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  function removeColumn(slug: string) {
    compare.remove(slug);
    const next = slugs.filter((s) => s !== slug);
    // Built by hand so the shareable link keeps readable commas.
    navigate(next.length ? `/compare?h=${next.join(",")}` : "/compare", { replace: true });
  }

  const [category, setCategory] = React.useState<string>("all");
  const [commonOnly, setCommonOnly] = React.useState(false);

  const rows = React.useMemo<PriceRow[]>(() => {
    const byTreatment = new Map<string, PriceRow>();
    hospitals.forEach((h, col) => {
      for (const p of h.treatmentPrices) {
        const row =
          byTreatment.get(p.treatment.id) ??
          ({
            treatmentId: p.treatment.id,
            name: p.treatment.name,
            category: p.treatment.category,
            prices: hospitals.map(() => null),
            lowest: null,
            offeredByAll: false,
          } satisfies PriceRow);
        row.prices[col] = Number(p.indicativePrice);
        byTreatment.set(p.treatment.id, row);
      }
    });
    return [...byTreatment.values()]
      .map((r) => {
        const offered = r.prices.filter((p): p is number => p !== null);
        return { ...r, lowest: offered.length ? Math.min(...offered) : null, offeredByAll: offered.length === hospitals.length };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [hospitals]);

  const categories = React.useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const visibleRows = rows.filter((r) => (category === "all" || r.category === category) && (!commonOnly || r.offeredByAll));

  // "Lowest price on N of M shared treatments" — the single most useful summary.
  const sharedRows = rows.filter((r) => r.offeredByAll && hospitals.length > 1);
  const wins = hospitals.map((_, col) => sharedRows.filter((r) => r.prices[col] === r.lowest).length);
  const bestRating = Math.max(...hospitals.map((h) => h.avgRating ?? 0));

  if (slugs.length < 2 && !loading) {
    return (
      <div className="container py-12">
        <EmptyState
          icon={Columns3}
          title="Pick at least two hospitals to compare"
          description="Tap “Compare” on any hospital card to add it to your shortlist — you can compare up to three side by side."
          action={
            <Button asChild>
              <Link to="/search">Browse hospitals</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const gridCols = { gridTemplateColumns: `minmax(92px, 180px) repeat(${slugs.length}, minmax(136px, 1fr))` };

  return (
    <div className="bg-muted/20 pb-12">
      <div className="border-b border-border bg-background">
        <div className="container flex flex-col gap-3 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/search" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to search
            </Link>
            <h1 className="font-display text-2xl font-bold md:text-3xl">Compare hospitals</h1>
            <p className="mt-1 text-sm text-muted-foreground">Indicative costs, doctors, ratings and callback terms — side by side.</p>
          </div>
          {slugs.length < MAX_COMPARE && (
            <Button asChild variant="outline">
              <Link to="/search">
                <Plus className="h-4 w-4" /> Add a hospital
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="container py-6">
        {slugs.length > 2 && (
          <p className="mb-2 text-xs text-muted-foreground md:hidden">Swipe sideways to see all {slugs.length} hospitals →</p>
        )}
        <div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-soft">
          <div className="min-w-fit">
            {/* Hospital header row */}
            <div className="grid border-b border-border bg-background" style={gridCols}>
              <div className="sticky left-0 z-10 bg-background p-4" />
              {slugs.map((slug, col) => {
                const h = hospitals.find((x) => x.slug === slug);
                if (!h) {
                  return (
                    <div key={slug} className="border-l border-border p-4">
                      {results[col]?.isError ? (
                        <p className="text-sm text-muted-foreground">Couldn't load this hospital.</p>
                      ) : (
                        <Skeleton className="h-40 rounded-xl" />
                      )}
                    </div>
                  );
                }
                return (
                  <div key={slug} className="relative border-l border-border p-4">
                    <button
                      onClick={() => removeColumn(slug)}
                      className="absolute right-2 top-2 z-10 rounded-full bg-background/90 p-1 text-muted-foreground shadow-soft hover:text-foreground"
                      aria-label={`Remove ${h.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="h-20 overflow-hidden rounded-lg bg-muted">
                      {h.photos[0] && <img src={h.photos[0]} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <Link to={`/hospitals/${h.slug}`} className="mt-3 block font-display text-sm font-semibold leading-snug hover:text-primary-700">
                      {h.name}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {h.city}
                    </p>
                    {sharedRows.length > 0 && wins[col] > 0 && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                        <Trophy className="h-3 w-3" /> Lowest on {wins[col]} of {sharedRows.length} shared
                      </p>
                    )}
                    <Button asChild size="sm" className="mt-3 w-full">
                      <Link to={`/hospitals/${h.slug}?book=SURGERY`}>
                        <PhoneCall className="h-3.5 w-3.5" /> Request callback
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>

            {hospitals.length === slugs.length && (
              <>
                <SectionLabel cols={gridCols}>At a glance</SectionLabel>
                <Row label="Patient rating" cols={gridCols}>
                  {hospitals.map((h) => (
                    <Cell key={h.id} best={h.avgRating !== null && h.avgRating === bestRating && hospitals.length > 1}>
                      {h.avgRating !== null ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                          <span className="font-semibold">{h.avgRating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({h.reviews.length})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">New</span>
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label="Doctors" cols={gridCols}>
                  {hospitals.map((h) => (
                    <Cell key={h.id}>
                      <span className="font-semibold">{h.doctors.length}</span>
                      {h.doctors.length > 0 && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {[...new Set(h.doctors.map((d) => d.specialisation))].join(", ")}
                        </span>
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label="Callback terms" cols={gridCols}>
                  {hospitals.map((h) => (
                    <Cell key={h.id}>
                      {h.depositRequired ? (
                        <>
                          <span className="flex items-center gap-1 font-medium text-primary-700">
                            <Timer className="h-3.5 w-3.5" /> {h.slaCallbackHours}h guarantee
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Refundable deposit {formatCurrency(h.depositAmountSurgery)} / {formatCurrency(h.depositAmountSecondOpinion)}
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 font-medium text-green-700">
                          <BadgeCheck className="h-3.5 w-3.5" /> Free callback
                        </span>
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label="Accreditation" cols={gridCols}>
                  {hospitals.map((h) => (
                    <Cell key={h.id}>
                      {h.accreditations.length ? (
                        <span className="flex flex-wrap gap-1">
                          {h.accreditations.map((a) => (
                            <Badge key={a} variant="success">
                              <ShieldCheck className="h-3 w-3" /> {a}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label="Specialities" cols={gridCols}>
                  {hospitals.map((h) => (
                    <Cell key={h.id}>
                      <span className="text-xs leading-relaxed">{h.specialities.join(" · ")}</span>
                    </Cell>
                  ))}
                </Row>
                <Row label="Facilities" cols={gridCols}>
                  {hospitals.map((h) => (
                    <Cell key={h.id}>
                      <span className="text-xs leading-relaxed text-muted-foreground">{h.facilities.join(" · ")}</span>
                    </Cell>
                  ))}
                </Row>

                {/* Price matrix */}
                <div className="flex flex-col gap-3 border-b border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-display text-sm font-semibold">Indicative treatment costs</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {["all", ...categories].map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                          category === c ? "border-primary-600 bg-primary-600 text-white" : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                    <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={commonOnly} onChange={(e) => setCommonOnly(e.target.checked)} className="accent-primary-600" />
                      Offered by all
                    </label>
                  </div>
                </div>
                {visibleRows.map((r) => (
                  <Row
                    key={r.treatmentId}
                    cols={gridCols}
                    label={
                      <>
                        <span className="block font-medium text-foreground">{r.name}</span>
                        <span className="text-[11px] text-muted-foreground">{r.category}</span>
                      </>
                    }
                  >
                    {r.prices.map((price, col) => {
                      const isLowest = price !== null && price === r.lowest && r.prices.filter((p) => p !== null).length > 1;
                      return (
                        <Cell key={col} best={isLowest}>
                          {price === null ? (
                            <span className="text-xs text-muted-foreground">Not offered</span>
                          ) : (
                            <>
                              <span className={cn("font-display font-bold", isLowest ? "text-green-700" : "text-foreground")}>
                                {formatCurrency(price)}
                              </span>
                              {isLowest ? (
                                <span className="mt-0.5 block text-[11px] font-semibold text-green-700">Lowest</span>
                              ) : r.lowest !== null && price > r.lowest ? (
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">+{formatCurrency(price - r.lowest)}</span>
                              ) : null}
                            </>
                          )}
                        </Cell>
                      );
                    })}
                  </Row>
                ))}
                {visibleRows.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No treatments match this filter.</p>
                )}

                {/* Footer CTAs */}
                <div className="grid border-t border-border" style={gridCols}>
                  <div className="sticky left-0 bg-background p-4" />
                  {hospitals.map((h) => (
                    <div key={h.id} className="space-y-2 border-l border-border p-4">
                      <Button asChild size="sm" className="w-full">
                        <Link to={`/hospitals/${h.slug}?book=SURGERY`}>
                          <PhoneCall className="h-3.5 w-3.5" /> Request callback
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link to={`/hospitals/${h.slug}`}>
                          Full profile <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Prices are indicative and confirmed by the hospital's doctor on your callback.
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children, cols }: { children: React.ReactNode; cols: React.CSSProperties }) {
  return (
    <div className="grid border-b border-border bg-muted/40" style={cols}>
      <p className="sticky left-0 bg-muted/40 px-4 py-2.5 font-display text-sm font-semibold">{children}</p>
    </div>
  );
}

function Row({ label, children, cols }: { label: React.ReactNode; children: React.ReactNode; cols: React.CSSProperties }) {
  return (
    <div className="grid border-b border-border last:border-b-0" style={cols}>
      <div className="sticky left-0 z-10 bg-background px-4 py-3 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Cell({ children, best }: { children: React.ReactNode; best?: boolean }) {
  return <div className={cn("border-l border-border px-4 py-3 text-sm", best && "bg-green-50/70")}>{children}</div>;
}
