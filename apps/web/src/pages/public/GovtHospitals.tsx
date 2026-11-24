import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Baby,
  Bone,
  Brain,
  Building2,
  Check,
  Droplets,
  Ear,
  Eye,
  HeartPulse,
  Ribbon,
  Siren,
  Smile,
  Users,
  ChevronDown,
  Copy,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  Stethoscope,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { useGovtHospitals, type GovtHospital } from "@/hooks/useGovtHospitals";
import { toast } from "@/hooks/useToast";
import { cn, formatDate } from "@/lib/utils";

const PAGE = 30;

/** Everyday words → the speciality vocabulary used in the KASS list. */
const SYNONYMS: Record<string, string[]> = {
  eye: ["ophthalmology"],
  eyes: ["ophthalmology"],
  heart: ["cardio"],
  cardiac: ["cardio"],
  child: ["paediatric", "neonatal", "child"],
  children: ["paediatric", "neonatal", "child"],
  kids: ["paediatric", "neonatal"],
  baby: ["neonatal", "paediatric"],
  cancer: ["oncology"],
  bone: ["orthopaedic"],
  bones: ["orthopaedic"],
  knee: ["orthopaedic", "tkr"],
  hip: ["orthopaedic", "thr"],
  brain: ["neuro"],
  nerve: ["neuro"],
  kidney: ["nephro", "urology", "kidney", "dialysis"],
  pregnancy: ["obstetrics"],
  delivery: ["obstetrics"],
  maternity: ["obstetrics", "gynaecology"],
  women: ["gynaecology", "obstetrics"],
  teeth: ["dental"],
  tooth: ["dental"],
  dentist: ["dental"],
  ear: ["ent"],
  nose: ["ent"],
  throat: ["ent"],
  lung: ["pulmonology"],
  lungs: ["pulmonology"],
  liver: ["gastro", "liver"],
  stomach: ["gastro"],
  mental: ["mental", "nimhans"],
  accident: ["accident", "trauma", "polytrauma"],
  emergency: ["emergency", "accident", "trauma"],
};

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

interface Filters {
  q: string;
  district: string;
  taluk: string;
  types: string[];
  specs: string[];
}

type Facet = "district" | "taluk" | "types" | "specs";

function haystack(h: GovtHospital) {
  return [h.name, h.address, h.district, h.taluk, h.subType, h.refId, ...h.specialities].join(" ").toLowerCase();
}

/** Short terms ("ent", "gp") must match whole words — otherwise "ent" would
 *  match "government" and "accident". */
function contains(text: string, term: string) {
  if (term.length > 3) return text.includes(term);
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

function matchesTerm(text: string, t: string) {
  return contains(text, t) || (SYNONYMS[t] ?? []).some((s) => contains(text, s));
}

function matchesQuery(hay: string, tokens: string[]) {
  return tokens.every((t) => matchesTerm(hay, t));
}

function tokenize(q: string) {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

function applyFilters(items: { h: GovtHospital; hay: string }[], f: Filters, skip?: Facet) {
  const tokens = tokenize(f.q);
  return items.filter(({ h, hay }) => {
    if (tokens.length && !matchesQuery(hay, tokens)) return false;
    if (skip !== "district" && f.district && h.district !== f.district) return false;
    if (skip !== "taluk" && f.taluk && h.taluk !== f.taluk) return false;
    if (skip !== "types" && f.types.length && !f.types.includes(h.subType ?? "")) return false;
    if (skip !== "specs" && f.specs.length && !f.specs.every((s) => h.specialities.includes(s))) return false;
    return true;
  });
}

function countBy(values: (string | null)[]) {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function typeTone(subType: string | null) {
  const t = (subType ?? "").toLowerCase();
  if (t.includes("medical college")) return "bg-violet-100 text-violet-800";
  if (t.includes("government of india") || t.includes("railway")) return "bg-sky-100 text-sky-800";
  if (t.includes("taluk")) return "bg-amber-100 text-amber-800";
  if (t.includes("autonomous")) return "bg-primary-100 text-primary-800";
  return "bg-muted text-muted-foreground";
}

export function GovtHospitals() {
  const { data, isLoading, isError } = useGovtHospitals();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [shown, setShown] = React.useState(PAGE);
  const [mobileFilters, setMobileFilters] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const filters: Filters = {
    q: params.get("q") ?? "",
    district: params.get("district") ?? "",
    taluk: params.get("taluk") ?? "",
    types: list("type"),
    specs: list("spec"),
  };
  const sort = params.get("sort") ?? "name";

  function update(next: Partial<Filters> & { sort?: string }) {
    const merged = { ...filters, sort, ...next };
    const p = new URLSearchParams();
    if (merged.q) p.set("q", merged.q);
    if (merged.district) p.set("district", merged.district);
    if (merged.taluk) p.set("taluk", merged.taluk);
    if (merged.types.length) p.set("type", merged.types.join(","));
    if (merged.specs.length) p.set("spec", merged.specs.join(","));
    if (merged.sort && merged.sort !== "name") p.set("sort", merged.sort);
    setParams(p, { replace: true });
    setShown(PAGE);
  }

  // Debounced, URL-synced search box.
  React.useEffect(() => {
    if (query === filters.q) return;
    const t = setTimeout(() => update({ q: query.trim() }), 150);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // "/" focuses search, like most directory sites.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const indexed = React.useMemo(() => (data?.items ?? []).map((h) => ({ h, hay: haystack(h) })), [data]);
  const filterKey = JSON.stringify(filters);

  const { results, facets } = React.useMemo(() => {
    const results = applyFilters(indexed, filters).map((x) => x.h);
    if (sort === "specialities") results.sort((a, b) => b.specialities.length - a.specialities.length || a.name.localeCompare(b.name));
    const specCounts = new Map<string, number>();
    for (const { h } of applyFilters(indexed, filters, "specs")) {
      for (const s of h.specialities) if (!filters.specs.includes(s)) specCounts.set(s, (specCounts.get(s) ?? 0) + 1);
    }
    for (const s of filters.specs) specCounts.set(s, results.length);
    return {
      results,
      facets: {
        district: countBy(applyFilters(indexed, filters, "district").map((x) => x.h.district)),
        taluk: countBy(applyFilters(indexed, filters, "taluk").map((x) => x.h.taluk)),
        types: countBy(applyFilters(indexed, filters, "types").map((x) => x.h.subType)),
        specs: specCounts,
      },
    };
  }, [indexed, filterKey, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSpecs = React.useMemo(() => {
    const c = countBy((data?.items ?? []).flatMap((h) => h.specialities));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [data]);
  const districts = React.useMemo(() => new Set((data?.items ?? []).map((h) => h.district)).size, [data]);
  // Only offer picks that find something in the current list.
  const quickPicks = React.useMemo(
    () =>
      QUICK_PICKS.map((p) => ({ ...p, n: indexed.filter(({ hay }) => matchesQuery(hay, [p.q])).length })).filter((p) => p.n > 0),
    [indexed],
  );

  const toggle = (key: "types" | "specs", value: string) =>
    update({ [key]: filters[key].includes(value) ? filters[key].filter((v) => v !== value) : [...filters[key], value] });

  const chips = [
    ...(filters.q ? [{ label: `“${filters.q}”`, clear: () => {
            setQuery("");
            update({ q: "" });
          } }] : []),
    ...(filters.district ? [{ label: filters.district, clear: () => update({ district: "", taluk: "" }) }] : []),
    ...(filters.taluk ? [{ label: filters.taluk, clear: () => update({ taluk: "" }) }] : []),
    ...filters.types.map((t) => ({ label: t, clear: () => toggle("types", t) })),
    ...filters.specs.map((s) => ({ label: s, clear: () => toggle("specs", s) })),
  ];
  const clearAll = () => {
    setQuery("");
    setParams(sort !== "name" ? { sort } : {}, { replace: true });
  };

  const panel = (
    <FilterPanel
      filters={filters}
      facets={facets}
      allSpecs={allSpecs}
      onDistrict={(d) => update({ district: d === filters.district ? "" : d, taluk: "" })}
      onTaluk={(t) => update({ taluk: t === filters.taluk ? "" : t })}
      onToggle={toggle}
      onClear={clearAll}
      activeCount={chips.length}
    />
  );

  return (
    <div className="bg-muted/20">
      {/* Hero + search */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary-50 via-primary-50/40 to-background">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-100/70 blur-3xl" />
        <div className="container relative grid gap-8 py-10 md:py-14 lg:grid-cols-[1fr_300px] lg:items-end">
          <div className="min-w-0">
          <nav className="mb-3 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link> <span className="mx-1">/</span> Government hospitals
          </nav>
          <h1 className="text-balance font-display text-3xl font-bold md:text-4xl">
            Find a <span className="text-primary-600">government hospital</span>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Hospitals on the KASS empanelment list — search by hospital name, area, or the care you need.
          </p>

          <div className="mt-6 max-w-3xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try “eye”, “Jayanagar”, “cardiology” or a hospital name"
                className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-24 text-base shadow-lift outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                aria-label="Search government hospitals"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
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
              <Stat label="Districts" value={districts} />
              <Stat label="Specialities" value={allSpecs.length} />
              {data.lastUpdated && <Stat label="List updated" value={formatDate(data.lastUpdated)} />}
            </dl>
          )}
        </div>
      </section>

      <div className="container py-6">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border bg-background p-4">{panel}</div>
          </aside>

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {isLoading ? (
                  "Loading…"
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{results.length}</span> of {data?.total ?? 0} hospitals
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Sheet open={mobileFilters} onOpenChange={setMobileFilters}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <SlidersHorizontal className="h-4 w-4" /> Filters
                      {chips.length > 0 && <span className="rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">{chips.length}</span>}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="lg:hidden">
                    <div className="overflow-y-auto px-5 pb-2 pt-5">{panel}</div>
                    <div className="border-t border-border p-4">
                      <Button className="w-full" onClick={() => setMobileFilters(false)}>
                        Show {results.length} hospitals
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
                <Select value={sort} onValueChange={(v) => update({ sort: v })}>
                  <SelectTrigger className="h-9 w-[190px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                    <SelectItem value="specialities">Most specialities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {chips.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-primary-100 py-1 pl-3 pr-1.5 text-xs font-medium text-primary-800">
                    {c.label}
                    <button onClick={c.clear} className="rounded-full p-0.5 hover:bg-primary-200" aria-label={`Remove ${c.label}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button onClick={clearAll} className="text-xs font-medium text-primary-700 hover:underline">
                  Clear all
                </button>
              </div>
            )}

            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
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
                description={filters.q ? `Nothing for “${filters.q}” with these filters. Try a broader word like “surgery”, or clear a filter.` : "Try removing a filter."}
                action={
                  <Button variant="outline" onClick={clearAll}>
                    Clear search & filters
                  </Button>
                }
              />
            )}

            <ul className="space-y-3">
              {results.slice(0, shown).map((h) => (
                <HospitalRow key={h.id} h={h} tokens={tokenize(filters.q)} selectedSpecs={filters.specs} />
              ))}
            </ul>
            {results.length > shown && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                  Show more <ChevronDown className="h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  Showing {shown} of {results.length}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
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

function FilterPanel({
  filters,
  facets,
  allSpecs,
  onDistrict,
  onTaluk,
  onToggle,
  onClear,
  activeCount,
}: {
  filters: Filters;
  facets: { district: Map<string, number>; taluk: Map<string, number>; types: Map<string, number>; specs: Map<string, number> };
  allSpecs: string[];
  onDistrict: (d: string) => void;
  onTaluk: (t: string) => void;
  onToggle: (key: "types" | "specs", v: string) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const [specQuery, setSpecQuery] = React.useState("");
  const [allSpecsOpen, setAllSpecsOpen] = React.useState(false);
  const districts = [...facets.district.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const taluks = [...facets.taluk.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const types = [...facets.types.entries()].sort((a, b) => b[1] - a[1]);
  const specs = allSpecs
    .filter((s) => filters.specs.includes(s) || (facets.specs.get(s) ?? 0) > 0)
    .filter((s) => !specQuery || s.toLowerCase().includes(specQuery.toLowerCase()));
  const visibleSpecs = allSpecsOpen || specQuery ? specs : specs.slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold">Filters{activeCount ? ` (${activeCount})` : ""}</p>
        {activeCount > 0 && (
          <button onClick={onClear} className="text-xs font-medium text-primary-700 hover:underline">
            Clear all
          </button>
        )}
      </div>

      <FacetGroup title="District">
        {districts.map(([d, n]) => (
          <FacetOption key={d} label={d} count={n} active={filters.district === d} radio onClick={() => onDistrict(d)} />
        ))}
      </FacetGroup>

      {taluks.length > 1 || filters.taluk ? (
        <FacetGroup title="Taluk">
          {taluks.map(([t, n]) => (
            <FacetOption key={t} label={t} count={n} active={filters.taluk === t} radio onClick={() => onTaluk(t)} />
          ))}
        </FacetGroup>
      ) : null}

      <FacetGroup title="Hospital type">
        {types.map(([t, n]) => (
          <FacetOption key={t} label={t} count={n} active={filters.types.includes(t)} onClick={() => onToggle("types", t)} />
        ))}
      </FacetGroup>

      <FacetGroup title="Speciality" hint={filters.specs.length > 1 ? "Showing hospitals with all selected" : undefined}>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={specQuery}
            onChange={(e) => setSpecQuery(e.target.value)}
            placeholder="Find a speciality"
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary-400"
          />
        </div>
        {visibleSpecs.map((s) => (
          <FacetOption key={s} label={s} count={facets.specs.get(s) ?? 0} active={filters.specs.includes(s)} onClick={() => onToggle("specs", s)} />
        ))}
        {!specQuery && specs.length > 10 && (
          <button onClick={() => setAllSpecsOpen((o) => !o)} className="mt-1 text-xs font-medium text-primary-700 hover:underline">
            {allSpecsOpen ? "Show fewer" : `Show all ${specs.length}`}
          </button>
        )}
        {specs.length === 0 && <p className="text-xs text-muted-foreground">No matching specialities.</p>}
      </FacetGroup>
    </div>
  );
}

function FacetGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-4 first:border-0 first:pt-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {hint && <p className="-mt-1 mb-2 text-[11px] text-muted-foreground">{hint}</p>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FacetOption({ label, count, active, radio, onClick }: { label: string; count: number; active: boolean; radio?: boolean; onClick: () => void }) {
  const disabled = !active && count === 0;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors",
        active ? "font-medium text-primary-800" : "hover:bg-muted",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center border",
          radio ? "rounded-full" : "rounded",
          active ? "border-primary-600 bg-primary-600 text-white" : "border-input bg-background",
        )}
      >
        {active && (radio ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <Check className="h-3 w-3" />)}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const terms = tokens.filter((t) => t.length > 1);
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-accent-100 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function HospitalRow({ h, tokens, selectedSpecs }: { h: GovtHospital; tokens: string[]; selectedSpecs: string[] }) {
  const [expanded, setExpanded] = React.useState(false);
  // Specialities the visitor searched or filtered for come first, highlighted.
  const relevant = (s: string) =>
    selectedSpecs.includes(s) || tokens.some((t) => matchesTerm(s.toLowerCase(), t));
  const specs = [...h.specialities].sort((a, b) => Number(relevant(b)) - Number(relevant(a)));
  const visible = expanded ? specs : specs.slice(0, 6);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([h.name, h.address, h.district].filter(Boolean).join(", "))}`;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied`, variant: "success" });
    } catch {
      toast({ title: `Couldn't copy ${what.toLowerCase()}`, variant: "destructive" });
    }
  }

  return (
    <li className="group rounded-xl border border-border bg-background p-4 transition-all hover:border-primary-200 hover:shadow-card sm:p-5">
      <div className="flex gap-4">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 sm:flex">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-base font-semibold leading-snug sm:text-[17px]">
              <Highlight text={h.name} tokens={tokens} />
            </h2>
            {h.subType && <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", typeTone(h.subType))}>{h.subType}</span>}
          </div>
          {h.address && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <Highlight text={h.address} tokens={tokens} />
              </span>
            </p>
          )}
          <p className="mt-1 pl-[22px] text-xs text-muted-foreground">
            {h.district}
            {h.taluk ? ` · ${h.taluk} taluk` : ""}
          </p>

          {specs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visible.map((s) => (
                <span
                  key={s}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                    relevant(s) ? "bg-primary-600 font-medium text-white" : "bg-muted text-foreground/80",
                  )}
                >
                  {relevant(s) && <Stethoscope className="h-3 w-3" />}
                  {s}
                </span>
              ))}
              {specs.length > 6 && (
                <button onClick={() => setExpanded((e) => !e)} className="rounded-md px-2 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50">
                  {expanded ? "Show less" : `+${specs.length - 6} more`}
                </button>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button asChild size="sm" variant="subtle">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-3.5 w-3.5" /> Directions
              </a>
            </Button>
            {h.address && (
              <Button size="sm" variant="ghost" onClick={() => copy(`${h.name}, ${h.address}`, "Address")}>
                <Copy className="h-3.5 w-3.5" /> Copy address
              </Button>
            )}
            {h.refId && (
              <button
                onClick={() => copy(h.refId!, "Ref-ID")}
                className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Empanelment Ref-ID — click to copy"
              >
                {h.refId} <Copy className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
