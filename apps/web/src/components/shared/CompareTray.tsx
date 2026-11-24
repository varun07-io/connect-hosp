import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, Columns3, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_COMPARE, useCompare } from "@/context/CompareContext";
import { cn } from "@/lib/utils";

/** Floating shortlist bar shown across public pages once something is added. */
export function CompareTray() {
  const { items, remove, clear, compareUrl } = useCompare();
  const { pathname } = useLocation();

  if (items.length === 0 || pathname === "/compare") return null;
  // Hospital profiles have their own sticky booking bar on small screens.
  const hideOnMobile = pathname.startsWith("/hospitals/");
  const ready = items.length >= 2;

  return (
    <>
      <div className={cn("h-24", hideOnMobile && "hidden lg:block")} aria-hidden />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-[0_-8px_24px_-12px_rgb(15_124_130/0.25)] backdrop-blur animate-slide-up",
          hideOnMobile && "hidden lg:block",
        )}
        role="region"
        aria-label="Compare hospitals"
      >
        <div className="container flex items-center gap-3 py-3">
          <span className="hidden shrink-0 items-center gap-2 text-sm font-semibold md:flex">
            <Columns3 className="h-4 w-4 text-primary-600" /> Compare
          </span>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {Array.from({ length: MAX_COMPARE }).map((_, i) => {
              const item = items[i];
              if (!item) {
                return (
                  <Link
                    key={`empty-${i}`}
                    to="/search"
                    className="hidden h-12 min-w-[150px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary-300 hover:text-primary-700 sm:flex"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add hospital
                  </Link>
                );
              }
              return (
                <div key={item.slug} className="flex h-12 min-w-[150px] flex-1 items-center gap-2 rounded-lg border border-border bg-background pl-1.5 pr-1">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{item.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{item.city}</p>
                  </div>
                  <button
                    onClick={() => remove(item.slug)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${item.name} from compare`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:inline-flex" onClick={clear}>
              Clear
            </Button>
            {ready ? (
              <Button asChild>
                <Link to={compareUrl}>
                  Compare {items.length} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button disabled title="Add at least two hospitals">
                Add 1 more
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Compare toggle used on hospital cards and the profile header. */
export function CompareToggle({
  item,
  className,
}: {
  item: { slug: string; name: string; city: string; photo?: string };
  className?: string;
}) {
  const { has, toggle } = useCompare();
  const active = has(item.slug);
  return (
    <Button
      type="button"
      variant={active ? "subtle" : "outline"}
      size="sm"
      aria-pressed={active}
      onClick={() => toggle(item)}
      className={className}
    >
      {active ? <Check className="h-3.5 w-3.5" /> : <Columns3 className="h-3.5 w-3.5" />}
      {active ? "Added" : "Compare"}
    </Button>
  );
}
