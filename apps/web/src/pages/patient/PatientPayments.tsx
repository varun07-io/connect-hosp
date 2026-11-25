import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { useAppConfig } from "@/hooks/useApiQueries";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  gatewayPaymentId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  refunds: { id: string; amount: number; status: string; reason: string; createdAt: string }[];
}

interface PaymentEnquiry {
  id: string;
  intent: string;
  condition: string;
  createdAt: string;
  hospital: { name: string };
  payment: PaymentRecord | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "muted" | "destructive" }> = {
  PENDING:          { label: "Pending",          icon: <Clock className="h-3 w-3" />,       variant: "muted" },
  VERIFIED:         { label: "Paid",             icon: <CheckCircle2 className="h-3 w-3" />, variant: "default" },
  FAILED:           { label: "Failed",           icon: <XCircle className="h-3 w-3" />,      variant: "destructive" },
  REFUND_INITIATED: { label: "Refund initiated", icon: <RefreshCw className="h-3 w-3" />,    variant: "muted" },
  REFUNDED:         { label: "Refunded",         icon: <RefreshCw className="h-3 w-3" />,    variant: "muted" },
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function PatientPayments() {
  const { paymentsEnabled } = useAppConfig();
  if (!paymentsEnabled) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No payments in this prototype"
        description="Requests are free — deposits and payments are switched off for now."
      />
    );
  }
  return <PaymentHistory />;
}

function PaymentHistory() {
  const { data, isLoading, error } = useQuery<PaymentEnquiry[]>({
    queryKey: ["patient", "payments"],
    queryFn: () => apiFetch("/api/patient/payments"),
  });

  if (isLoading) {
    return <div className="py-16 text-center text-muted-foreground text-sm">Loading payment history…</div>;
  }

  if (error) {
    return <div className="py-16 text-center text-destructive text-sm">Failed to load payments.</div>;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Payment history</h1>
        <p className="text-sm text-muted-foreground mt-1">Deposits and refunds for your bookings.</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <CreditCard className="h-10 w-10 opacity-30" />
          <p className="text-sm">No payments yet. Payments appear here when a hospital requires a deposit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const p = row.payment;
            if (!p) return null;
            const cfg = STATUS_CONFIG[p.status] ?? { label: p.status, icon: null, variant: "muted" as const };
            return (
              <div key={p.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{row.hospital.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.intent === "SURGERY" ? "Surgery booking" : "Second opinion"} · {fmtDate(row.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{row.condition}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-base">{fmt(p.amount, p.currency)}</p>
                    <Badge variant={cfg.variant} className="mt-1 flex items-center gap-1 text-xs">
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                  </div>
                </div>

                {p.gatewayPaymentId && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Ref: {p.gatewayPaymentId}
                  </p>
                )}

                {p.refunds.length > 0 && (
                  <div className="mt-3 border-t pt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Refunds</p>
                    {p.refunds.map((r) => (
                      <div key={r.id} className="flex justify-between text-xs text-muted-foreground">
                        <span>{r.reason} · {fmtDate(r.createdAt)}</span>
                        <span className="font-medium">{fmt(r.amount, p.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
