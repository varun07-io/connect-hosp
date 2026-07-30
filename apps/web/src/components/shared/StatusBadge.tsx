import type { EnquiryStatus, HospitalStatus } from "@connect-hospital/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const ENQUIRY_VARIANT: Record<EnquiryStatus, BadgeProps["variant"]> = {
  NEW: "accent",
  ACKNOWLEDGED: "default",
  ASSIGNED: "default",
  CONTACTED: "default",
  GUIDED: "success",
  CLOSED: "success",
  CANCELLED: "muted",
  NO_RESPONSE: "destructive",
  REOPENED: "warning",
};

const HOSPITAL_VARIANT: Record<HospitalStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  IN_REVIEW: "default",
  APPROVED: "success",
  REJECTED: "destructive",
};

function toTitle(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function EnquiryStatusBadge({ status, className }: { status: EnquiryStatus; className?: string }) {
  return <Badge variant={ENQUIRY_VARIANT[status]} className={className}>{toTitle(status)}</Badge>;
}

export function HospitalStatusBadge({ status, className }: { status: HospitalStatus; className?: string }) {
  return <Badge variant={HOSPITAL_VARIANT[status]} className={className}>{toTitle(status)}</Badge>;
}
