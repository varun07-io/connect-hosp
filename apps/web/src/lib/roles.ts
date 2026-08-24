import type { Role } from "@connect-hospital/shared";

export const ROLE_HOME: Record<Role, string> = {
  PATIENT: "/patient",
  HOSPITAL_ADMIN: "/hospital",
  DOCTOR: "/doctor",
  VERIFICATION: "/verification",
  SUPPORT: "/support",
  SUPER_ADMIN: "/admin",
  FIELD_EXECUTIVE_HOSPITAL: "/fe",
  FIELD_EXECUTIVE_CONNECT: "/fe",
  FE_MANAGER: "/fe",
};

export const ROLE_LABEL: Record<Role, string> = {
  PATIENT: "Patient",
  HOSPITAL_ADMIN: "Hospital Admin",
  DOCTOR: "Doctor",
  VERIFICATION: "Verification Team",
  SUPPORT: "Support Team",
  SUPER_ADMIN: "Super Admin",
  FIELD_EXECUTIVE_HOSPITAL: "Field Executive (Hospital)",
  FIELD_EXECUTIVE_CONNECT: "Field Executive (Connect)",
  FE_MANAGER: "FE Manager",
};
