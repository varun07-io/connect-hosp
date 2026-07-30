import { ClipboardList } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [{ label: "Assigned enquiries", to: "/doctor", icon: ClipboardList, end: true }];

export function DoctorLayout() {
  return (
    <RequireRole roles={["DOCTOR"]}>
      <DashboardShell roleLabel="Doctor panel" navItems={NAV} />
    </RequireRole>
  );
}
