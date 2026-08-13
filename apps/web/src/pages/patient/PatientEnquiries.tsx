import { ClipboardList, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { EnquiryStatusBadge } from "@/components/shared/StatusBadge";
import { usePatientEnquiries } from "@/hooks/useApiQueries";
import { formatDate } from "@/lib/utils";

export function PatientEnquiries() {
  const { data, isLoading } = usePatientEnquiries();

  return (
    <div className="space-y-4">
      <PageHeader
        title="My enquiries"
        description="Track every surgery booking or second-opinion request you've sent."
        actions={
          <Button asChild>
            <Link to="/search"><Search className="h-4 w-4" /> Find a hospital</Link>
          </Button>
        }
      />

      {isLoading && <Skeleton className="h-40 rounded-xl" />}

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No enquiries yet"
          description="Search for a hospital and book a visit or request a second opinion to get started."
          action={
            <Button asChild>
              <Link to="/search">Browse hospitals</Link>
            </Button>
          }
        />
      )}

      <div className="space-y-3">
        {data?.map((enquiry) => (
          <Card key={enquiry.id}>
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-sm font-semibold">{enquiry.hospital?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {enquiry.intent === "SURGERY" ? "Surgery booking" : "Second opinion"}
                  {enquiry.treatment ? ` · ${enquiry.treatment.name}` : ""} · {formatDate(enquiry.createdAt)}
                </p>
              </div>
              <EnquiryStatusBadge status={enquiry.status} className="self-start" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
