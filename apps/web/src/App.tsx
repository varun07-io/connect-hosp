import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toast";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Home } from "@/pages/public/Home";
import { SearchResults } from "@/pages/public/SearchResults";
import { HospitalProfile } from "@/pages/public/HospitalProfile";
import { Login } from "@/pages/public/Login";
import { NotFound } from "@/pages/public/NotFound";

import { PatientLayout } from "@/pages/patient/PatientLayout";
import { PatientEnquiries } from "@/pages/patient/PatientEnquiries";
import { PatientEnquiryDetail } from "@/pages/patient/PatientEnquiryDetail";
import { PatientVault } from "@/pages/patient/PatientVault";
import { PatientPayments } from "@/pages/patient/PatientPayments";

import { HospitalLayout } from "@/pages/hospital/HospitalLayout";
import { HospitalOverview } from "@/pages/hospital/HospitalOverview";
import { HospitalEnquiries } from "@/pages/hospital/HospitalEnquiries";

import { DoctorLayout } from "@/pages/doctor/DoctorLayout";
import { DoctorEnquiries } from "@/pages/doctor/DoctorEnquiries";

import { VerificationLayout } from "@/pages/verification/VerificationLayout";
import { VerificationQueue } from "@/pages/verification/VerificationQueue";

import { SupportLayout } from "@/pages/support/SupportLayout";
import { SupportTickets } from "@/pages/support/SupportTickets";

import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { AdminAuditLog } from "@/pages/admin/AdminAuditLog";

import { FeLayout } from "@/pages/fe/FeLayout";
import { FeDashboard } from "@/pages/fe/FeDashboard";
import { FeQueue } from "@/pages/fe/FeQueue";

import { PatientKyc } from "@/pages/kyc/PatientKyc";
import { KycReviewQueue } from "@/pages/kyc/KycReviewQueue";

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/hospitals/:slug" element={<HospitalProfile />} />
          <Route path="/login" element={<Login />} />
        </Route>

        <Route path="/patient" element={<PatientLayout />}>
          <Route index element={<PatientEnquiries />} />
          <Route path="enquiries/:id" element={<PatientEnquiryDetail />} />
          <Route path="vault" element={<PatientVault />} />
          <Route path="kyc" element={<PatientKyc />} />
          <Route path="payments" element={<PatientPayments />} />
        </Route>

        <Route path="/hospital" element={<HospitalLayout />}>
          <Route index element={<HospitalOverview />} />
          <Route path="enquiries" element={<HospitalEnquiries />} />
        </Route>

        <Route path="/doctor" element={<DoctorLayout />}>
          <Route index element={<DoctorEnquiries />} />
        </Route>

        <Route path="/verification" element={<VerificationLayout />}>
          <Route index element={<VerificationQueue />} />
        </Route>

        <Route path="/support" element={<SupportLayout />}>
          <Route index element={<SupportTickets />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="kyc" element={<KycReviewQueue />} />
        </Route>

        <Route path="/fe" element={<FeLayout />}>
          <Route index element={<FeDashboard />} />
          <Route path="queue" element={<FeQueue />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}
