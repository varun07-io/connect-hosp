import { Link } from "react-router-dom";
import { Building2, Users, Stethoscope, ClipboardList, ArrowRight, ScrollText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAdminOverview, useAuditLog } from "@/hooks/useApiQueries";
import { formatDate } from "@/lib/utils";

export function AdminOverview() {
  const { data, isLoading } = useAdminOverview();
  const { data: auditLog, isLoading: auditLoading } = useAuditLog();

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="POC caps: 50 hospitals · 200 patients (pilot cohort)." />

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Building2} label="Hospitals" value={`${data.hospitals} / 50`} />
          <StatCard icon={Users} label="Patients" value={`${data.patients} / 200`} tone="accent" />
          <StatCard icon={Stethoscope} label="Doctors" value={data.doctors} />
          <StatCard icon={ClipboardList} label="Enquiries" value={data.enquiries} tone="accent" />
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Recent activity</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/audit-log">
              Full audit log <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {auditLoading && <Skeleton className="h-48 rounded-xl" />}
        {!auditLoading && auditLog?.length === 0 && (
          <EmptyState icon={ScrollText} title="Nothing logged yet" description="Privileged actions across the platform will show up here." />
        )}
        {!auditLoading && auditLog && auditLog.length > 0 && (
          <div className="divide-y divide-border rounded-xl border border-border bg-background">
            {auditLog.slice(0, 6).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{entry.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor ? `${entry.actor.name} · ${entry.actor.role.toLowerCase()}` : "System"} · {entry.entityType}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
