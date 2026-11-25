import { BadgeCheck, Building2, LayoutGrid, LifeBuoy, ScrollText, ShieldCheck } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "Overview", to: "/admin", icon: LayoutGrid, end: true },
  { label: "Hospital verification", to: "/admin/verification", icon: BadgeCheck },
  { label: "Govt hospital list", to: "/admin/govt-hospitals", icon: Building2 },
  { label: "Support tickets", to: "/admin/support", icon: LifeBuoy },
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
