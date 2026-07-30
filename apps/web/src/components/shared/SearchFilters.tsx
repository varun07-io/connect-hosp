import * as React from "react";
import { Check, RotateCcw, Star } from "lucide-react";
import { cn, formatCompactCurrency } from "@/lib/utils";
import type { SearchFacets } from "@/types/api";

export interface FilterState {
  city: string;
  categories: string[];
  minBudget?: number;
  maxBudget?: number;
  minRating?: number;
}

interface SearchFiltersProps {
  state: FilterState;
  facets: SearchFacets | undefined;
  onChange: (next: Partial<FilterState>) => void;
  onClearAll: () => void;
}

const RATING_OPTIONS = [
  { value: 4.5, label: "4.5 & above" },
  { value: 4, label: "4.0 & above" },
  { value: 3.5, label: "3.5 & above" },
];

/** Preset budget bands, the way travel/ticketing sites do it — a slider is
 *  fiddly on touch and these map cleanly onto shareable URL params. */
function budgetBands(max: number) {
  if (max <= 0) return [];
  return [
    { label: "Under ₹1L", min: undefined, max: 100_000 },
    { label: "₹1L – ₹2L", min: 100_000, max: 200_000 },
    { label: "₹2L – ₹3L", min: 200_000, max: 300_000 },
    { label: "Above ₹3L", min: 300_000, max: undefined },
  ];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

/** A checkbox row with its result count — the count is what makes a filter
 *  panel feel alive: you can see what each option will do before clicking. */
function CheckRow({
  label,
  count,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  count?: number;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked ? "border-primary-600 bg-primary-600 text-white" : "border-input bg-background",
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={cn("flex-1 truncate", checked && "font-medium text-primary-700")}>{label}</span>
      {count !== undefined && <span className="shrink-0 text-xs text-muted-foreground">{count}</span>}
    </button>
  );
}

function RadioRow({ label, checked, onSelect, icon }: { label: string; checked: boolean; onSelect: () => void; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
          checked ? "border-primary-600" : "border-input",
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-primary-600" />}
      </span>
      <span className={cn("flex flex-1 items-center gap-1", checked && "font-medium text-primary-700")}>
        {label}
        {icon}
      </span>
    </button>
  );
}

export function SearchFilters({ state, facets, onChange, onClearAll }: SearchFiltersProps) {
  const activeCount =
    (state.city ? 1 : 0) +
    state.categories.length +
    (state.minBudget !== undefined || state.maxBudget !== undefined ? 1 : 0) +
    (state.minRating ? 1 : 0);

  function toggleCategory(value: string) {
    const next = state.categories.includes(value)
      ? state.categories.filter((c) => c !== value)
      : [...state.categories, value];
    onChange({ categories: next });
  }

  const bands = budgetBands(facets?.priceRange.max ?? 0);

  return (
    <div>
      <div className="flex items-center justify-between pb-3">
        <p className="text-sm font-semibold">
          Filters {activeCount > 0 && <span className="text-muted-foreground">({activeCount})</span>}
        </p>
        {activeCount > 0 && (
          <button onClick={onClearAll} className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline">
            <RotateCcw className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <Section title="Surgery type">
        <div className="space-y-0.5">
          {facets?.categories.map((f) => (
            <CheckRow
              key={f.value}
              label={f.value}
              count={f.count}
              checked={state.categories.includes(f.value)}
              // A zero-count option that isn't already selected can only ever
              // return nothing, so don't invite the dead end.
              disabled={f.count === 0 && !state.categories.includes(f.value)}
              onToggle={() => toggleCategory(f.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="City">
        <div className="space-y-0.5">
          {facets?.cities.map((f) => (
            <CheckRow
              key={f.value}
              label={f.value}
              count={f.count}
              checked={state.city === f.value}
              disabled={f.count === 0 && state.city !== f.value}
              onToggle={() => onChange({ city: state.city === f.value ? "" : f.value })}
            />
          ))}
        </div>
      </Section>

      {bands.length > 0 && (
        <Section title="Budget">
          <div className="space-y-0.5">
            {bands.map((b) => {
              const checked = state.minBudget === b.min && state.maxBudget === b.max;
              return (
                <RadioRow
                  key={b.label}
                  label={b.label}
                  checked={checked}
                  onSelect={() =>
                    checked
                      ? onChange({ minBudget: undefined, maxBudget: undefined })
                      : onChange({ minBudget: b.min, maxBudget: b.max })
                  }
                />
              );
            })}
          </div>
          {facets && facets.priceRange.max > 0 && (
            <p className="mt-2 px-2 text-xs text-muted-foreground">
              Listed procedures range {formatCompactCurrency(facets.priceRange.min)} –{" "}
              {formatCompactCurrency(facets.priceRange.max)}
            </p>
          )}
        </Section>
      )}

      <Section title="Patient rating">
        <div className="space-y-0.5">
          {RATING_OPTIONS.map((r) => (
            <RadioRow
              key={r.value}
              label={r.label}
              checked={state.minRating === r.value}
              onSelect={() => onChange({ minRating: state.minRating === r.value ? undefined : r.value })}
              icon={<Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
