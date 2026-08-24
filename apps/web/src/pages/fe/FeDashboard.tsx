import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  Activity,
  ArrowRight,
  Building2,
  Phone,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface FeStats {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  escalated: number;
  admissionsConfirmed: number;
  recentLogs: Array<{
    id: string;
    actionType: string;
    notes: string;
    createdAt: string;
    feQueue: {
      enquiry: {
        patient: { name: string };
        hospital: { name: string };
      } | null;
    } | null;
  }>;
}

const ACTION_LABEL: Record<string, string> = {
  PHONE_CALL: "Called",
  PHYSICAL_VISIT: "Visited",
  DOCUMENT_COLLECTED: "Docs collected",
  ADMISSION_CONFIRMED: "Admission confirmed",
  OTHER: "Other",
};

const ACTION_COLOR: Record<string, "default" | "muted" | "accent" | "destructive" | "outline"> = {
  PHONE_CALL: "muted",
  PHYSICAL_VISIT: "muted",
  DOCUMENT_COLLECTED: "accent",
  ADMISSION_CONFIRMED: "default",
  OTHER: "outline",
};

export function FeDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["fe-stats"],
    queryFn: () => apiFetch<FeStats>("/api/fe/stats"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Executive Dashboard"
        description="Your assignments at a glance."
        actions={
          <Button asChild>
            <Link to="/fe/queue">
              View all bookings <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={ClipboardList} label="Total assigned" value={data.total} />
          <StatCard icon={Activity}      label="In progress"    value={data.inProgress} tone="accent" />
          <StatCard icon={Phone}         label="Not started"    value={data.notStarted} />
          <StatCard icon={CheckCircle}   label="Completed"      value={data.completed} tone="accent" />
          <StatCard icon={AlertTriangle} label="Escalated"      value={data.escalated} />
          <StatCard icon={Building2}     label="Admissions confirmed" value={data.admissionsConfirmed} tone="accent" />
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Recent activity</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/fe/queue">
              All bookings <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {isLoading && <Skeleton className="h-48 rounded-xl" />}

        {!isLoading && data?.recentLogs.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No activity yet — start logging follow-ups from My Bookings.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && data && data.recentLogs.length > 0 && (
          <div className="divide-y divide-border rounded-xl border border-border bg-background">
            {data.recentLogs.map((log) => {
              const enquiry = log.feQueue?.enquiry;
              return (
                <div key={log.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={ACTION_COLOR[log.actionType]}>
                        {ACTION_LABEL[log.actionType] ?? log.actionType}
                      </Badge>
                      {enquiry && (
                        <span className="text-sm font-medium">
                          {enquiry.patient.name} · {enquiry.hospital.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{log.notes}</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
