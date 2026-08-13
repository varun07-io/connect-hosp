import { LayoutGrid, ScrollText } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "Overview", to: "/admin", icon: LayoutGrid, end: true },
  { label: "Audit log", to: "/admin/audit-log", icon: ScrollText },
];

export function AdminLayout() {
  return (
    <RequireRole roles={["SUPER_ADMIN"]}>
      <DashboardShell roleLabel="Super admin" navItems={NAV} />
    </RequireRole>
  );
}
