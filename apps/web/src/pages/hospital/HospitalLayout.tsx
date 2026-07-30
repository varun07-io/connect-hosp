import { LayoutGrid, ClipboardList } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "Overview", to: "/hospital", icon: LayoutGrid, end: true },
  { label: "Enquiries", to: "/hospital/enquiries", icon: ClipboardList },
];

export function HospitalLayout() {
  return (
    <RequireRole roles={["HOSPITAL_ADMIN"]}>
      <DashboardShell roleLabel="Hospital dashboard" navItems={NAV} />
    </RequireRole>
  );
}
