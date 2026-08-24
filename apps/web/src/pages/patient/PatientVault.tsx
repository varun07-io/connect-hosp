import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderLock, FileText, Upload, Trash2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { apiFetch, getAuthHeader } from "@/lib/apiClient";
import { useToast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";

const CATEGORIES = ["LAB_REPORT", "PRESCRIPTION", "IMAGING", "OTHER"] as const;
type Category = (typeof CATEGORIES)[number];

interface MedicalRecord {
  id: string;
  title: string;
  category: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PatientVault() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>("LAB_REPORT");
  const [title, setTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["patient", "records"],
    queryFn: () => apiFetch<MedicalRecord[]>("/api/patient/records"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("category", category);
      form.append("title", title.trim() || file.name);
      form.append("file", file);
      const authHeader = await getAuthHeader();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/patient/records`, {
        method: "POST",
        body: form,
        headers: authHeader,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      setTitle("");
      toast({ title: "Record uploaded" });
    },
    onError: (err) => toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/patient/records/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      toast({ title: "Record deleted" });
    },
  });

  const openRecord = async (id: string) => {
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/patient/records/${id}/url`);
      window.open(url, "_blank");
    } catch {
      toast({ title: "Could not open file", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Medical records vault"
        description="Private to you — a hospital only sees a record if you attach it to an enquiry."
      />

      {/* Upload panel */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-sm">Upload a record</p>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-border text-muted-foreground hover:border-primary-300"
                }`}
              >
                {cat.replace("_", " ")}
              </button>
            ))}
          </div>

          <input
            placeholder="Title (optional — defaults to filename)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              e.target.value = "";
            }}
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            variant="outline"
          >
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? "Uploading…" : "Choose file & upload"}
          </Button>
        </CardContent>
      </Card>

      {/* Records list */}
      {isLoading && <Skeleton className="h-40 rounded-xl" />}

      {!isLoading && !data?.length && (
        <EmptyState
          icon={FolderLock}
          title="Your vault is empty"
          description="Upload lab reports, prescriptions, or imaging to keep all your records in one place."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((record) => (
          <Card key={record.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{record.title}</p>
                <p className="text-xs text-muted-foreground">
                  {record.category.replace("_", " ")} · {formatBytes(record.sizeBytes)} · {formatDate(record.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => openRecord(record.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(record.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
