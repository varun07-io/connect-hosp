import { ListChecks } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [{ label: "Verification queue", to: "/verification", icon: ListChecks, end: true }];

export function VerificationLayout() {
  return (
    <RequireRole roles={["VERIFICATION", "SUPER_ADMIN"]}>
      <DashboardShell roleLabel="Hospital verification" navItems={NAV} />
    </RequireRole>
  );
}
