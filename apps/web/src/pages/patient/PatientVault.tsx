import { FolderLock, FileText, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { usePatientRecords } from "@/hooks/useApiQueries";
import { formatDate } from "@/lib/utils";

export function PatientVault() {
  const { data, isLoading } = usePatientRecords();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Medical records vault"
        description="Private to you — a hospital only sees a record if you attach it to an enquiry."
        actions={
          <Button disabled title="Upload ships in the next build phase">
            <Upload className="h-4 w-4" /> Upload record
          </Button>
        }
      />

      {isLoading && <Skeleton className="h-40 rounded-xl" />}

      {!isLoading && data?.length === 0 && (
        <EmptyState icon={FolderLock} title="Your vault is empty" description="Uploads open in the next build phase — this page is already reading live, encrypted-at-rest storage." />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((record) => (
          <Card key={record.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium">{record.title}</p>
                <p className="text-xs text-muted-foreground">{record.category.replace("_", " ")} · {formatDate(record.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
