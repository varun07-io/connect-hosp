import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FacetOption {
  value: string;
  count: number;
  /** Optional second line, e.g. a scheme's full name. */
  hint?: string;
}

/** Searchable radio/checkbox list with live counts — used both in the filter
 *  bar popovers and in the "All filters" panel, so they always agree. */
export function FacetList({
  options,
  selected,
  single,
  onToggle,
  searchPlaceholder,
  maxHeight = "max-h-72",
}: {
  options: FacetOption[];
  selected: string[];
  single?: boolean;
  onToggle: (value: string) => void;
  searchPlaceholder?: string;
  maxHeight?: string;
}) {
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const visible = options.filter((o) => !needle || o.value.toLowerCase().includes(needle) || o.hint?.toLowerCase().includes(needle));

  return (
    <div>
      {options.length > 6 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder ?? "Search…"}
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      )}
      <div className={cn("-mx-1 space-y-0.5 overflow-y-auto px-1", maxHeight)}>
        {visible.map((o) => {
          const active = selected.includes(o.value);
          const disabled = !active && o.count === 0;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                active ? "bg-primary-50 font-medium text-primary-900" : "hover:bg-muted",
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              <span
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center border-2",
                  single ? "rounded-full" : "rounded-md",
                  active ? "border-primary-600 bg-primary-600 text-white" : "border-input bg-background",
                )}
              >
                {active && (single ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <Check className="h-3 w-3" strokeWidth={3} />)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.value}</span>
                {o.hint && <span className="block truncate text-[11px] font-normal text-muted-foreground">{o.hint}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">{o.count}</span>
            </button>
          );
        })}
        {visible.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">No matches</p>}
      </div>
    </div>
  );
}

/** Pill trigger + popover, in the style of a marketplace filter bar. Unlike an
 *  "Apply" flow, choices take effect immediately and counts update live. */
export function FilterPopover({
  label,
  icon: Icon,
  options,
  selected,
  single,
  onToggle,
  onClear,
  resultCount,
}: {
  label: string;
  icon: LucideIcon;
  options: FacetOption[];
  selected: string[];
  single?: boolean;
  onToggle: (value: string) => void;
  onClear: () => void;
  resultCount: number;
}) {
  const active = selected.length > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
            active
              ? "border-primary-600 bg-primary-50 text-primary-800"
              : "border-border bg-background text-foreground hover:border-primary-300 hover:bg-muted/50",
            "data-[state=open]:border-primary-600 data-[state=open]:ring-2 data-[state=open]:ring-primary-100",
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="max-w-[10rem] truncate">{single && active ? selected[0] : label}</span>
          {active && !single && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">{label}</p>
          <PopoverClose className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </PopoverClose>
        </div>
        <div className="p-3">
          <FacetList options={options} selected={selected} single={single} onToggle={onToggle} searchPlaceholder={`Search ${label.toLowerCase()}…`} />
        </div>
        <div className="flex items-center gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={onClear}
            disabled={!active}
            className="h-9 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
          <PopoverClose className="h-9 flex-1 rounded-lg bg-primary-600 text-sm font-semibold text-white transition-colors hover:bg-primary-700">
            Show {resultCount} {resultCount === 1 ? "hospital" : "hospitals"}
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
