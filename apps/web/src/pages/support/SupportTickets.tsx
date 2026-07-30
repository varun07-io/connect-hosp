import { AlertTriangle, CheckCircle2, Headset, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSupportTickets } from "@/hooks/useApiQueries";
import { useUpdateSupportTicket } from "@/hooks/useApiMutations";
import { formatDate } from "@/lib/utils";

export function SupportTickets() {
  const { data, isLoading } = useSupportTickets();
  const update = useUpdateSupportTicket();

  return (
    <div className="space-y-4">
      <PageHeader title="Support tickets" description="Assist patients and hospitals, and escalate where needed." />

      {isLoading && <Skeleton className="h-48 rounded-xl" />}

      {!isLoading && data?.length === 0 && (
        <EmptyState icon={Headset} title="No open tickets" description="Issues raised by patients or hospitals will appear here." />
      )}

      <div className="space-y-3">
        {data?.map((ticket) => (
          <Card key={ticket.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-sm font-semibold">{ticket.subject}</p>
                <p className="text-xs text-muted-foreground">
                  Raised by {ticket.raisedBy.name} ({ticket.raisedBy.role.toLowerCase()}) · {formatDate(ticket.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={ticket.status === "RESOLVED" ? "success" : ticket.status === "ESCALATED" ? "destructive" : "warning"}>
                  {ticket.status.replace("_", " ")}
                </Badge>
                {ticket.status !== "RESOLVED" && (
                  <Button
                    size="sm"
                    variant="subtle"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ ticketId: ticket.id, status: "RESOLVED", note: "Resolved by support." })}
                  >
                    {update.isPending && update.variables?.ticketId === ticket.id && update.variables.status === "RESOLVED" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Resolve
                  </Button>
                )}
                {ticket.status !== "ESCALATED" && ticket.status !== "RESOLVED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ ticketId: ticket.id, status: "ESCALATED", note: "Escalated to super admin." })}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Escalate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
