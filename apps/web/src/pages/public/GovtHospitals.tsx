import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Baby,
  Bone,
  Brain,
  Building2,
  ChevronDown,
  Droplets,
  Ear,
  Eye,
  HeartPulse,
  LayoutGrid,
  MapPin,
  Ribbon,
  Search,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Smile,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { schemeName } from "@connect-hospital/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { FacetList, FilterPopover, type FacetOption } from "@/components/govt/DirectoryFilters";
import { GovtHospitalCard } from "@/components/govt/GovtHospitalCard";
import { useGovtHospitals } from "@/hooks/useGovtHospitals";
import {
  applyFilters,
  facetValues,
  haystack,
  matchesQuery,
  tokenize,
  type DirectoryFilters,
  type FacetKey,
} from "@/lib/govtDirectory";
import { cn, formatDate } from "@/lib/utils";

const PAGE = 24;

/** Plain-language entry points for patients; each runs a synonym-aware search. */
const QUICK_PICKS = [
  { label: "Eye care", q: "eye", icon: Eye },
  { label: "Heart", q: "heart", icon: HeartPulse },
  { label: "Cancer", q: "cancer", icon: Ribbon },
  { label: "Maternity", q: "maternity", icon: Users },
  { label: "Children", q: "children", icon: Baby },
  { label: "Bones & joints", q: "bone", icon: Bone },
  { label: "Brain & nerves", q: "brain", icon: Brain },
  { label: "Kidney", q: "kidney", icon: Droplets },
  { label: "Dental", q: "dental", icon: Smile },
  { label: "Ear, nose & throat", q: "ent", icon: Ear },
  { label: "Accident & trauma", q: "accident", icon: Siren },
];

const FACETS: { key: FacetKey; param: string; label: string; icon: typeof MapPin; single?: boolean }[] = [
  { key: "district", param: "district", label: "District", icon: MapPin, single: true },
  { key: "taluk", param: "taluk", label: "Taluk", icon: LayoutGrid, single: true },
  { key: "types", param: "type", label: "Hospital type", icon: Building2 },
  { key: "specs", param: "spec", label: "Speciality", icon: Stethoscope },
  { key: "schemes", param: "scheme", label: "Scheme", icon: ShieldCheck },
];

function readFilters(params: URLSearchParams): DirectoryFilters {
  const list = (k: string) => (params.get(k) ?? "").split(",").filter(Boolean);
  const f = { q: params.get("q") ?? "" } as DirectoryFilters;
  for (const facet of FACETS) f[facet.key] = list(facet.param);
  return f;
}

export function GovtHospitals() {
  const { data, isLoading, isError } = useGovtHospitals();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const sort = params.get("sort") ?? "name";
  const [query, setQuery] = React.useState(filters.q);
  const [shown, setShown] = React.useState(PAGE);
  const [allFiltersOpen, setAllFiltersOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  function update(next: Partial<DirectoryFilters> & { sort?: string }) {
    const merged = { ...filters, sort, ...next };
    const p = new URLSearchParams();
    if (merged.q) p.set("q", merged.q);
    for (const facet of FACETS) if (merged[facet.key].length) p.set(facet.param, merged[facet.key].join(","));
    if (merged.sort && merged.sort !== "name") p.set("sort", merged.sort);
    setParams(p, { replace: true });
    setShown(PAGE);
  }

  function toggle(key: FacetKey, value: string, single?: boolean) {
    const cur = filters[key];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : single ? [value] : [...cur, value];
    // Taluks belong to a district: changing district resets the taluk.
    update(key === "district" ? { district: next, taluk: [] } : { [key]: next });
  }

  // Debounced, URL-synced search box; also follow back/forward navigation.
  React.useEffect(() => {
    if (query.trim() === filters.q) return;
    const t = setTimeout(() => update({ q: query.trim() }), 150);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (filters.q !== query.trim()) setQuery(filters.q);
  }, [filters.q]); // eslint-disable-line react-hooks/exhaustive-deps

  // "/" focuses search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const indexed = React.useMemo(() => (data?.items ?? []).map((h) => ({ h, hay: haystack(h) })), [data]);
  const filterKey = JSON.stringify(filters);

  const { results, options } = React.useMemo(() => {
    const results = applyFilters(indexed, filters).map((x) => x.h);
    if (sort === "specialities") results.sort((a, b) => b.specialities.length - a.specialities.length || a.name.localeCompare(b.name));
    // Facet counts exclude the facet's own selection ("how many if I pick this?"),
    // except specialities, which narrow: counts there respect what's already picked.
    const options = {} as Record<FacetKey, FacetOption[]>;
    for (const facet of FACETS) {
      const counts = new Map<string, number>();
      for (const { h } of applyFilters(indexed, filters, facet.key)) {
        if (facet.key === "specs" && !filters.specs.every((s) => h.specialities.includes(s))) continue;
        for (const v of facetValues(h, facet.key)) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      // Every value in the list stays visible; zero-count ones are disabled.
      const all = new Set(indexed.flatMap(({ h }) => facetValues(h, facet.key)));
      options[facet.key] = [...all]
        .map((value) => ({
          value,
          count: counts.get(value) ?? 0,
          hint: facet.key === "schemes" && schemeName(value) !== value ? schemeName(value) : undefined,
        }))
        .sort((a, b) => (facet.key === "specs" || facet.key === "types" ? b.count - a.count : 0) || a.value.localeCompare(b.value));
    }
    return { results, options };
  }, [indexed, filterKey, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const quickPicks = React.useMemo(
    () => QUICK_PICKS.map((p) => ({ ...p, n: indexed.filter(({ hay }) => matchesQuery(hay, [p.q])).length })).filter((p) => p.n > 0),
    [indexed],
  );
  const districts = new Set(indexed.map(({ h }) => h.district));
  const specialityCount = new Set(indexed.flatMap(({ h }) => h.specialities)).size;

  const chips = [
    ...(filters.q ? [{ label: `“${filters.q}”`, clear: () => update({ q: "" }) }] : []),
    ...FACETS.flatMap((facet) => filters[facet.key].map((v) => ({ label: v, clear: () => toggle(facet.key, v) }))),
  ];
  const activeFacetCount = FACETS.reduce((n, f) => n + filters[f.key].length, 0);
  const clearAll = () => {
    setQuery("");
    setParams(sort !== "name" ? { sort } : {}, { replace: true });
  };

  // Contextual heading, e.g. "Eye care · Government hospitals in Bengaluru".
  const pick = QUICK_PICKS.find((p) => p.q === filters.q.toLowerCase());
  const subject = pick?.label ?? (filters.specs.length === 1 ? filters.specs[0] : null);
  const place = filters.taluk[0] ?? filters.district[0] ?? (districts.size === 1 ? [...districts][0] : null);
  const heading = `${subject ? `${subject} · ` : ""}Government hospitals${place ? ` in ${place}` : ""}`;

  return (
    <div className="bg-muted/20">
      {/* Hero + search */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary-50 via-primary-50/40 to-background">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-100/70 blur-3xl" />
        <div className="container relative grid gap-8 py-10 md:py-14 lg:grid-cols-[1fr_300px] lg:items-end">
          <div className="min-w-0">
            <nav className="mb-3 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Home
              </Link>{" "}
              <span className="mx-1">/</span> Government hospitals
            </nav>
            <h1 className="text-balance font-display text-3xl font-bold md:text-4xl">
              Find a <span className="text-primary-600">government hospital</span>
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Search empanelled government hospitals by name, area, or the care you need.</p>

            <div className="mt-6 max-w-3xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Try “eye”, “Jayanagar”, “cardiology” or a hospital name"
                  className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-14 text-base shadow-lift outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                  aria-label="Search government hospitals"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {query ? (
                    <button onClick={() => setQuery("")} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <kbd className="hidden rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:block">/</kbd>
                  )}
                </div>
              </div>
              {quickPicks.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">What care do you need?</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap">
                    {quickPicks.map(({ label, q, icon: Icon, n }) => {
                      const on = filters.q === q;
                      return (
                        <button
                          key={q}
                          onClick={() => setQuery(on ? "" : q)}
                          aria-pressed={on}
                          className={cn(
                            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                            on ? "border-primary-600 bg-primary-600 text-white" : "border-border bg-background hover:border-primary-300 hover:bg-primary-50",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", on ? "text-white" : "text-primary-600")} /> {label}
                          <span className={cn("text-xs", on ? "text-primary-100" : "text-muted-foreground")}>{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {data && (
            <dl className="hidden grid-cols-2 gap-4 rounded-2xl border border-border bg-background/80 p-5 shadow-soft backdrop-blur sm:grid sm:grid-cols-4 lg:grid-cols-2">
              <Stat label="Hospitals" value={data.total} />
              <Stat label="Districts" value={districts.size} />
              <Stat label="Specialities" value={specialityCount} />
              {data.lastUpdated && <Stat label="List updated" value={formatDate(data.lastUpdated)} />}
            </dl>
          )}
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex items-center gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setAllFiltersOpen(true)}
            className="flex h-10 shrink-0 items-center gap-2 rounded-full border-2 border-foreground/80 px-4 text-sm font-semibold hover:bg-muted"
          >
            <SlidersHorizontal className="h-4 w-4" /> All filters
            {activeFacetCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-bold text-background">
                {activeFacetCount}
              </span>
            )}
          </button>
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          {FACETS.filter((f) => options[f.key].length > 0).map((f) => (
            <FilterPopover
              key={f.key}
              label={f.label}
              icon={f.icon}
              single={f.single}
              options={options[f.key]}
              selected={filters[f.key]}
              onToggle={(v) => toggle(f.key, v, f.single)}
              onClear={() => update({ [f.key]: [], ...(f.key === "district" ? { taluk: [] } : {}) })}
              resultCount={results.length}
            />
          ))}
          {chips.length > 0 && (
            <button onClick={clearAll} className="flex shrink-0 items-center gap-1 px-2 text-sm font-semibold text-red-700 hover:underline">
              <X className="h-4 w-4" /> Clear all
            </button>
          )}
        </div>
      </div>

      <div className="container py-6">
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Showing results for:</span>
            {chips.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1.5 text-sm font-medium shadow-soft">
                {c.label}
                <button onClick={c.clear} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${c.label}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold md:text-2xl">{heading}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
              {isLoading ? "Loading…" : `${results.length} of ${data?.total ?? 0} hospitals`}
            </p>
          </div>
          <Select value={sort} onValueChange={(v) => update({ sort: v })}>
            <SelectTrigger className="h-10 w-[210px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
              <SelectItem value="specialities">Sort: Most specialities</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        )}
        {isError && <EmptyState icon={Building2} title="Couldn't load hospitals" description="Please refresh the page to try again." />}
        {data && data.total === 0 && (
          <EmptyState icon={Building2} title="No hospitals listed yet" description="The directory will appear here once the hospital list has been uploaded." />
        )}
        {data && data.total > 0 && results.length === 0 && (
          <EmptyState
            icon={Search}
            title="No hospitals match"
            description={filters.q ? `Nothing for “${filters.q}” with these filters. Try a broader word like “surgery”, or remove a filter.` : "Try removing a filter."}
            action={
              <Button variant="outline" onClick={clearAll}>
                Clear search & filters
              </Button>
            }
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {results.slice(0, shown).map((h) => (
            <GovtHospitalCard key={h.id} h={h} tokens={tokenize(filters.q)} selectedSpecs={filters.specs} />
          ))}
        </div>
        {results.length > shown && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <Button variant="outline" size="lg" onClick={() => setShown((n) => n + PAGE)}>
              Show more hospitals <ChevronDown className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Showing {shown} of {results.length}
            </p>
          </div>
        )}
      </div>

      {/* All filters panel */}
      <Sheet open={allFiltersOpen} onOpenChange={setAllFiltersOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 pr-12">
            <p className="font-display text-lg font-semibold">All filters</p>
            {activeFacetCount > 0 && (
              <button
                onClick={() => update({ district: [], taluk: [], types: [], specs: [], schemes: [] })}
                className="text-sm font-medium text-red-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {FACETS.filter((f) => options[f.key].length > 0).map((f) => (
              <section key={f.key}>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <f.icon className="h-3.5 w-3.5" /> {f.label}
                  {f.key === "specs" && filters.specs.length > 1 && <span className="font-normal normal-case">· hospitals with all selected</span>}
                </p>
                <FacetList
                  options={options[f.key]}
                  selected={filters[f.key]}
                  single={f.single}
                  onToggle={(v) => toggle(f.key, v, f.single)}
                  searchPlaceholder={`Search ${f.label.toLowerCase()}…`}
                  maxHeight="max-h-64"
                />
              </section>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <Button size="lg" className="w-full" onClick={() => setAllFiltersOpen(false)}>
              Show {results.length} {results.length === 1 ? "hospital" : "hospitals"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-bold text-primary-700">{value}</dd>
    </div>
  );
}
