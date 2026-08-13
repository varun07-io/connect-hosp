import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, Search, X, ShieldCheck, Wallet, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { CityAutocomplete } from "@/components/shared/CityAutocomplete";
import { HospitalCard } from "@/components/shared/HospitalCard";
import { SearchFilters, type FilterState } from "@/components/shared/SearchFilters";
import { useHospitalSearch } from "@/hooks/useApiQueries";
import { formatCompactCurrency } from "@/lib/utils";

const PILOT_CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"];

const SORT_LABELS: Record<string, string> = {
  recommended: "Recommended",
  cost_asc: "Price: low to high",
  cost_desc: "Price: high to low",
  rating_desc: "Highest rated",
};

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Every hospital verified before listing" },
  { icon: Wallet, text: "Transparent, indicative pricing" },
  { icon: PhoneCall, text: "Free callback from a hospital doctor" },
];

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cityInput, setCityInput] = React.useState(searchParams.get("city") ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  // URL is the single source of truth for filter state, so results stay
  // shareable and the back button behaves.
  const filters: FilterState = {
    city: searchParams.get("city") ?? "",
    categories: (searchParams.get("categories") ?? searchParams.get("category") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    minBudget: searchParams.get("minBudget") ? Number(searchParams.get("minBudget")) : undefined,
    maxBudget: searchParams.get("maxBudget") ? Number(searchParams.get("maxBudget")) : undefined,
    minRating: searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined,
  };
  const sort = searchParams.get("sort") ?? "recommended";

  const { data, isFetching } = useHospitalSearch({
    city: filters.city || undefined,
    categories: filters.categories.length ? filters.categories.join(",") : undefined,
    minBudget: filters.minBudget,
    maxBudget: filters.maxBudget,
    minRating: filters.minRating,
    sort,
  });

  React.useEffect(() => {
    setCityInput(searchParams.get("city") ?? "");
  }, [searchParams]);

  function applyFilters(next: Partial<FilterState>) {
    const merged = { ...filters, ...next };
    const p = new URLSearchParams();
    if (merged.city) p.set("city", merged.city);
    if (merged.categories.length) p.set("categories", merged.categories.join(","));
    if (merged.minBudget !== undefined) p.set("minBudget", String(merged.minBudget));
    if (merged.maxBudget !== undefined) p.set("maxBudget", String(merged.maxBudget));
    if (merged.minRating !== undefined) p.set("minRating", String(merged.minRating));
    if (sort !== "recommended") p.set("sort", sort);
    setSearchParams(p);
  }

  function clearAll() {
    const p = new URLSearchParams();
    if (sort !== "recommended") p.set("sort", sort);
    setSearchParams(p);
  }

  function setSort(value: string) {
    const p = new URLSearchParams(searchParams);
    if (value === "recommended") p.delete("sort");
    else p.set("sort", value);
    setSearchParams(p);
  }

  const activeChips: { label: string; clear: () => void }[] = [
    ...(filters.city ? [{ label: filters.city, clear: () => applyFilters({ city: "" }) }] : []),
    ...filters.categories.map((c) => ({
      label: c,
      clear: () => applyFilters({ categories: filters.categories.filter((x) => x !== c) }),
    })),
    ...(filters.minBudget !== undefined || filters.maxBudget !== undefined
      ? [
          {
            label: `${filters.minBudget ? formatCompactCurrency(filters.minBudget) : "Under"} – ${
              filters.maxBudget ? formatCompactCurrency(filters.maxBudget) : "above"
            }`,
            clear: () => applyFilters({ minBudget: undefined, maxBudget: undefined }),
          },
        ]
      : []),
    ...(filters.minRating ? [{ label: `${filters.minRating}★ & above`, clear: () => applyFilters({ minRating: undefined }) }] : []),
  ];

  const filterPanel = (
    <SearchFilters state={filters} facets={data?.facets} onChange={applyFilters} onClearAll={clearAll} />
  );

  return (
    <div className="bg-muted/20">
      {/* Search + trust bar */}
      <div className="border-b border-border bg-background">
        <div className="container py-4">
          <div className="flex items-center gap-2 rounded-xl border border-border p-2 shadow-soft">
            <CityAutocomplete
              value={cityInput}
              onChange={setCityInput}
              onSelect={(c) => applyFilters({ city: c })}
              popularCities={PILOT_CITIES}
              placeholder="Search any city in India"
              className="flex-1"
            />
            <Button size="sm" className="h-9 shrink-0" onClick={() => applyFilters({ city: cityInput.trim() })}>
              <Search className="h-4 w-4" /> Search
            </Button>
          </div>
          <div className="mt-3 hidden flex-wrap items-center gap-x-6 gap-y-1 md:flex">
            {TRUST_POINTS.map((t) => (
              <span key={t.text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <t.icon className="h-3.5 w-3.5 text-primary-600" /> {t.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Desktop filter rail — sticky so it stays reachable while scrolling results */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-border bg-background p-4">{filterPanel}</div>
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {isFetching && !data ? (
                  "Searching…"
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{data?.total ?? 0}</span>{" "}
                    {data?.total === 1 ? "hospital" : "hospitals"}
                    {filters.city ? ` in ${filters.city}` : ""}
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                      {activeChips.length > 0 && (
                        <span className="ml-0.5 rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                          {activeChips.length}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="lg:hidden">
                    <div className="overflow-y-auto px-5 pb-2 pt-5">{filterPanel}</div>
                    <div className="border-t border-border p-4">
                      <Button className="w-full" onClick={() => setMobileFiltersOpen(false)}>
                        Show {data?.total ?? 0} {data?.total === 1 ? "result" : "results"}
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>

                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue>{SORT_LABELS[sort]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SORT_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeChips.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <Badge key={chip.label} variant="default" className="gap-1 py-1 pl-2.5 pr-1.5">
                    {chip.label}
                    <button onClick={chip.clear} className="rounded-full p-0.5 hover:bg-primary-200" aria-label={`Remove ${chip.label}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <button onClick={clearAll} className="text-xs font-medium text-primary-700 hover:underline">
                  Clear all
                </button>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {!data && isFetching && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[340px] rounded-xl" />)}
              {data?.items.map((hospital) => <HospitalCard key={hospital.id} hospital={hospital} />)}
            </div>

            {data && data.items.length === 0 && (
              <EmptyState
                icon={Search}
                title="No hospitals match these filters"
                description={
                  filters.city && !PILOT_CITIES.includes(filters.city)
                    ? `The pilot currently covers ${PILOT_CITIES.join(", ")}. Try one of those, or clear your filters.`
                    : "Try removing a filter — or widen your budget range."
                }
                action={
                  activeChips.length > 0 ? (
                    <Button onClick={clearAll} variant="outline">
                      Clear all filters
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
