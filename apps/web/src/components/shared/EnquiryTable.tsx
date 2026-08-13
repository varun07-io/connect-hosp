import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { EnquiryStatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { EnquiryListItem } from "@/types/api";
import { formatDate } from "@/lib/utils";

interface EnquiryTableProps {
  items: EnquiryListItem[] | undefined;
  isLoading: boolean;
  showHospital?: boolean;
  showPatient?: boolean;
  showDoctor?: boolean;
  emptyDescription: string;
  renderActions?: (item: EnquiryListItem) => React.ReactNode;
}

export function EnquiryTable({ items, isLoading, showHospital, showPatient, showDoctor, emptyDescription, renderActions }: EnquiryTableProps) {
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (!items || items.length === 0) {
    return <EmptyState icon={ClipboardList} title="No enquiries yet" description={emptyDescription} />;
  }

  return (
    <>
      {/* Card list — small screens, where a wide table has no room and no scroll affordance. */}
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {showPatient && <p className="truncate font-medium">{item.patient?.name}</p>}
                  {showHospital && <p className="truncate font-medium">{item.hospital?.name}</p>}
                  <p className="text-xs text-muted-foreground">
                    {item.intent === "SURGERY" ? "Surgery" : "Second opinion"}
                    {item.treatment ? ` · ${item.treatment.name}` : ""}
                  </p>
                </div>
                <EnquiryStatusBadge status={item.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {showDoctor && <span>Doctor: {item.assignedDoctor?.user.name ?? "Unassigned"}</span>}
                <span>Submitted {formatDate(item.createdAt)}</span>
              </div>
              {renderActions && <div className="pt-1">{renderActions(item)}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table — md and up, where there's room for every column at once. */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {showPatient && <th className="px-4 py-3 font-medium">Patient</th>}
              {showHospital && <th className="px-4 py-3 font-medium">Hospital</th>}
              <th className="px-4 py-3 font-medium">Intent</th>
              <th className="px-4 py-3 font-medium">Treatment</th>
              {showDoctor && <th className="px-4 py-3 font-medium">Doctor</th>}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              {renderActions && <th className="px-4 py-3 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border transition-colors hover:bg-muted/30">
                {showPatient && <td className="px-4 py-3 font-medium">{item.patient?.name}</td>}
                {showHospital && <td className="px-4 py-3 font-medium">{item.hospital?.name}</td>}
                <td className="px-4 py-3">{item.intent === "SURGERY" ? "Surgery" : "Second opinion"}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.treatment?.name ?? "—"}</td>
                {showDoctor && <td className="px-4 py-3 text-muted-foreground">{item.assignedDoctor?.user.name ?? "Unassigned"}</td>}
                <td className="px-4 py-3"><EnquiryStatusBadge status={item.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                {renderActions && <td className="px-4 py-3">{renderActions(item)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
