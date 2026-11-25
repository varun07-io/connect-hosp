import * as React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  HeartPulse,
  Inbox,
  Stethoscope,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { HospitalStatusBadge } from "@/components/shared/StatusBadge";
import { useHospitalMe, useHospitalEnquiries } from "@/hooks/useApiQueries";
import { slaState } from "@/lib/sla";
import { cn } from "@/lib/utils";

export function HospitalOverview() {
  const { data, isLoading } = useHospitalMe();
  const { data: enquiries, isLoading: enquiriesLoading } = useHospitalEnquiries();
  const [now] = React.useState(() => Date.now());

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const items = enquiries ?? [];
  const sla = data.slaCallbackHours ?? 48;
  const withSla = items.map((e) => ({ e, s: slaState(e.createdAt, e.status, sla, now) }));
  const needsAction = items.filter((e) => ["NEW", "ACKNOWLEDGED", "REOPENED"].includes(e.status)).length;
  const overdue = withSla.filter((x) => x.s?.tone === "overdue").length;
  const withDoctor = items.filter((e) => ["ASSIGNED", "CONTACTED", "NO_RESPONSE"].includes(e.status)).length;
  const decided = items.filter((e) => e.status !== "CANCELLED");
  const guided = decided.filter((e) => e.status === "GUIDED" || e.status === "CLOSED").length;
  const guidedRate = decided.length ? Math.round((guided / decided.length) * 100) : null;
  const urgent = withSla
    .filter((x) => x.s)
    .sort((a, b) => a.s!.msLeft - b.s!.msLeft)
    .slice(0, 5);

  const checklist = [
    { done: (data.description?.length ?? 0) >= 80, label: "Write a description patients can trust", to: "/hospital/settings" },
    { done: data.specialities.length > 0, label: "List your specialities", to: "/hospital/settings" },
    { done: data.facilities.length >= 3, label: "Add at least 3 facilities", to: "/hospital/settings" },
    { done: data._count.doctors > 0, label: "Add your first doctor", to: "/hospital/doctors" },
    { done: data._count.treatmentPrices >= 3, label: "Price at least 3 treatments", to: "/hospital/prices" },
  ];
  const complete = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {data.name}
            <HospitalStatusBadge status={data.status} />
          </span>
        }
        description={`${data.city} · callback commitment ${sla}h${data.depositRequired ? " · deposits on" : ""}`}
        actions={
          <Button asChild>
            <Link to="/hospital/enquiries">
              <Inbox className="h-4 w-4" /> Open inbox
            </Link>
          </Button>
        }
      />

      {data.status !== "APPROVED" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-semibold">Awaiting verification.</span> Your profile isn't visible to patients yet — use this time to
          complete the checklist below so you go live with a strong listing.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={ClipboardList} label="Need action" value={needsAction} hint="New or acknowledged" tone={needsAction ? "accent" : "default"} to="/hospital/enquiries" />
        <Kpi icon={AlertTriangle} label="Past callback deadline" value={overdue} hint={`Older than ${sla}h, no call yet`} tone={overdue ? "danger" : "default"} to="/hospital/enquiries" />
        <Kpi icon={Stethoscope} label="With doctors" value={withDoctor} hint="Assigned, awaiting outcome" />
        <Kpi icon={HeartPulse} label="Patients guided" value={guidedRate === null ? "—" : `${guidedRate}%`} hint={`${guided} of ${decided.length} enquiries`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-semibold">Call these patients next</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/hospital/enquiries">
                  Inbox <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {enquiriesLoading && <Skeleton className="m-5 h-40" />}
            {!enquiriesLoading && urgent.length === 0 && (
              <p className="flex items-center gap-2 px-5 py-10 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" /> You're all caught up — every patient has had a call.
              </p>
            )}
            <ul className="divide-y divide-border">
              {urgent.map(({ e, s }) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.patient?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.treatment?.name ?? (e.intent === "SURGERY" ? "Surgery" : "Second opinion")} · {e.assignedDoctor ? e.assignedDoctor.user.name : "No doctor yet"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      s!.tone === "overdue" ? "bg-red-100 text-red-800" : s!.tone === "soon" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Clock className="h-3 w-3" /> {s!.label}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-base font-semibold">Profile strength</h2>
                <span className="text-sm font-semibold text-primary-700">
                  {complete}/{checklist.length}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${(complete / checklist.length) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {complete === checklist.length
                  ? "Your listing is complete. Keep prices and doctors up to date."
                  : "Patients compare doctors, prices and facilities before choosing — fill the gaps."}
              </p>
            </div>
            <ul className="space-y-1">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link
                    to={c.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      c.done ? "text-muted-foreground" : "font-medium hover:bg-muted",
                    )}
                  >
                    {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className={cn(c.done && "line-through")}>{c.label}</span>
                    {!c.done && <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  to,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: "default" | "accent" | "danger";
  to?: string;
}) {
  const body = (
    <Card
      className={cn(
        "h-full transition-colors",
        tone === "accent" && "border-accent-300 bg-accent-50/50",
        tone === "danger" && "border-red-200 bg-red-50/60",
        to && "hover:border-primary-300",
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className={cn("h-4 w-4", tone === "danger" ? "text-red-600" : tone === "accent" ? "text-accent-600" : "text-primary-600")} />
        </div>
        <p className="mt-2 font-display text-3xl font-bold leading-none">{value}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
