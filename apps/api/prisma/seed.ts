import { PrismaClient, type EnquiryStatus, type EnquiryIntent, type CallbackOutcome } from "@prisma/client";

const prisma = new PrismaClient();

// Mirrors the "browse by surgery" categories on the reference site
// (connecthospital.in) so the homepage grid has something real to point at.
const TREATMENTS: { name: string; category: string }[] = [
  { name: "Cataract Surgery", category: "Cataract" },
  { name: "Knee Replacement", category: "Knee" },
  { name: "Knee Arthroscopy", category: "Knee" },
  { name: "Inguinal Hernia Repair", category: "Hernia" },
  { name: "Umbilical Hernia Repair", category: "Hernia" },
  { name: "Hip Replacement", category: "Hip" },
  { name: "Appendectomy (Laparoscopic)", category: "Appendectomy" },
  { name: "Cardiac Bypass (CABG)", category: "Heart" },
  { name: "Angioplasty", category: "Heart" },
  { name: "Spine Fusion Surgery", category: "Neuro" },
  { name: "Brain Tumour Removal", category: "Neuro" },
  { name: "Gallbladder Removal (Laparoscopic)", category: "General" },
  { name: "Kidney Stone Removal", category: "General" },
  { name: "Hysterectomy", category: "General" },
];

// Local, branded illustrations (apps/web/public/illustrations) — no external
// image host in the loop, so nothing can break mid-demo on a flaky network.
const HOSPITAL_PHOTOS = [
  "/illustrations/hospital-1.svg",
  "/illustrations/hospital-2.svg",
  "/illustrations/hospital-3.svg",
  "/illustrations/hospital-4.svg",
];

const DOCTOR_NAMES = ["Anita Rao", "Vikram Shetty", "Fatima Sheikh", "Sanjay Iyer", "Priya Nair", "Arjun Menon", "Kavya Reddy", "Rohan Kulkarni"];

const REVIEW_COMMENTS = [
  "Transparent pricing and a fast callback from the doctor — knew the final cost before I even visited.",
  "The doctor called within 20 minutes of my enquiry and answered every question patiently.",
  "Compared three hospitals here and the cost difference was huge. Glad I checked first.",
  "Clean facility, good staff, and the second opinion saved me from an unnecessary surgery.",
  "Straightforward process from search to callback. Would recommend to family.",
];

// `categories` decides which treatments each hospital actually prices. Real
// hospitals specialise, and if every hospital offered every category the
// discovery filters would never narrow the result set — which reads as broken.
const HOSPITALS = [
  { name: "Sunrise Multispeciality Hospital", slug: "sunrise-multispeciality-hospital", city: "Bengaluru", status: "APPROVED" as const, specialities: ["Orthopaedics", "Cardiology", "General Surgery"], categories: ["Knee", "Hip", "Heart", "General", "Appendectomy", "Hernia"] },
  { name: "Lotus Heart & Bone Institute", slug: "lotus-heart-and-bone-institute", city: "Bengaluru", status: "APPROVED" as const, specialities: ["Cardiology", "Orthopaedics"], categories: ["Heart", "Knee", "Hip"] },
  { name: "Nandi Hills Care Hospital", slug: "nandi-hills-care-hospital", city: "Mysuru", status: "APPROVED" as const, specialities: ["General Surgery", "Urology", "Ophthalmology"], categories: ["General", "Appendectomy", "Hernia", "Cataract"] },
  { name: "Cauvery Eye & General Hospital", slug: "cauvery-eye-and-general-hospital", city: "Mysuru", status: "APPROVED" as const, specialities: ["Ophthalmology", "General Surgery"], categories: ["Cataract", "General", "Hernia"] },
  { name: "Malabar Neuro & Spine Centre", slug: "malabar-neuro-and-spine-centre", city: "Mangaluru", status: "APPROVED" as const, specialities: ["Neurology", "Orthopaedics"], categories: ["Neuro", "Knee", "Hip"] },
  { name: "Deccan Multispeciality Hospital", slug: "deccan-multispeciality-hospital", city: "Hubballi", status: "APPROVED" as const, specialities: ["General Surgery", "Cardiology", "Urology"], categories: ["General", "Appendectomy", "Hernia", "Heart"] },
  { name: "Kaveri Women's & Children's Hospital", slug: "kaveri-womens-and-childrens-hospital", city: "Bengaluru", status: "APPROVED" as const, specialities: ["General Surgery", "Ophthalmology"], categories: ["General", "Appendectomy", "Cataract"] },
  { name: "Vidyaranya General Hospital", slug: "vidyaranya-general-hospital", city: "Hubballi", status: "PENDING" as const, specialities: ["General Surgery"], categories: ["General", "Hernia"] },
  { name: "Malnad Community Hospital", slug: "malnad-community-hospital", city: "Shivamogga", status: "IN_REVIEW" as const, specialities: ["General Surgery", "Ophthalmology"], categories: ["General", "Cataract"] },
];

const PATIENTS = [
  { firebaseUid: "dev-patient-1", name: "Ramesh Kumar",   phone: "+919911122233", email: "ramesh@example.com",        city: "Bengaluru" },
  { firebaseUid: "dev-patient-2", name: "Sunita Verma",   phone: "+919911122234", email: "sunita@example.com",        city: "Mysuru" },
  { firebaseUid: "dev-patient-3", name: "Arjun Nair",     phone: "+919911122235", email: "arjun.nair@example.com",    city: "Mangaluru" },
  { firebaseUid: "dev-patient-4", name: "Kavya Iyer",     phone: "+919911122236", email: "kavya.iyer@example.com",    city: "Bengaluru" },
  { firebaseUid: "dev-patient-5", name: "Rohit Sharma",   phone: "+919911122237", email: "rohit.sharma@example.com",  city: "Hubballi" },
  { firebaseUid: "dev-patient-6", name: "Priya Menon",    phone: "+919911122238", email: "priya.menon@example.com",   city: "Bengaluru" },
  { firebaseUid: "dev-patient-7", name: "Suresh Pillai",  phone: "+919911122239", email: "suresh.pillai@example.com", city: "Mysuru" },
];

// One full pass of the BKG-06 lifecycle plus its side-states, so every
// dashboard (hospital / doctor / patient / admin) has something of every
// kind to show without needing to click through the flow first.
const STATUS_CYCLE: EnquiryStatus[] = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "CONTACTED", "GUIDED", "CLOSED", "NO_RESPONSE", "CANCELLED"];

const CONDITIONS = [
  "Persistent joint pain, difficulty walking for 6 months.",
  "Recommended for surgery by local doctor, want a second opinion first.",
  "Blurred vision worsening over the last year.",
  "Recurring abdominal pain, suspected hernia.",
  "Chest discomfort on exertion, cardiologist recommended evaluation.",
  "Follow-up required after diagnostic scan flagged an issue.",
];

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

async function main() {
  console.log("Seeding treatment catalogue...");
  const treatments = await Promise.all(
    TREATMENTS.map((t) => prisma.treatment.upsert({ where: { name: t.name }, update: {}, create: t })),
  );

  console.log("Seeding hospitals, staff, doctors and price lists...");
  const seededUsers: { role: string; name: string; id: string }[] = [];
  const hospitalDoctorIds = new Map<string, string[]>();
  let doctorNameIdx = 0;

  for (const [i, h] of HOSPITALS.entries()) {
    const hospital = await prisma.hospital.upsert({
      where: { slug: h.slug },
      update: {},
      create: {
        name: h.name,
        slug: h.slug,
        status: h.status,
        city: h.city,
        address: `${100 + i * 7} MG Road, ${h.city}`,
        latitude: 12.9716 + i * 0.35 - 1,
        longitude: 77.5946 + i * 0.3 - 1,
        specialities: h.specialities,
        facilities: ["24x7 Emergency", "ICU", "Pharmacy", "Diagnostic Lab", "Ambulance Service"],
        accreditations: h.status === "APPROVED" ? ["NABH Accredited"] : [],
        photos: h.status === "APPROVED" ? [HOSPITAL_PHOTOS[i % HOSPITAL_PHOTOS.length]] : [],
        contactPersonName: "Front Desk",
        contactPersonPhone: "+919900000000",
        contactPersonEmail: `contact@${h.slug}.example`,
        description: `${h.name} is a full-service hospital in ${h.city} offering ${h.specialities.join(", ")}, with a focus on transparent, indicative pricing and a fast doctor callback for every enquiry.`,
      },
    });

    const priced = treatments.filter((t) => h.categories.includes(t.category));
    for (const t of priced) {
      await prisma.hospitalTreatmentPrice.upsert({
        where: { hospitalId_treatmentId: { hospitalId: hospital.id, treatmentId: t.id } },
        update: {},
        create: {
          hospitalId: hospital.id,
          treatmentId: t.id,
          indicativePrice: 60000 + Math.round(Math.random() * 450000),
          currency: "INR",
          notes: "Indicative — final cost confirmed by the hospital.",
        },
      });
    }

    if (h.status === "APPROVED") {
      const adminUser = await prisma.user.upsert({
        where: { firebaseUid: `dev-hospital-admin-${h.slug}` },
        update: {},
        create: { firebaseUid: `dev-hospital-admin-${h.slug}`, role: "HOSPITAL_ADMIN", name: `${h.name} Admin`, email: `admin@${h.slug}.example`, hospitalId: hospital.id },
      });
      seededUsers.push({ role: "HOSPITAL_ADMIN", name: adminUser.name, id: adminUser.id });

      const doctorIds: string[] = [];
      for (let d = 0; d < 2; d++) {
        const doctorName = DOCTOR_NAMES[doctorNameIdx % DOCTOR_NAMES.length];
        doctorNameIdx++;
        const doctorUser = await prisma.user.upsert({
          where: { firebaseUid: `dev-doctor-${h.slug}-${d}` },
          update: {},
          create: {
            firebaseUid: `dev-doctor-${h.slug}-${d}`,
            role: "DOCTOR",
            name: `Dr. ${doctorName}`,
            email: `dr.${doctorName.split(" ")[1].toLowerCase()}@${h.slug}.example`,
            hospitalId: hospital.id,
          },
        });
        const doctor = await prisma.doctor.upsert({
          where: { userId: doctorUser.id },
          update: {},
          create: {
            userId: doctorUser.id,
            hospitalId: hospital.id,
            specialisation: h.specialities[d % h.specialities.length],
            qualifications: d === 0 ? "MBBS, MS" : "MBBS, MD, DM",
            experienceYears: 6 + i + d * 3,
            bio: "Experienced consultant focused on patient-guided treatment decisions.",
          },
        });
        doctorIds.push(doctor.id);
        if (d === 0) seededUsers.push({ role: "DOCTOR", name: doctorUser.name, id: doctorUser.id });
      }
      hospitalDoctorIds.set(hospital.id, doctorIds);

      const reviewCount = 2 + (i % 2);
      for (let r = 0; r < reviewCount; r++) {
        await prisma.review.create({
          data: { hospitalId: hospital.id, rating: 4 + ((i + r) % 2), comment: REVIEW_COMMENTS[(i + r) % REVIEW_COMMENTS.length], seeded: true },
        });
      }
    }
  }

  console.log("Seeding platform staff (verification, support, super admin)...");
  const platformStaff: { role: "VERIFICATION" | "SUPPORT" | "SUPER_ADMIN"; name: string }[] = [
    { role: "VERIFICATION", name: "Verification Team" },
    { role: "SUPPORT", name: "Support Team" },
    { role: "SUPER_ADMIN", name: "Super Admin" },
  ];
  const staffUsers: Record<string, string> = {};
  for (const staff of platformStaff) {
    const user = await prisma.user.upsert({
      where: { firebaseUid: `dev-${staff.role.toLowerCase()}` },
      update: {},
      create: { firebaseUid: `dev-${staff.role.toLowerCase()}`, role: staff.role, name: staff.name, email: `${staff.role.toLowerCase()}@connecthospital.in.example` },
    });
    seededUsers.push({ role: staff.role, name: user.name, id: user.id });
    staffUsers[staff.role] = user.id;
  }

  console.log("Seeding demo patients...");
  const patientUsers: { id: string; name: string }[] = [];
  for (const p of PATIENTS) {
    const patientUser = await prisma.user.upsert({
      where: { firebaseUid: p.firebaseUid },
      update: {},
      create: { firebaseUid: p.firebaseUid, role: "PATIENT", name: p.name, phone: p.phone, email: p.email },
    });
    await prisma.patient.upsert({ where: { userId: patientUser.id }, update: {}, create: { userId: patientUser.id, city: p.city } });
    seededUsers.push({ role: "PATIENT", name: patientUser.name, id: patientUser.id });
    patientUsers.push({ id: patientUser.id, name: patientUser.name });
  }

  console.log("Seeding enquiries across every status (so every dashboard is already populated)...");
  const approvedHospitals = await prisma.hospital.findMany({ where: { status: "APPROVED" } });
  let enquiryCounter = 0;

  for (const [hIdx, hospital] of approvedHospitals.entries()) {
    const doctorIds = hospitalDoctorIds.get(hospital.id) ?? [];
    const enquiriesForHospital = 3 + (hIdx % 2); // 3-4 per hospital

    // Only raise enquiries for treatments this hospital actually offers.
    const offeredCategories = HOSPITALS.find((h) => h.slug === hospital.slug)?.categories ?? [];
    const offeredTreatments = treatments.filter((t) => offeredCategories.includes(t.category));

    for (let e = 0; e < enquiriesForHospital; e++) {
      const status = pick(STATUS_CYCLE, hIdx + e);
      const patient = pick(patientUsers, enquiryCounter);
      const treatment = pick(offeredTreatments.length ? offeredTreatments : treatments, hIdx + e);
      const intent: EnquiryIntent = e % 3 === 0 ? "SECOND_OPINION" : "SURGERY";
      const needsDoctor = !["NEW", "ACKNOWLEDGED", "CANCELLED"].includes(status) && doctorIds.length > 0;
      const assignedDoctorId = needsDoctor ? pick(doctorIds, e) : null;

      let callbackOutcome: CallbackOutcome | null = null;
      let callbackNotes: string | null = null;
      if (["CONTACTED", "GUIDED", "CLOSED"].includes(status)) {
        callbackOutcome = "REACHED";
        callbackNotes = "Discussed the procedure, cost and recovery timeline. Patient will confirm dates shortly.";
      } else if (status === "NO_RESPONSE") {
        callbackOutcome = "NOT_REACHED";
        callbackNotes = "Attempted twice, no response — follow-up scheduled.";
      }

      const existing = await prisma.enquiry.findFirst({ where: { patientId: patient.id, hospitalId: hospital.id, treatmentId: treatment.id } });
      if (existing) continue;

      const enquiry = await prisma.enquiry.create({
        data: {
          patientId: patient.id,
          hospitalId: hospital.id,
          intent,
          treatmentId: treatment.id,
          condition: pick(CONDITIONS, enquiryCounter),
          preferredCallbackWindow: enquiryCounter % 2 === 0 ? "Weekdays, 10am - 1pm" : "Evenings after 6pm",
          status,
          assignedDoctorId,
          callbackOutcome,
          callbackNotes,
          createdAt: new Date(Date.now() - (enquiryCounter + 1) * 6 * 60 * 60 * 1000),
        },
      });
      await prisma.enquiryStatusHistory.create({
        data: { enquiryId: enquiry.id, toStatus: "NEW", note: "Enquiry submitted by patient." },
      });
      if (status !== "NEW") {
        const hospitalAdminId = (await prisma.user.findFirst({ where: { hospitalId: hospital.id, role: "HOSPITAL_ADMIN" } }))?.id ?? null;
        await prisma.enquiryStatusHistory.create({
          data: { enquiryId: enquiry.id, fromStatus: "NEW", toStatus: status, actorId: hospitalAdminId, note: `Seeded at ${status}.` },
        });
        await prisma.auditLog.create({
          data: {
            actorId: hospitalAdminId,
            action: status === "ASSIGNED" || status === "CONTACTED" || status === "GUIDED" || status === "CLOSED" ? "ENQUIRY_ASSIGNED" : "ENQUIRY_ACKNOWLEDGED",
            entityType: "Enquiry",
            entityId: enquiry.id,
            before: { status: "NEW" },
            after: { status },
          },
        });
        if (assignedDoctorId && callbackOutcome) {
          await prisma.auditLog.create({
            data: {
              actorId: (await prisma.doctor.findUnique({ where: { id: assignedDoctorId } }))?.userId,
              action: "CALLBACK_LOGGED",
              entityType: "Enquiry",
              entityId: enquiry.id,
              before: { status: "ASSIGNED" },
              after: { status, outcome: callbackOutcome },
            },
          });
        }
      }
      enquiryCounter++;
    }
  }

  console.log("Seeding field executives...");
  const firstApprovedHospital = approvedHospitals[0];

  const feHospitalUser = await prisma.user.upsert({
    where: { firebaseUid: "dev-fe-hospital-1" },
    update: {},
    create: {
      firebaseUid: "dev-fe-hospital-1",
      role: "FIELD_EXECUTIVE_HOSPITAL",
      name: "Meera Pillai (FE-Hospital)",
      email: "meera.fe@connecthospital.in.example",
      phone: "+919988776601",
      hospitalId: firstApprovedHospital?.id ?? null,
    },
  });
  await prisma.fieldExecutive.upsert({
    where: { userId: feHospitalUser.id },
    update: {},
    create: {
      userId: feHospitalUser.id,
      feType: "HOSPITAL",
      hospitalId: firstApprovedHospital?.id ?? null,
      status: "ACTIVE",
      kycVerified: true,
    },
  });
  seededUsers.push({ role: "FIELD_EXECUTIVE_HOSPITAL", name: feHospitalUser.name, id: feHospitalUser.id });

  const feConnectUser = await prisma.user.upsert({
    where: { firebaseUid: "dev-fe-connect-1" },
    update: {},
    create: {
      firebaseUid: "dev-fe-connect-1",
      role: "FIELD_EXECUTIVE_CONNECT",
      name: "Rajan Das (FE-Connect)",
      email: "rajan.fe@connecthospital.in.example",
      phone: "+919988776602",
    },
  });
  const feConnectProfile = await prisma.fieldExecutive.upsert({
    where: { userId: feConnectUser.id },
    update: {},
    create: {
      userId: feConnectUser.id,
      feType: "CONNECT_HOSPITAL",
      status: "ACTIVE",
      kycVerified: true,
    },
  });
  seededUsers.push({ role: "FIELD_EXECUTIVE_CONNECT", name: feConnectUser.name, id: feConnectUser.id });

  const feManagerUser = await prisma.user.upsert({
    where: { firebaseUid: "dev-fe-manager-1" },
    update: {},
    create: {
      firebaseUid: "dev-fe-manager-1",
      role: "FE_MANAGER",
      name: "Kavitha Srinivas (FE Manager)",
      email: "kavitha.mgr@connecthospital.in.example",
      phone: "+919988776603",
    },
  });
  await prisma.fieldExecutive.upsert({
    where: { userId: feManagerUser.id },
    update: {},
    create: {
      userId: feManagerUser.id,
      feType: "CONNECT_HOSPITAL",
      status: "ACTIVE",
      kycVerified: true,
    },
  });
  seededUsers.push({ role: "FE_MANAGER", name: feManagerUser.name, id: feManagerUser.id });

  // Seed rich FE queue data so both the dashboard stats and activity feed are populated.
  const allEnquiries = await prisma.enquiry.findMany({
    where: { feQueueId: null },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { patient: { select: { name: true } }, hospital: { select: { name: true } } },
  });

  type QueueSpec = {
    feId: string;
    followUpStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ESCALATED";
    admissionRef?: string;
    daysAgo: number;
    logs: { actionType: "PHONE_CALL" | "PHYSICAL_VISIT" | "DOCUMENT_COLLECTED" | "ADMISSION_CONFIRMED" | "OTHER"; notes: string; daysAgo: number }[];
  };

  const QUEUE_SPECS: QueueSpec[] = [
    {
      feId: feConnectProfile.id,
      followUpStatus: "IN_PROGRESS",
      daysAgo: 5,
      logs: [
        { actionType: "PHONE_CALL",          notes: "Called patient — confirmed interest in Knee Replacement. Requested medical records.",      daysAgo: 5 },
        { actionType: "DOCUMENT_COLLECTED",  notes: "Collected X-ray reports and referral letter from patient's home.",                         daysAgo: 3 },
        { actionType: "PHONE_CALL",          notes: "Followed up on admission date. Patient awaiting family confirmation.",                     daysAgo: 1 },
      ],
    },
    {
      feId: feConnectProfile.id,
      followUpStatus: "COMPLETED",
      admissionRef: "ADM-2024-0041",
      daysAgo: 8,
      logs: [
        { actionType: "PHONE_CALL",          notes: "Initial call — patient confirmed surgery date available next week.",                        daysAgo: 8 },
        { actionType: "PHYSICAL_VISIT",      notes: "Visited patient at home, explained hospital admission process end-to-end.",                daysAgo: 6 },
        { actionType: "DOCUMENT_COLLECTED",  notes: "Collected Aadhaar, insurance card, and previous prescription.",                           daysAgo: 5 },
        { actionType: "ADMISSION_CONFIRMED", notes: "Admission confirmed at Sunrise Hospital. Ref ADM-2024-0041.",                             daysAgo: 4 },
      ],
    },
    {
      feId: feConnectProfile.id,
      followUpStatus: "ESCALATED",
      daysAgo: 3,
      logs: [
        { actionType: "PHONE_CALL",          notes: "Called twice — no response. Sent WhatsApp message.",                                      daysAgo: 3 },
        { actionType: "PHONE_CALL",          notes: "Third attempt — patient picked up but disconnected after 10 seconds.",                    daysAgo: 2 },
        { actionType: "OTHER",               notes: "Escalated to FE Manager — patient unreachable for 3 days.",                              daysAgo: 1 },
      ],
    },
    {
      feId: feConnectProfile.id,
      followUpStatus: "NOT_STARTED",
      daysAgo: 1,
      logs: [],
    },
    {
      feId: feConnectProfile.id,
      followUpStatus: "IN_PROGRESS",
      daysAgo: 2,
      logs: [
        { actionType: "PHONE_CALL",          notes: "First contact made. Patient asked for a callback tomorrow morning.",                      daysAgo: 2 },
      ],
    },
    {
      feId: feHospitalUser.id,  // will resolve to feHospitalProfile below
      followUpStatus: "IN_PROGRESS",
      daysAgo: 4,
      logs: [
        { actionType: "PHYSICAL_VISIT",      notes: "Met patient at hospital OPD. Guided through admission paperwork.",                        daysAgo: 4 },
        { actionType: "DOCUMENT_COLLECTED",  notes: "Received all mandatory documents. Submitted to admission desk.",                          daysAgo: 2 },
      ],
    },
    {
      feId: feHospitalUser.id,
      followUpStatus: "COMPLETED",
      admissionRef: "ADM-2024-0055",
      daysAgo: 7,
      logs: [
        { actionType: "PHONE_CALL",          notes: "Introduced self and explained next steps for the surgery booking.",                       daysAgo: 7 },
        { actionType: "DOCUMENT_COLLECTED",  notes: "Docs collected — ID, referral letter, past lab reports.",                                daysAgo: 6 },
        { actionType: "ADMISSION_CONFIRMED", notes: "Patient admitted successfully. Ref ADM-2024-0055.",                                      daysAgo: 5 },
      ],
    },
    {
      feId: feHospitalUser.id,
      followUpStatus: "NOT_STARTED",
      daysAgo: 0,
      logs: [],
    },
  ];

  // Get the FieldExecutive profile id for the hospital FE (we only have userId above)
  const feHospitalProfile = await prisma.fieldExecutive.findUnique({ where: { userId: feHospitalUser.id } });

  for (let i = 0; i < QUEUE_SPECS.length; i++) {
    const spec = QUEUE_SPECS[i];
    const enquiry = allEnquiries[i];
    if (!enquiry) continue;
    if (enquiry.feQueueId) continue;

    // Resolve the actual FieldExecutive profile id
    const actualFeId = spec.feId === feHospitalUser.id ? feHospitalProfile?.id : feConnectProfile.id;
    if (!actualFeId) continue;

    const queue = await prisma.feBookingQueue.create({
      data: {
        feId: actualFeId,
        assignedAt: new Date(Date.now() - spec.daysAgo * 24 * 60 * 60 * 1000),
        followUpStatus: spec.followUpStatus,
        admissionRef: spec.admissionRef ?? null,
      },
    });
    await prisma.enquiry.update({ where: { id: enquiry.id }, data: { feQueueId: queue.id } });

    for (const log of spec.logs) {
      await prisma.feFollowUpLog.create({
        data: {
          feQueueId: queue.id,
          feId: actualFeId,
          actionType: log.actionType,
          notes: log.notes,
          followUpDate: new Date(Date.now() - (log.daysAgo - 1) * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - log.daysAgo * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log("Seeding extra hospital enquiries for Sunrise (boosts hospital dashboard)...");
  const sunriseHospital = await prisma.hospital.findUnique({ where: { slug: "sunrise-multispeciality-hospital" } });
  const sunriseDoctors = sunriseHospital
    ? await prisma.doctor.findMany({ where: { hospitalId: sunriseHospital.id } })
    : [];
  const sunriseTreatments = sunriseHospital
    ? await prisma.hospitalTreatmentPrice.findMany({ where: { hospitalId: sunriseHospital.id }, include: { treatment: true } })
    : [];

  const EXTRA_ENQUIRY_STATUSES: EnquiryStatus[] = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "CONTACTED", "GUIDED", "CLOSED", "CANCELLED", "NO_RESPONSE", "REOPENED"];
  const EXTRA_CONDITIONS = [
    "Severe knee pain after sports injury, MRI suggests meniscus tear.",
    "Cardiologist recommended bypass evaluation — second opinion needed.",
    "Post-surgery follow-up for hernia repair done elsewhere.",
    "Recurring back pain, physiotherapy not helping. Considering surgery.",
    "Hip arthritis — difficulty walking more than 200 m. Family referred this hospital.",
    "Pre-diabetic with cardiac symptoms. Needs comprehensive evaluation.",
    "Appendix pain diagnosed, surgeon recommended laparoscopic removal.",
    "Looking for cost comparison for knee replacement across Bengaluru hospitals.",
  ];

  if (sunriseHospital && patientUsers.length > 0) {
    for (let i = 0; i < 8; i++) {
      const patient = pick(patientUsers, i + 10);
      const tp = pick(sunriseTreatments, i);
      const status = pick(EXTRA_ENQUIRY_STATUSES, i);
      const intent: EnquiryIntent = i % 3 === 0 ? "SECOND_OPINION" : "SURGERY";
      const needsDoctor = !["NEW", "ACKNOWLEDGED", "CANCELLED"].includes(status) && sunriseDoctors.length > 0;
      const doctor = needsDoctor ? pick(sunriseDoctors, i) : null;

      const alreadyExists = await prisma.enquiry.findFirst({
        where: { patientId: patient.id, hospitalId: sunriseHospital.id, treatmentId: tp.treatmentId, intent },
      });
      if (alreadyExists) continue;

      let callbackOutcome: CallbackOutcome | null = null;
      let callbackNotes: string | null = null;
      if (["CONTACTED", "GUIDED", "CLOSED"].includes(status)) {
        callbackOutcome = "REACHED";
        callbackNotes = "Patient spoke with Dr. Anita Rao. Procedure cost and recovery time explained in detail.";
      } else if (status === "NO_RESPONSE") {
        callbackOutcome = "NOT_REACHED";
        callbackNotes = "Called three times over two days — no response. WhatsApp sent.";
      }

      await prisma.enquiry.create({
        data: {
          patientId: patient.id,
          hospitalId: sunriseHospital.id,
          treatmentId: tp.treatmentId,
          intent,
          condition: pick(EXTRA_CONDITIONS, i),
          preferredCallbackWindow: i % 2 === 0 ? "Mornings 9am-12pm" : "Evenings 5pm-8pm",
          status,
          assignedDoctorId: doctor?.id ?? null,
          callbackOutcome,
          callbackNotes,
          createdAt: new Date(Date.now() - (i + 1) * 18 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log("Seeding FE Manager view data (unassigned queue entries + cross-FE audit)...");
  // Create 3 unassigned queue entries — manager's job is to assign these.
  const unassignedEnquiries = await prisma.enquiry.findMany({
    where: { feQueueId: null, status: { in: ["GUIDED", "CLOSED"] } },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  for (const enquiry of unassignedEnquiries) {
    const queue = await prisma.feBookingQueue.create({
      data: { feId: null, followUpStatus: "NOT_STARTED" },
    });
    await prisma.enquiry.update({ where: { id: enquiry.id }, data: { feQueueId: queue.id } });
  }

  // Add audit logs so the manager's admin overview reflects activity.
  const feManagerProfile = await prisma.fieldExecutive.findUnique({ where: { userId: feManagerUser.id } });
  if (feManagerProfile && feConnectProfile) {
    const allQueues = await prisma.feBookingQueue.findMany({ where: { feId: feConnectProfile.id }, take: 2 });
    for (const q of allQueues) {
      await prisma.auditLog.create({
        data: {
          actorId: feManagerUser.id,
          action: "FE_ASSIGNED",
          entityType: "FeBookingQueue",
          entityId: q.id,
          before: { feId: null },
          after: { feId: feConnectProfile.id },
        },
      });
    }
  }

  // Seed extra doctors for Sunrise so hospital dashboard "Doctors" stat is richer.
  const EXTRA_DOCTOR_NAMES = ["Suresh Babu", "Lakshmi Devi", "Harish Patel"];
  if (sunriseHospital) {
    for (const [i, dName] of EXTRA_DOCTOR_NAMES.entries()) {
      const uid = `dev-doctor-sunrise-extra-${i}`;
      const existing = await prisma.user.findUnique({ where: { firebaseUid: uid } });
      if (existing) continue;
      const du = await prisma.user.create({
        data: {
          firebaseUid: uid,
          role: "DOCTOR",
          name: `Dr. ${dName}`,
          email: `dr.${dName.split(" ")[0].toLowerCase()}@sunrise-multispeciality-hospital.example`,
          hospitalId: sunriseHospital.id,
        },
      });
      await prisma.doctor.create({
        data: {
          userId: du.id,
          hospitalId: sunriseHospital.id,
          specialisation: pick(["Orthopaedics", "Cardiology", "General Surgery"], i),
          qualifications: "MBBS, MS, DNB",
          experienceYears: 8 + i * 2,
          bio: "Senior consultant with expertise in complex surgical cases and minimally invasive techniques.",
        },
      });
    }
  }

  // Seed notification records for hospital enquiries (so notification log isn't empty).
  const recentEnquiries = await prisma.enquiry.findMany({
    where: { hospitalId: sunriseHospital?.id },
    take: 5,
    include: { patient: { select: { phone: true, email: true } } },
  });
  for (const [i, enq] of recentEnquiries.entries()) {
    const notifExists = await prisma.notification.findFirst({ where: { enquiryId: enq.id } });
    if (notifExists) continue;
    await prisma.notification.create({
      data: {
        enquiryId: enq.id,
        recipient: enq.patient.phone ?? enq.patient.email ?? "unknown",
        channel: i % 2 === 0 ? "SMS" : "WHATSAPP",
        template: "enquiry_received",
        status: i === 0 ? "QUEUED" : "DELIVERED",
        providerRef: i > 0 ? `msg91-${Date.now()}-${i}` : null,
        sentAt: i > 0 ? new Date(Date.now() - i * 60 * 60 * 1000) : null,
      },
    });
  }

  console.log("Seeding support tickets...");
  const ticketPatient = patientUsers[0];
  const ticketPatient2 = patientUsers[1];
  const sampleEnquiry = await prisma.enquiry.findFirst({ where: { hospitalId: approvedHospitals[0]?.id } });
  const supportUserId = staffUsers.SUPPORT;
  const firstHospitalAdmin = await prisma.user.findFirst({ where: { hospitalId: approvedHospitals[0]?.id, role: "HOSPITAL_ADMIN" } });

  const TICKETS: { raisedById: string; subject: string; status: string; assigned?: boolean }[] = [
    { raisedById: ticketPatient.id, subject: "Didn't receive SMS confirmation after booking", status: "OPEN" },
    { raisedById: ticketPatient2.id, subject: "Hospital hasn't called back after 2 days", status: "IN_PROGRESS", assigned: true },
    { raisedById: firstHospitalAdmin?.id ?? ticketPatient.id, subject: "Need help updating our price list", status: "ESCALATED", assigned: true },
    { raisedById: patientUsers[2].id, subject: "Requesting my enquiry be re-opened", status: "RESOLVED", assigned: true },
  ];
  for (const t of TICKETS) {
    const exists = await prisma.supportTicket.findFirst({ where: { raisedById: t.raisedById, subject: t.subject } });
    if (exists) continue;
    const ticket = await prisma.supportTicket.create({
      data: {
        raisedById: t.raisedById,
        subject: t.subject,
        status: t.status,
        assignedToId: t.assigned ? supportUserId : null,
        enquiryId: sampleEnquiry?.id,
        notes: t.status === "RESOLVED" ? "Confirmed with the patient and closed the loop." : null,
      },
    });
    if (t.status !== "OPEN") {
      await prisma.auditLog.create({
        data: {
          actorId: t.assigned ? supportUserId : null,
          action: "SUPPORT_TICKET_UPDATED",
          entityType: "SupportTicket",
          entityId: ticket.id,
          before: { status: "OPEN" },
          after: { status: t.status },
        },
      });
    }
  }

  console.log("Seeding demo payment records (so patient payment history is not empty)...");
  // Pick the first 3 patients and link a payment to one of their enquiries.
  const PAYMENT_SEED = [
    { status: "VERIFIED" as const,         amount: 5000,  gatewayPaymentId: "pay_demo_001" },
    { status: "REFUND_INITIATED" as const,  amount: 3000,  gatewayPaymentId: "pay_demo_002" },
    { status: "PENDING" as const,           amount: 7500,  gatewayPaymentId: null },
  ];
  for (let pi = 0; pi < Math.min(patientUsers.length, PAYMENT_SEED.length); pi++) {
    const spec = PAYMENT_SEED[pi];
    const patient = patientUsers[pi];
    // Find an enquiry for this patient that has no payment yet.
    const enquiry = await prisma.enquiry.findFirst({
      where: { patientId: patient.id, paymentId: null },
    });
    if (!enquiry) continue;

    const existingPay = await prisma.payment.findFirst({ where: { gatewayOrderId: `order_demo_${pi + 1}` } });
    if (existingPay) continue;

    const payment = await prisma.payment.create({
      data: {
        amount: spec.amount,
        currency: "INR",
        gateway: "razorpay",
        gatewayOrderId: `order_demo_${pi + 1}`,
        gatewayPaymentId: spec.gatewayPaymentId,
        status: spec.status,
        verifiedAt: spec.status === "VERIFIED" || spec.status === "REFUND_INITIATED" ? new Date(Date.now() - pi * 24 * 60 * 60 * 1000) : null,
      },
    });
    await prisma.enquiry.update({ where: { id: enquiry.id }, data: { paymentId: payment.id } });

    // Add a refund row for the REFUND_INITIATED payment.
    if (spec.status === "REFUND_INITIATED") {
      await prisma.paymentRefund.create({
        data: {
          paymentId: payment.id,
          amount: spec.amount,
          reason: "Patient cancelled before admission",
          refundType: "PATIENT_CANCEL",
          status: "INITIATED",
          initiatedById: staffUsers["SUPER_ADMIN"],
        },
      });
    }
  }

  console.log("\nSeeded dev users (use as `x-dev-user` header value, or the frontend's dev login switcher):\n");
  console.table(seededUsers);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
