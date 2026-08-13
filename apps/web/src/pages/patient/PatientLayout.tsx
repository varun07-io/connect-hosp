import { ClipboardList, FolderLock } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { DashboardShell } from "@/components/layout/DashboardShell";

const NAV = [
  { label: "My enquiries", to: "/patient", icon: ClipboardList, end: true },
  { label: "Medical records vault", to: "/patient/vault", icon: FolderLock },
];

export function PatientLayout() {
  return (
    <RequireRole roles={["PATIENT"]}>
      <DashboardShell roleLabel="Patient dashboard" navItems={NAV} />
    </RequireRole>
  );
}
