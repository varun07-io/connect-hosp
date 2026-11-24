import { Check, PhoneMissed, X } from "lucide-react";
import type { EnquiryStatus } from "@connect-hospital/shared";
import { JOURNEY_STEPS, journeyStage } from "@/lib/enquiryProgress";
import { cn } from "@/lib/utils";

/** Five-milestone journey tracker. `compact` renders a slim bar for list cards. */
export function EnquiryProgress({ status, compact = false }: { status: EnquiryStatus; compact?: boolean }) {
  const stage = journeyStage(status);
  const cancelled = status === "CANCELLED";
  const missed = status === "NO_RESPONSE";

  if (compact) {
    return (
      <div className="flex items-center gap-1" aria-label={`Step ${stage + 1} of ${JOURNEY_STEPS.length}`}>
        {JOURNEY_STEPS.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              cancelled
                ? "bg-muted"
                : i < stage || (i === stage && stage === JOURNEY_STEPS.length - 1)
                  ? "bg-primary-600"
                  : i === stage
                    ? missed
                      ? "bg-amber-400"
                      : "bg-primary-300"
                    : "bg-muted",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-5 gap-1">
      {JOURNEY_STEPS.map((s, i) => {
        const done = !cancelled && (i < stage || (i === stage && stage === JOURNEY_STEPS.length - 1));
        const current = !cancelled && i === stage && !done;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn(
                  "absolute right-1/2 top-4 -z-0 h-0.5 w-full -translate-y-1/2",
                  !cancelled && i <= stage ? "bg-primary-600" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                done && "border-primary-600 bg-primary-600 text-white",
                current && !missed && "border-primary-600 bg-background text-primary-700 ring-4 ring-primary-100",
                current && missed && "border-amber-500 bg-amber-50 text-amber-700 ring-4 ring-amber-100",
                !done && !current && "border-border bg-background text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-4 w-4" />
              ) : cancelled ? (
                <X className="h-3.5 w-3.5" />
              ) : current && missed ? (
                <PhoneMissed className="h-3.5 w-3.5" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "mt-2 text-[11px] font-medium leading-tight sm:text-xs",
                done || current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
