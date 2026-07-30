import { Headset } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [{ label: "Tickets", to: "/support", icon: Headset, end: true }];

export function SupportLayout() {
  return (
    <RequireRole roles={["SUPPORT", "SUPER_ADMIN"]}>
      <DashboardShell roleLabel="Support console" navItems={NAV} />
    </RequireRole>
  );
}
