import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { schemeName } from "@connect-hospital/shared";
import { Button } from "@/components/ui/button";
import type { GovtHospital } from "@/hooks/useGovtHospitals";
import { avatarLetter, directionsUrl, locationLine, matchesTerm, typeTone } from "@/lib/govtDirectory";
import { cn } from "@/lib/utils";

export function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
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

export function SchemeBadge({ code, className }: { code: string; className?: string }) {
  return (
    <span
      title={schemeName(code)}
      className={cn("inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-800 ring-1 ring-inset ring-green-200", className)}
    >
      <ShieldCheck className="h-3 w-3" /> {code}
    </span>
  );
}

/** Specialities the visitor searched or filtered for come first, highlighted. */
export function rankSpecialities(h: GovtHospital, tokens: string[], selected: string[]) {
  const relevant = (s: string) => selected.includes(s) || tokens.some((t) => matchesTerm(s.toLowerCase(), t));
  return [...h.specialities]
    .map((s) => ({ s, hit: relevant(s) }))
    .sort((a, b) => Number(b.hit) - Number(a.hit));
}

export function GovtHospitalCard({ h, tokens, selectedSpecs }: { h: GovtHospital; tokens: string[]; selectedSpecs: string[] }) {
  const tone = typeTone(h.subType);
  const specs = rankSpecialities(h, tokens, selectedSpecs);
  const shown = specs.slice(0, 4);
  const to = `/government-hospitals/${h.id}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift">
      <div className={cn("h-1.5", tone.bar)} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex gap-3.5">
          <span
            className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-white shadow-soft", tone.solid)}
            aria-hidden
          >
            {avatarLetter(h.name)}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-bold leading-snug">
              {/* Stretched link: the whole card opens the hospital, buttons stay clickable. */}
              <Link to={to} className="line-clamp-2 after:absolute after:inset-0 after:content-[''] group-hover:text-primary-700">
                <Highlight text={h.name} tokens={tokens} />
              </Link>
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-accent-500" /> {locationLine(h)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {h.subType && <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone.badge)}>{h.subType}</span>}
          {h.schemes.map((s) => (
            <SchemeBadge key={s} code={s} />
          ))}
        </div>

        {h.address && (
          <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            <Highlight text={h.address} tokens={tokens} />
          </p>
        )}

        {specs.length > 0 && (
          <>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specialities</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shown.map(({ s, hit }) => (
                <span
                  key={s}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    hit ? "border-primary-600 bg-primary-600 font-medium text-white" : "border-border bg-muted/40 text-foreground/80",
                  )}
                >
                  {s}
                </span>
              ))}
              {specs.length > shown.length && (
                <span className="rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">
                  +{specs.length - shown.length} more
                </span>
              )}
            </div>
          </>
        )}

        <div className="relative z-10 mt-auto flex gap-2 pt-5">
          <Button asChild className="flex-1">
            <Link to={to}>
              View details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" title="Directions">
            <a href={directionsUrl(h)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${h.name}`}>
              <Navigation className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}
