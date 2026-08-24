import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";

interface KycItem {
  id: string;
  status: string;
  kycType: string;
  updatedAt: string;
  user: { name: string; email: string | null; phone: string | null; role: string };
  documents: Array<{ id: string; docType: string; uploadedAt: string }>;
}

function KycCard({ item }: { item: KycItem }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const reviewMutation = useMutation({
    mutationFn: (decision: "VERIFIED" | "REJECTED") =>
      apiFetch(`/api/admin/kyc/${item.id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, rejectedReason: reason || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-queue"] });
      toast({ title: "KYC decision saved" });
    },
    onError: () => toast({ title: "Failed to save decision", variant: "destructive" }),
  });

  const openSignedUrl = async (docId: string) => {
    const result = await apiFetch<{ url: string }>(`/api/kyc/documents/${docId}/url`);
    window.open(result.url, "_blank");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{item.user.name}</p>
            <p className="text-sm text-muted-foreground">{item.user.email ?? item.user.phone} · {item.user.role}</p>
          </div>
          <Badge variant="muted">{item.status}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => openSignedUrl(doc.id)}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary-300 hover:text-primary-700"
            >
              {doc.docType} <ExternalLink className="h-3 w-3" />
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">Submitted {formatDate(item.updatedAt)}</p>

        {item.status === "PENDING" && (
          <div className="space-y-2">
            <input
              placeholder="Rejection reason (required if rejecting)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => reviewMutation.mutate("VERIFIED")}
                disabled={reviewMutation.isPending}
              >
                <ShieldCheck className="h-4 w-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => reviewMutation.mutate("REJECTED")}
                disabled={reviewMutation.isPending || !reason}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KycReviewQueue() {
  const { data, isLoading } = useQuery({
    queryKey: ["kyc-queue"],
    queryFn: () => apiFetch<KycItem[]>("/api/admin/kyc?status=PENDING"),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="KYC Review" description="Review and approve identity verification submissions." />

      {isLoading && <Skeleton className="h-40 rounded-xl" />}
      {!isLoading && !data?.length && (
        <EmptyState icon={ShieldCheck} title="No pending KYC submissions" description="All submissions have been reviewed." />
      )}
      {data?.map((item) => <KycCard key={item.id} item={item} />)}
    </div>
  );
}
