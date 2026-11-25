import * as React from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Chips with one-tap suggestions plus free-text entry (Enter or comma to add). */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Type and press Enter",
  max = 30,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  id?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());

  function add(raw: string) {
    const t = raw.trim().replace(/,$/, "");
    if (!t || has(t) || value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  }

  const remaining = suggestions.filter((s) => !has(s));

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-800">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`} className="rounded hover:bg-primary-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          id={id}
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-[140px] flex-1 border-0 p-1 shadow-none focus-visible:ring-0"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700",
              )}
            >
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
