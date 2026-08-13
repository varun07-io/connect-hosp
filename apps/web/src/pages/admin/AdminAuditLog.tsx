import { ScrollText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuditLog } from "@/hooks/useApiQueries";
import { formatDate } from "@/lib/utils";

export function AdminAuditLog() {
  const { data, isLoading } = useAuditLog();

  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" description="Every privileged and status-changing action, platform-wide." />

      {isLoading && <Skeleton className="h-64 rounded-xl" />}

      {!isLoading && data?.length === 0 && (
        <EmptyState icon={ScrollText} title="Nothing logged yet" description="Privileged actions taken across the platform will show up here." />
      )}

      {!isLoading && data && data.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {data.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{entry.action.replace(/_/g, " ")}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor ? `${entry.actor.name} (${entry.actor.role.toLowerCase()})` : "System"} · {entry.entityType} · {entry.entityId.slice(0, 8)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.id} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{entry.actor ? `${entry.actor.name} (${entry.actor.role.toLowerCase()})` : "System"}</td>
                    <td className="px-4 py-3">{entry.action.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.entityType} · {entry.entityId.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
