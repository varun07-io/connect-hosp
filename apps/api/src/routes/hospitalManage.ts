import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { recordAudit } from "../lib/audit.js";
import { getNotificationProvider } from "../lib/notifications/index.js";
import { paymentsEnabled } from "../lib/features.js";

const phone = z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number");
const tags = z.array(z.string().trim().min(1).max(60)).max(30);

/** VER-01 — public self-registration. Lands in the verification queue as PENDING. */
const registerSchema = z.object({
  name: z.string().trim().min(3).max(160),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(300),
  description: z.string().trim().max(4000).optional(),
  specialities: tags.min(1, "Pick at least one speciality"),
  contactPersonName: z.string().trim().min(2).max(120),
  contactPersonPhone: phone,
  contactPersonEmail: z.string().trim().email(),
  /** Honeypot — real users never see or fill this field. */
  website: z.string().max(0).optional(),
});

/** HSP-02 — profile + payment configuration a hospital admin may edit.
 *  Accreditations and verification status are deliberately not editable here. */
const profileSchema = z
  .object({
    description: z.string().trim().max(4000).nullable(),
    address: z.string().trim().min(5).max(300),
    specialities: tags,
    facilities: tags,
    contactPersonName: z.string().trim().min(2).max(120),
    contactPersonPhone: phone,
    contactPersonEmail: z.string().trim().email(),
    depositRequired: z.boolean(),
    depositAmountSurgery: z.number().int().min(0).max(100_000),
    depositAmountSecondOpinion: z.number().int().min(0).max(100_000),
    slaCallbackHours: z.number().int().min(4).max(72),
  })
  .partial()
  .refine(
    (v) => !v.depositRequired || (v.depositAmountSurgery ?? 1) > 0 || (v.depositAmountSecondOpinion ?? 1) > 0,
    { message: "Set a deposit amount, or turn deposits off" },
  );

const priceSchema = z.object({
  indicativePrice: z.number().positive(),
  notes: z.string().trim().max(300).optional(),
});

const doctorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  specialisation: z.string().trim().min(2).max(120),
  qualifications: z.string().trim().min(2).max(200),
  experienceYears: z.number().int().min(0).max(70),
  bio: z.string().trim().max(1000).optional(),
});
const doctorUpdateSchema = doctorSchema.omit({ name: true, email: true }).partial();

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default async function hospitalManageRoutes(app: FastifyInstance) {
  /** Resolve the admin's hospital id or reply 409 — shared by every HSP route. */
  function scopedHospitalId(request: FastifyRequest, reply: FastifyReply): string | null {
    const hospitalId = request.authUser!.hospitalId;
    if (!hospitalId) {
      reply.code(409).send({ error: "This account is not linked to a hospital" });
      return null;
    }
    app.assertHospitalScope(request, hospitalId);
    return hospitalId;
  }

  // ── Public registration ────────────────────────────────────────────────
  app.post("/api/hospitals/register", async (request, reply) => {
    // Bots that fill the hidden field get a convincing success and nothing is stored,
    // so they learn nothing about why.
    const honeypot = (request.body as { website?: unknown } | null)?.website;
    if (typeof honeypot === "string" && honeypot.length > 0) {
      return reply.code(201).send({ reference: Math.random().toString(36).slice(2, 10).toUpperCase(), name: "" });
    }
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { website: _honeypot, ...data } = parsed.data;

    const duplicate = await app.prisma.hospital.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" }, city: { equals: data.city, mode: "insensitive" } },
    });
    if (duplicate) {
      return reply.code(409).send({ error: "A hospital with this name is already registered in this city. Contact support if this is yours." });
    }

    // Unique slug; "register"-style reserved words can't shadow app routes.
    const base = slugify(`${data.name} ${data.city}`) || "hospital";
    let slug = base;
    for (let n = 2; await app.prisma.hospital.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;

    const hospital = await app.prisma.hospital.create({
      data: { ...data, contactPersonEmail: data.contactPersonEmail.toLowerCase(), slug, status: "PENDING" },
    });

    await recordAudit(app.prisma, {
      actorId: null,
      action: "HOSPITAL_SELF_REGISTERED",
      entityType: "Hospital",
      entityId: hospital.id,
      after: { name: hospital.name, city: hospital.city, contact: hospital.contactPersonEmail },
    });

    try {
      const result = await getNotificationProvider().send({
        channel: "EMAIL",
        recipient: hospital.contactPersonEmail,
        template: "hospital_registration_received",
        data: { hospitalName: hospital.name },
      });
      await app.prisma.notification.create({
        data: {
          recipient: hospital.contactPersonEmail,
          channel: "EMAIL",
          template: "hospital_registration_received",
          status: result.status,
          providerRef: result.providerRef,
          sentAt: result.status === "SENT" ? new Date() : null,
        },
      });
    } catch (err) {
      request.log.warn(err, "registration confirmation email failed");
    }

    return reply.code(201).send({ reference: hospital.id.slice(-8).toUpperCase(), name: hospital.name });
  });

  // ── Profile & payment configuration ────────────────────────────────────
  app.get("/api/hospital/profile", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    return app.prisma.hospital.findUnique({ where: { id: hospitalId } });
  });

  app.patch("/api/hospital/profile", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    // Prototype mode: deposit settings are ignored entirely (no amount checks).
    const body = { ...((request.body as Record<string, unknown>) ?? {}) };
    if (!paymentsEnabled()) {
      for (const k of ["depositRequired", "depositAmountSurgery", "depositAmountSecondOpinion"]) delete body[k];
    }
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const before = await app.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!before) return reply.code(404).send({ error: "Hospital not found" });

    const data = { ...parsed.data };
    if (data.contactPersonEmail) data.contactPersonEmail = data.contactPersonEmail.toLowerCase();
    if (Object.keys(data).length === 0) return before; // nothing editable was sent
    const updated = await app.prisma.hospital.update({ where: { id: hospitalId }, data });

    const changed = Object.keys(data) as (keyof typeof data)[];
    await recordAudit(app.prisma, {
      actorId: request.authUser!.id,
      action: "HOSPITAL_PROFILE_UPDATED",
      entityType: "Hospital",
      entityId: hospitalId,
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, updated[k]])),
    });
    return updated;
  });

  // ── Price list ─────────────────────────────────────────────────────────
  app.get("/api/hospital/prices", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;

    const [prices, catalogue, market] = await Promise.all([
      app.prisma.hospitalTreatmentPrice.findMany({
        where: { hospitalId },
        include: { treatment: true },
        orderBy: { treatment: { name: "asc" } },
      }),
      app.prisma.treatment.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      // Market context across *other* live hospitals — helps price competitively.
      app.prisma.hospitalTreatmentPrice.groupBy({
        by: ["treatmentId"],
        where: { hospitalId: { not: hospitalId }, hospital: { status: "APPROVED" } },
        _min: { indicativePrice: true },
        _max: { indicativePrice: true },
        _avg: { indicativePrice: true },
        _count: { _all: true },
      }),
    ]);

    return {
      prices: prices.map((p) => ({ ...p, indicativePrice: Number(p.indicativePrice) })),
      catalogue,
      market: Object.fromEntries(
        market.map((m) => [
          m.treatmentId,
          {
            min: Number(m._min.indicativePrice),
            max: Number(m._max.indicativePrice),
            avg: Math.round(Number(m._avg.indicativePrice)),
            hospitals: m._count._all,
          },
        ]),
      ),
    };
  });

  app.put("/api/hospital/prices/:treatmentId", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    const { treatmentId } = request.params as { treatmentId: string };
    const parsed = priceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const treatment = await app.prisma.treatment.findUnique({ where: { id: treatmentId } });
    if (!treatment) return reply.code(404).send({ error: "Treatment not found" });

    const before = await app.prisma.hospitalTreatmentPrice.findUnique({
      where: { hospitalId_treatmentId: { hospitalId, treatmentId } },
    });
    const saved = await app.prisma.hospitalTreatmentPrice.upsert({
      where: { hospitalId_treatmentId: { hospitalId, treatmentId } },
      update: { indicativePrice: parsed.data.indicativePrice, notes: parsed.data.notes },
      create: { hospitalId, treatmentId, indicativePrice: parsed.data.indicativePrice, notes: parsed.data.notes },
    });
    await recordAudit(app.prisma, {
      actorId: request.authUser!.id,
      action: before ? "PRICE_UPDATED" : "PRICE_ADDED",
      entityType: "HospitalTreatmentPrice",
      entityId: saved.id,
      before: before ? { treatment: treatment.name, price: Number(before.indicativePrice) } : undefined,
      after: { treatment: treatment.name, price: parsed.data.indicativePrice },
    });
    return { ...saved, indicativePrice: Number(saved.indicativePrice) };
  });

  app.delete("/api/hospital/prices/:treatmentId", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    const { treatmentId } = request.params as { treatmentId: string };
    const existing = await app.prisma.hospitalTreatmentPrice.findUnique({
      where: { hospitalId_treatmentId: { hospitalId, treatmentId } },
      include: { treatment: true },
    });
    if (!existing) return reply.code(404).send({ error: "Price not found" });
    await app.prisma.hospitalTreatmentPrice.delete({ where: { id: existing.id } });
    await recordAudit(app.prisma, {
      actorId: request.authUser!.id,
      action: "PRICE_REMOVED",
      entityType: "HospitalTreatmentPrice",
      entityId: existing.id,
      before: { treatment: existing.treatment.name, price: Number(existing.indicativePrice) },
    });
    return reply.code(204).send();
  });

  // ── Doctors ────────────────────────────────────────────────────────────
  app.get("/api/hospital/doctors", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    const doctors = await app.prisma.doctor.findMany({
      where: { hospitalId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        specialisation: true,
        qualifications: true,
        experienceYears: true,
        bio: true,
        user: { select: { name: true, email: true, firebaseUid: true } },
        _count: { select: { assignedEnquiries: { where: { status: { in: ["ASSIGNED", "CONTACTED", "NO_RESPONSE"] } } } } },
      },
    });
    // Never leak auth identifiers — just whether the invite has been accepted.
    return doctors.map(({ user, _count, ...d }) => ({
      ...d,
      user: { name: user.name, email: user.email },
      invitePending: user.firebaseUid.startsWith("invite:"),
      openEnquiries: _count.assignedEnquiries,
    }));
  });

  app.post("/api/hospital/doctors", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    const parsed = doctorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const email = parsed.data.email.toLowerCase();

    const exists = await app.prisma.user.findUnique({ where: { email } });
    if (exists) return reply.code(409).send({ error: "An account with this email already exists" });

    const name = /^dr\.?\s/i.test(parsed.data.name) ? parsed.data.name : `Dr. ${parsed.data.name}`;
    const user = await app.prisma.user.create({
      data: {
        firebaseUid: `invite:${email}`,
        role: "DOCTOR",
        name,
        email,
        hospitalId,
        doctorProfile: {
          create: {
            hospitalId,
            specialisation: parsed.data.specialisation,
            qualifications: parsed.data.qualifications,
            experienceYears: parsed.data.experienceYears,
            bio: parsed.data.bio,
          },
        },
      },
      include: { doctorProfile: true },
    });

    try {
      await getNotificationProvider().send({
        channel: "EMAIL",
        recipient: email,
        template: "doctor_invited",
        data: { doctorName: name },
      });
    } catch (err) {
      request.log.warn(err, "doctor invite email failed");
    }
    await recordAudit(app.prisma, {
      actorId: request.authUser!.id,
      action: "DOCTOR_INVITED",
      entityType: "Doctor",
      entityId: user.doctorProfile!.id,
      after: { name, email, specialisation: parsed.data.specialisation },
    });
    return reply.code(201).send({ id: user.doctorProfile!.id });
  });

  app.patch("/api/hospital/doctors/:id", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    const { id } = request.params as { id: string };
    const parsed = doctorUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const doctor = await app.prisma.doctor.findFirst({ where: { id, hospitalId } });
    if (!doctor) return reply.code(404).send({ error: "Doctor not found at this hospital" });
    const updated = await app.prisma.doctor.update({ where: { id }, data: parsed.data });
    await recordAudit(app.prisma, {
      actorId: request.authUser!.id,
      action: "DOCTOR_PROFILE_UPDATED",
      entityType: "Doctor",
      entityId: id,
      before: Object.fromEntries(Object.keys(parsed.data).map((k) => [k, doctor[k as keyof typeof doctor]])),
      after: parsed.data,
    });
    return updated;
  });

  // ── Enquiry detail (inbox side panel) ──────────────────────────────────
  app.get("/api/hospital/enquiries/:id", { preHandler: app.requireRole("HOSPITAL_ADMIN") }, async (request, reply) => {
    const hospitalId = scopedHospitalId(request, reply);
    if (!hospitalId) return;
    const { id } = request.params as { id: string };
    const enquiry = await app.prisma.enquiry.findFirst({
      where: { id, hospitalId },
      include: {
        patient: { select: { name: true, phone: true, email: true } },
        treatment: { select: { name: true, category: true } },
        assignedDoctor: { select: { id: true, specialisation: true, user: { select: { name: true } } } },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          select: { id: true, toStatus: true, note: true, createdAt: true, actor: { select: { name: true } } },
        },
        attachments: { select: { medicalRecord: { select: { id: true, title: true, category: true } } } },
        payment: { select: { status: true, amount: true, verifiedAt: true } },
      },
    });
    if (!enquiry) return reply.code(404).send({ error: "Enquiry not found" });
    return enquiry;
  });
}
