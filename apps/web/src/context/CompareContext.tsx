import * as React from "react";
import { toast } from "@/hooks/useToast";

export const MAX_COMPARE = 3;
const STORAGE_KEY = "ch_compare_v1";

export interface CompareItem {
  slug: string;
  name: string;
  city: string;
  photo?: string;
}

interface CompareContextValue {
  items: CompareItem[];
  has: (slug: string) => boolean;
  toggle: (item: CompareItem) => void;
  remove: (slug: string) => void;
  clear: () => void;
  /** /compare?h=a,b,c — the URL is the shareable source of truth on that page. */
  compareUrl: string;
}

const CompareContext = React.createContext<CompareContextValue | null>(null);

function load(): CompareItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

/** Shortlist of up to three hospitals, persisted so it survives navigation
 *  between search, profiles and the compare page (and page reloads). */
export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CompareItem[]>(load);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = React.useMemo<CompareContextValue>(() => {
    const has = (slug: string) => items.some((i) => i.slug === slug);
    return {
      items,
      has,
      toggle: (item) => {
        if (has(item.slug)) {
          setItems((prev) => prev.filter((i) => i.slug !== item.slug));
          return;
        }
        if (items.length >= MAX_COMPARE) {
          toast({
            title: `You can compare up to ${MAX_COMPARE} hospitals`,
            description: "Remove one from the compare bar to add another.",
          });
          return;
        }
        setItems((prev) => [...prev, item]);
      },
      remove: (slug) => setItems((prev) => prev.filter((i) => i.slug !== slug)),
      clear: () => setItems([]),
      compareUrl: `/compare?h=${items.map((i) => i.slug).join(",")}`,
    };
  }, [items]);

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = React.useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}
