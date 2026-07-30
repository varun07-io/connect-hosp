import * as React from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { INDIAN_CITIES } from "@/lib/indianCities";
import { cn } from "@/lib/utils";

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires when a suggestion is explicitly picked (click or Enter). */
  onSelect?: (city: string) => void;
  /** Shown above the filtered list when the field is empty/focused — e.g. cities with real listings. */
  popularCities?: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

const MAX_SUGGESTIONS = 8;

export function CityAutocomplete({
  value,
  onChange,
  onSelect,
  popularCities = [],
  placeholder = "Search for a city",
  className,
  inputClassName,
}: CityAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const suggestions = React.useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return popularCities.length > 0 ? popularCities : INDIAN_CITIES.slice(0, MAX_SUGGESTIONS);

    const starts = INDIAN_CITIES.filter((c) => c.toLowerCase().startsWith(query));
    const contains = INDIAN_CITIES.filter((c) => !c.toLowerCase().startsWith(query) && c.toLowerCase().includes(query));
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [value, popularCities]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(city: string) {
    onChange(city);
    onSelect?.(city);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (suggestions[highlighted]) {
        e.preventDefault();
        pick(suggestions[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2 px-1">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className={cn("border-0 shadow-none focus-visible:ring-0", inputClassName)}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover shadow-card animate-fade-in">
          {!value.trim() && popularCities.length > 0 && (
            <p className="px-3 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cities with listings
            </p>
          )}
          {suggestions.map((city, i) => (
            <button
              key={city}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(city)}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                i === highlighted ? "bg-primary-50 text-primary-700" : "text-foreground hover:bg-muted",
              )}
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
