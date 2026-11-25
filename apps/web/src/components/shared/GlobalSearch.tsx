import * as React from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, Building2, CornerDownLeft, Landmark, Search, Stethoscope, X } from "lucide-react";
import { useHospitalSearch, useTreatments } from "@/hooks/useApiQueries";
import { useGovtHospitals } from "@/hooks/useGovtHospitals";
import { haystack, locationLine, matchesQuery, tokenize } from "@/lib/govtDirectory";
import { cn, formatCompactCurrency } from "@/lib/utils";

type Tab = "all" | "hospitals" | "govt" | "treatments";

interface Result {
  id: string;
  kind: Exclude<Tab, "all">;
  title: string;
  subtitle: string;
  to: string;
}

const KIND_META: Record<Result["kind"], { label: string; icon: typeof Building2; tone: string }> = {
  hospitals: { label: "Hospitals", icon: Building2, tone: "bg-primary-50 text-primary-700" },
  govt: { label: "Govt hospitals", icon: Landmark, tone: "bg-green-50 text-green-700" },
  treatments: { label: "Treatments", icon: Stethoscope, tone: "bg-accent-50 text-accent-700" },
};

const POPULAR = ["Knee replacement", "Cataract", "Heart", "Eye", "Cancer", "Hernia", "Maternity", "Jayanagar"];

/** Site-wide search (header button or ⌘K / Ctrl+K): partner hospitals,
 *  government hospitals and treatments in one place. */
export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-primary-300 hover:bg-background hover:text-foreground lg:w-56"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <span className="hidden lg:inline">Search…</span>
          <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 text-[10px] font-medium lg:inline">⌘K</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[8vh] z-50 flex max-h-[80vh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lift animate-slide-up"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search Connect Hospital</DialogPrimitive.Title>
          {/* Mounted only while open, so its data loads on first use, not on every page. */}
          {open && <SearchBody onClose={() => setOpen(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("all");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const { data: hospitals } = useHospitalSearch({ page: 1, pageSize: 50 });
  const { data: treatments } = useTreatments();
  const { data: govt } = useGovtHospitals();
  const tokens = tokenize(q);

  const results = React.useMemo(() => {
    if (!tokens.length) return [] as Result[];
    const has = (text: string) => matchesQuery(text.toLowerCase(), tokens);
    const out: Result[] = [];
    for (const h of hospitals?.items ?? []) {
      if (has([h.name, h.city, ...h.specialities].join(" ")))
        out.push({
          id: h.id,
          kind: "hospitals",
          title: h.name,
          subtitle: `${h.city}${h.startingPrice ? ` · from ${formatCompactCurrency(h.startingPrice)}` : ""}${h.avgRating ? ` · ★ ${h.avgRating.toFixed(1)}` : ""}`,
          to: `/hospitals/${h.slug}`,
        });
    }
    for (const h of govt?.items ?? []) {
      if (matchesQuery(haystack(h), tokens))
        out.push({ id: h.id, kind: "govt", title: h.name, subtitle: [h.subType, locationLine(h)].filter(Boolean).join(" · "), to: `/government-hospitals/${h.id}` });
    }
    for (const t of treatments ?? []) {
      if (has(`${t.name} ${t.category}`))
        out.push({ id: t.id, kind: "treatments", title: t.name, subtitle: `${t.category} · compare prices`, to: `/search?categories=${encodeURIComponent(t.category)}` });
    }
    return out;
  }, [q, hospitals, govt, treatments]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    all: results.length,
    hospitals: results.filter((r) => r.kind === "hospitals").length,
    govt: results.filter((r) => r.kind === "govt").length,
    treatments: results.filter((r) => r.kind === "treatments").length,
  };
  // "All" shows a few of each kind (so one kind can't crowd out the rest);
  // a specific tab shows up to 40.
  const ALL_CAPS: Record<Result["kind"], number> = { treatments: 3, hospitals: 4, govt: 5 };
  const visible =
    tab === "all"
      ? (["treatments", "hospitals", "govt"] as const).flatMap((k) => results.filter((r) => r.kind === k).slice(0, ALL_CAPS[k]))
      : results.filter((r) => r.kind === tab).slice(0, 40);

  React.useEffect(() => setActive(0), [q, tab]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(to: string) {
    onClose();
    navigate(to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && visible[active]) {
      e.preventDefault();
      go(visible[active].to);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search hospitals, government hospitals, treatments…"
          className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          aria-label="Search"
        />
        <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close search">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 [scrollbar-width:none]" role="tablist">
        {(["all", "hospitals", "govt", "treatments"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-primary-600 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t === "all" ? "All" : KIND_META[t].label}
            {tokens.length > 0 && <span className={cn("text-xs", tab === t ? "text-primary-100" : "text-muted-foreground")}>{counts[t]}</span>}
          </button>
        ))}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {!tokens.length && (
          <div className="p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((p) => (
                <button
                  key={p}
                  onClick={() => setQ(p)}
                  className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Browse</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: "Partner hospitals", to: "/search", icon: Building2 },
                { label: "Government hospitals", to: "/government-hospitals", icon: Landmark },
                { label: "Compare costs", to: "/compare", icon: Stethoscope },
              ].map((b) => (
                <button key={b.to} onClick={() => go(b.to)} className="flex items-center gap-2 rounded-xl border border-border p-3 text-left text-sm font-medium hover:bg-muted">
                  <b.icon className="h-4 w-4 text-primary-600" /> {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {tokens.length > 0 && visible.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            No results for “{q}”. Try a speciality (“eye”, “heart”), an area or a hospital name.
          </p>
        )}

        {visible.map((r, i) => {
          const meta = KIND_META[r.kind];
          return (
            <button
              key={`${r.kind}-${r.id}`}
              data-index={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r.to)}
              className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === active ? "bg-primary-50" : "hover:bg-muted/60")}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
                <meta.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
              </span>
              {tab === "all" && <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{meta.label}</span>}
              {i === active ? <CornerDownLeft className="h-4 w-4 shrink-0 text-primary-600" /> : <ArrowRight className="h-4 w-4 shrink-0 text-transparent" />}
            </button>
          );
        })}

        {tokens.length > 0 && counts.govt > 0 && (tab === "all" || tab === "govt") && (
          <button
            onClick={() => go(`/government-hospitals?q=${encodeURIComponent(q.trim())}`)}
            className="mt-1 flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 hover:bg-muted/60"
          >
            See all {counts.govt} government hospitals for “{q.trim()}” <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:flex">
        <span>↑↓ to navigate</span>
        <span>↵ to open</span>
        <span>esc to close</span>
      </div>
    </>
  );
}
