import { Link } from "react-router-dom";
import { Stethoscope, ClipboardList, Wallet, ShieldCheck, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { HospitalStatusBadge } from "@/components/shared/StatusBadge";
import { EnquiryTable } from "@/components/shared/EnquiryTable";
import { useHospitalMe, useHospitalEnquiries } from "@/hooks/useApiQueries";

export function HospitalOverview() {
  const { data, isLoading } = useHospitalMe();
  const { data: enquiries, isLoading: enquiriesLoading } = useHospitalEnquiries();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {data.name}
            <HospitalStatusBadge status={data.status} />
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total enquiries" value={data._count.enquiries} />
        <StatCard icon={Stethoscope} label="Doctors" value={data._count.doctors} tone="accent" />
        <StatCard icon={Wallet} label="Treatments priced" value={data._count.treatmentPrices} />
        <StatCard icon={ShieldCheck} label="Status" value={data.status === "APPROVED" ? "Live" : "Pending"} tone="accent" />
      </div>

      {data.status !== "APPROVED" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your hospital is awaiting verification. Profile, doctor and price-list management, plus enquiry
          handling, unlock once the verification team approves your registration.
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Recent enquiries</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/hospital/enquiries">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <EnquiryTable
          items={enquiries?.slice(0, 5)}
          isLoading={enquiriesLoading}
          showPatient
          showDoctor
          emptyDescription="Enquiries submitted by patients on your hospital profile will appear here in real time."
        />
      </div>
    </div>
  );
}
