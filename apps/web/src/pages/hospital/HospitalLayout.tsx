import { LayoutGrid, Inbox, Stethoscope, Wallet, Settings } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "Overview", to: "/hospital", icon: LayoutGrid, end: true },
  { label: "Enquiry inbox", to: "/hospital/enquiries", icon: Inbox },
  { label: "Doctors", to: "/hospital/doctors", icon: Stethoscope },
  { label: "Prices", to: "/hospital/prices", icon: Wallet },
  { label: "Settings", to: "/hospital/settings", icon: Settings },
];

export function HospitalLayout() {
  return (
    <RequireRole roles={["HOSPITAL_ADMIN"]}>
      <DashboardShell roleLabel="Hospital dashboard" navItems={NAV} />
    </RequireRole>
  );
}
