import * as React from "react";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, CreditCard, PhoneMissed, Search, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { EnquiryProgress } from "@/components/shared/EnquiryProgress";
import { usePatientEnquiries } from "@/hooks/useApiQueries";
import { PATIENT_STATUS_LABEL, isActive, statusTone, type Tone } from "@/lib/enquiryProgress";
import type { EnquiryListItem } from "@/types/api";
import { cn, formatRelative } from "@/lib/utils";

const TONE_BADGE: Record<Tone, BadgeProps["variant"]> = {
  primary: "default",
  success: "success",
  warning: "warning",
  muted: "muted",
  destructive: "destructive",
};

type Filter = "active" | "past" | "all";

/** Something the patient has to do for this request to move forward. */
function actionNeeded(e: EnquiryListItem): { icon: typeof CreditCard; text: string } | null {
  if (!isActive(e.status)) return null;
  if (e.paymentRequired && (!e.payment || ["PENDING", "FAILED"].includes(e.payment.status))) {
    return { icon: CreditCard, text: "Pay the refundable deposit to confirm your booking" };
  }
  if (e.status === "NO_RESPONSE") {
    return { icon: PhoneMissed, text: "The doctor couldn't reach you — keep your phone handy" };
  }
  return null;
}

export function PatientEnquiries() {
  const { data, isLoading } = usePatientEnquiries();
  const [filter, setFilter] = React.useState<Filter>("active");

  const counts = React.useMemo(() => {
    const items = data ?? [];
    return {
      active: items.filter((e) => isActive(e.status)).length,
      past: items.filter((e) => !isActive(e.status)).length,
      all: items.length,
      action: items.filter((e) => actionNeeded(e)).length,
      guided: items.filter((e) => e.status === "GUIDED" || e.status === "CLOSED").length,
    };
  }, [data]);

  // Default to "all" when nothing is active, so returning patients don't land on an empty tab.
  React.useEffect(() => {
    if (data && counts.active === 0 && counts.all > 0) setFilter("all");
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = (data ?? []).filter((e) =>
    filter === "all" ? true : filter === "active" ? isActive(e.status) : !isActive(e.status),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="My care requests"
        description="Every surgery consultation and second opinion you've requested, and exactly where each one stands."
        actions={
          <Button asChild>
            <Link to="/search">
              <Search className="h-4 w-4" /> Find a hospital
            </Link>
          </Button>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No requests yet"
          description="Compare verified hospitals by cost and rating, then request a free doctor callback — it takes about two minutes."
          action={
            <Button asChild>
              <Link to="/search">Browse hospitals</Link>
            </Button>
          }
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryTile icon={Stethoscope} label="In progress" value={counts.active} />
            <SummaryTile icon={AlertCircle} label="Need your action" value={counts.action} highlight={counts.action > 0} />
            <SummaryTile icon={CheckCircle2} label="Guided" value={counts.guided} />
          </div>

          <div className="inline-flex rounded-lg border border-border bg-background p-1" role="tablist">
            {(["active", "past", "all"] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  filter === f ? "bg-primary-600 text-white shadow-soft" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f} <span className={cn("ml-1 text-xs", filter === f ? "text-primary-100" : "text-muted-foreground")}>{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {visible.map((enquiry) => (
              <EnquiryCard key={enquiry.id} enquiry={enquiry} />
            ))}
            {visible.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                Nothing here.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, highlight }: { icon: typeof Stethoscope; label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4",
        highlight ? "border-accent-300 bg-accent-50/60" : "border-border",
      )}
    >
      <Icon className={cn("h-5 w-5", highlight ? "text-accent-600" : "text-primary-600")} />
      <div>
        <p className="font-display text-xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function EnquiryCard({ enquiry }: { enquiry: EnquiryListItem }) {
  const action = actionNeeded(enquiry);
  const tone = statusTone(enquiry.status);

  return (
    <Link to={`/patient/enquiries/${enquiry.id}`} className="group block">
      <Card className={cn("transition-all group-hover:border-primary-300 group-hover:shadow-card", action && "border-accent-300")}>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display font-semibold group-hover:text-primary-700">{enquiry.hospital?.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {enquiry.intent === "SURGERY" ? "Surgery consultation" : "Second opinion"}
                {enquiry.treatment ? ` · ${enquiry.treatment.name}` : ""}
                {enquiry.hospital?.city ? ` · ${enquiry.hospital.city}` : ""}
              </p>
            </div>
            <Badge variant={TONE_BADGE[tone]} className="shrink-0">
              {PATIENT_STATUS_LABEL[enquiry.status]}
            </Badge>
          </div>

          {enquiry.status !== "CANCELLED" && <EnquiryProgress status={enquiry.status} compact />}

          {action && (
            <p className="flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-xs font-medium text-accent-800">
              <action.icon className="h-3.5 w-3.5 shrink-0" /> {action.text}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {enquiry.assignedDoctor ? `${enquiry.assignedDoctor.user.name} · ` : ""}
              Updated {formatRelative(enquiry.updatedAt ?? enquiry.createdAt)}
            </span>
            <span className="flex items-center gap-1 font-medium text-primary-700">
              Details <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
