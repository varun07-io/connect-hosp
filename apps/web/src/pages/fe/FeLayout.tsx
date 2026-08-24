import { ClipboardList, LayoutDashboard } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "Dashboard", to: "/fe", icon: LayoutDashboard, end: true },
  { label: "My Bookings", to: "/fe/queue", icon: ClipboardList },
];

export function FeLayout() {
  return (
    <RequireRole roles={["FIELD_EXECUTIVE_HOSPITAL", "FIELD_EXECUTIVE_CONNECT", "FE_MANAGER"]}>
      <DashboardShell roleLabel="Field Executive" navItems={NAV} />
    </RequireRole>
  );
}
