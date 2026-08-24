import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Upload, Trash2, CheckCircle, Clock, XCircle, Link2, FileText, Loader2 } from "lucide-react";
import { apiFetch, getAuthHeader } from "@/lib/apiClient";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/useToast";

const DOC_TYPES = ["AADHAAR", "PAN", "VOTER_ID", "PASSPORT"] as const;
type DocType = (typeof DOC_TYPES)[number];

// DigiLocker mock — documents that would be returned after OAuth authorization
const DIGILOCKER_DOCS: { label: string; docType: DocType; issuer: string }[] = [
  { label: "Aadhaar Card",      docType: "AADHAAR",   issuer: "UIDAI" },
  { label: "PAN Card",          docType: "PAN",        issuer: "Income Tax Department" },
  { label: "Voter ID Card",     docType: "VOTER_ID",   issuer: "Election Commission of India" },
  { label: "Passport",          docType: "PASSPORT",   issuer: "Ministry of External Affairs" },
];

type DigiLockerStep = "idle" | "connecting" | "authorized" | "fetching";

interface KycDoc {
  id: string;
  docType: string;
  uploadedAt: string;
  fileSizeKb: number | null;
}

interface KycStatus {
  id?: string;
  status: string;
  documents: KycDoc[];
  rejectedReason?: string | null;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  UNVERIFIED: <Clock className="h-5 w-5 text-muted-foreground" />,
  PENDING:    <Clock className="h-5 w-5 text-amber-500" />,
  VERIFIED:   <CheckCircle className="h-5 w-5 text-green-600" />,
  REJECTED:   <XCircle className="h-5 w-5 text-destructive" />,
};

export function PatientKyc() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadMethod, setUploadMethod] = useState<"manual" | "digilocker">("manual");
  const [selectedDocType, setSelectedDocType] = useState<DocType>("AADHAAR");
  const [digiStep, setDigiStep] = useState<DigiLockerStep>("idle");
  const [fetchingDocType, setFetchingDocType] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kyc-me"],
    queryFn: () => apiFetch<KycStatus>("/api/kyc/me"),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      const form = new FormData();
      form.append("docType", docType);
      form.append("file", file);
      const authHeader = await getAuthHeader();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/kyc/documents`, {
        method: "POST",
        body: form,
        headers: authHeader,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-me"] });
      toast({ title: "Document uploaded" });
      setFetchingDocType(null);
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
      setFetchingDocType(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => apiFetch(`/api/kyc/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-me"] });
      toast({ title: "Document removed" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => apiFetch("/api/kyc/submit", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc-me"] });
      toast({ title: "KYC submitted for review" });
    },
  });

  // Simulate DigiLocker OAuth — in production replace with real redirect to
  // https://digilocker.gov.in/public/oauth2/1/authorize?client_id=...
  function handleConnectDigiLocker() {
    setDigiStep("connecting");
    setTimeout(() => setDigiStep("authorized"), 2000); // mock 2-second auth round-trip
  }

  // Simulate fetching a document from DigiLocker and uploading it to the backend
  async function handleFetchDigiDoc(docType: DocType, label: string) {
    setFetchingDocType(docType);
    // In production: call DigiLocker API to download the actual document binary.
    // For MVP: create a placeholder text file representing the fetched document.
    await new Promise((r) => setTimeout(r, 1000)); // mock fetch delay
    const mockContent = `DigiLocker document: ${label}\nFetched on: ${new Date().toISOString()}\n[This is a placeholder for the actual document fetched via DigiLocker API]`;
    const file = new File([mockContent], `${docType.toLowerCase()}_digilocker.txt`, { type: "text/plain" });
    uploadMutation.mutate({ file, docType });
  }

  const kyc = data ?? { status: "UNVERIFIED", documents: [] };
  const canSubmit = kyc.status !== "PENDING" && kyc.status !== "VERIFIED" && kyc.documents.length > 0;
  const uploadedTypes = new Set(kyc.documents.map((d) => d.docType));

  return (
    <div className="space-y-4">
      <PageHeader title="My KYC" description="Verify your identity to unlock all platform features." />

      {/* Status card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            {STATUS_ICON[kyc.status]}
            <div>
              <p className="font-semibold">Verification status</p>
              <Badge variant={kyc.status === "VERIFIED" ? "default" : "muted"}>{kyc.status}</Badge>
            </div>
          </div>
          {kyc.status === "REJECTED" && kyc.rejectedReason && (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{kyc.rejectedReason}</p>
          )}
        </CardContent>
      </Card>

      {/* Upload section */}
      {kyc.status !== "VERIFIED" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="font-semibold">Upload identity document</p>

            {/* Method toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => { setUploadMethod("manual"); setDigiStep("idle"); }}
                className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  uploadMethod === "manual"
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-border text-muted-foreground hover:border-primary-300"
                }`}
              >
                <Upload className="h-4 w-4" />
                Manual upload
              </button>
              <button
                onClick={() => setUploadMethod("digilocker")}
                className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  uploadMethod === "digilocker"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-border text-muted-foreground hover:border-blue-300"
                }`}
              >
                <Link2 className="h-4 w-4" />
                DigiLocker
              </button>
            </div>

            {/* Manual upload UI */}
            {uploadMethod === "manual" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.map((dt) => (
                    <button
                      key={dt}
                      onClick={() => setSelectedDocType(dt)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedDocType === dt
                          ? "border-primary-600 bg-primary-50 text-primary-700"
                          : "border-border text-muted-foreground hover:border-primary-300"
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate({ file, docType: selectedDocType });
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="h-4 w-4" />
                  {uploadMutation.isPending ? "Uploading…" : `Upload ${selectedDocType}`}
                </Button>
                <p className="text-xs text-muted-foreground">Accepted formats: JPG, PNG, PDF (max 5 MB)</p>
              </div>
            )}

            {/* DigiLocker UI */}
            {uploadMethod === "digilocker" && (
              <div className="space-y-4">
                {digiStep === "idle" && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center space-y-3">
                    <div className="flex justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <Link2 className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900">Connect your DigiLocker</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Securely fetch your government-issued documents — Aadhaar, PAN, Voter ID — directly from DigiLocker. No manual upload needed.
                      </p>
                    </div>
                    <Button
                      onClick={handleConnectDigiLocker}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Link2 className="h-4 w-4" />
                      Connect with DigiLocker
                    </Button>
                    <p className="text-xs text-blue-600">
                      You'll be redirected to DigiLocker's secure portal to authorise access.
                    </p>
                  </div>
                )}

                {digiStep === "connecting" && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                    <p className="text-sm font-medium text-blue-800">Connecting to DigiLocker…</p>
                    <p className="text-xs text-blue-600">Authorising secure access to your document locker.</p>
                  </div>
                )}

                {digiStep === "authorized" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                      DigiLocker connected — select documents to fetch
                    </div>
                    <div className="space-y-2">
                      {DIGILOCKER_DOCS.map((doc) => {
                        const alreadyUploaded = uploadedTypes.has(doc.docType);
                        const isFetching = fetchingDocType === doc.docType && uploadMutation.isPending;
                        return (
                          <div
                            key={doc.docType}
                            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{doc.label}</p>
                                <p className="text-xs text-muted-foreground">{doc.issuer}</p>
                              </div>
                            </div>
                            {alreadyUploaded ? (
                              <Badge variant="default" className="text-xs">Fetched</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFetchDigiDoc(doc.docType, doc.label)}
                                disabled={isFetching || uploadMutation.isPending}
                              >
                                {isFetching ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> Fetching…</>
                                ) : (
                                  "Fetch"
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => { setDigiStep("idle"); }}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Disconnect DigiLocker
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-24 rounded-xl" />}

      {/* Uploaded documents list */}
      {kyc.documents.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="font-semibold">Uploaded documents</p>
            {kyc.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{doc.docType}</p>
                  <p className="text-xs text-muted-foreground">{doc.fileSizeKb ? `${doc.fileSizeKb} KB` : "—"}</p>
                </div>
                {kyc.status !== "VERIFIED" && (
                  <button
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canSubmit && (
        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
          <ShieldCheck className="h-4 w-4" />
          {submitMutation.isPending ? "Submitting…" : "Submit for verification"}
        </Button>
      )}
    </div>
  );
}
