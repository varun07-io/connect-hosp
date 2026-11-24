import { ClipboardList, CreditCard, FolderLock, ShieldCheck } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAppConfig } from "@/hooks/useApiQueries";

const NAV = [
  { label: "My requests", to: "/patient", icon: ClipboardList, end: true },
  { label: "Records vault", to: "/patient/vault", icon: FolderLock },
  { label: "ID verification", to: "/patient/kyc", icon: ShieldCheck },
  { label: "Payments", to: "/patient/payments", icon: CreditCard },
];

export function PatientLayout() {
  const { paymentsEnabled } = useAppConfig();
  const nav = paymentsEnabled ? NAV : NAV.filter((n) => n.to !== "/patient/payments");
  return (
    <RequireRole roles={["PATIENT"]}>
      <DashboardShell roleLabel="Patient dashboard" navItems={nav} />
    </RequireRole>
  );
}
