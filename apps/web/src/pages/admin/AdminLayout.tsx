import { LayoutGrid, ScrollText, ShieldCheck } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "Overview", to: "/admin", icon: LayoutGrid, end: true },
  { label: "Audit log", to: "/admin/audit-log", icon: ScrollText },
  { label: "KYC review", to: "/admin/kyc", icon: ShieldCheck },
];

export function AdminLayout() {
  return (
    <RequireRole roles={["SUPER_ADMIN"]}>
      <DashboardShell roleLabel="Super admin" navItems={NAV} />
    </RequireRole>
  );
}
