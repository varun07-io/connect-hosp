import { ClipboardList, CreditCard, FolderLock, ShieldCheck } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "My requests", to: "/patient", icon: ClipboardList, end: true },
  { label: "Records vault", to: "/patient/vault", icon: FolderLock },
  { label: "ID verification", to: "/patient/kyc", icon: ShieldCheck },
  { label: "Payments", to: "/patient/payments", icon: CreditCard },
];

export function PatientLayout() {
  return (
    <RequireRole roles={["PATIENT"]}>
      <DashboardShell roleLabel="Patient dashboard" navItems={NAV} />
    </RequireRole>
  );
}
