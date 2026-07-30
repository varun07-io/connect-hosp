import type { FastifyInstance } from "fastify";
import { searchHospitalsSchema } from "@connect-hospital/shared";

interface PricePoint {
  price: number;
  currency: string;
  treatmentId: string;
  category: string;
}

interface HospitalRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  specialities: string[];
  photos: string[];
  accreditations: string[];
  doctorCount: number;
  reviewCount: number;
  avgRating: number | null;
  prices: PricePoint[];
}

interface Filters {
  city?: string;
  treatmentId?: string;
  categories: string[];
  minBudget?: number;
  maxBudget?: number;
  minRating?: number;
}

/** A price qualifies if it matches the treatment/category selection (if any)
 *  and sits inside the budget window (if any). */
function priceQualifies(p: PricePoint, f: Filters): boolean {
  if (f.treatmentId && p.treatmentId !== f.treatmentId) return false;
  if (!f.treatmentId && f.categories.length > 0 && !f.categories.includes(p.category)) return false;
  if (f.minBudget !== undefined && p.price < f.minBudget) return false;
  if (f.maxBudget !== undefined && p.price > f.maxBudget) return false;
  return true;
}

function hospitalMatches(h: HospitalRow, f: Filters): boolean {
  if (f.city && !h.city.toLowerCase().includes(f.city.toLowerCase())) return false;
  if (f.minRating !== undefined && f.minRating > 0 && (h.avgRating ?? 0) < f.minRating) return false;
  const constrainsPrices =
    Boolean(f.treatmentId) || f.categories.length > 0 || f.minBudget !== undefined || f.maxBudget !== undefined;
  if (constrainsPrices && !h.prices.some((p) => priceQualifies(p, f))) return false;
  return true;
}

/** Cheapest price that satisfies the active treatment/budget filters, so a card
 *  showing "from ₹X" reflects what the user actually searched for (DIS-06). */
function startingPriceFor(h: HospitalRow, f: Filters): PricePoint | null {
  const constrainsPrices =
    Boolean(f.treatmentId) || f.categories.length > 0 || f.minBudget !== undefined || f.maxBudget !== undefined;
  const pool = constrainsPrices ? h.prices.filter((p) => priceQualifies(p, f)) : h.prices;
  return pool.reduce<PricePoint | null>((best, p) => (!best || p.price < best.price ? p : best), null);
}

/** DIS-01..07 — public, unauthenticated discovery. Only ever returns APPROVED hospitals. */
export default async function hospitalRoutes(app: FastifyInstance) {
  app.get("/api/hospitals", async (request, reply) => {
    const parsed = searchHospitalsSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { city, treatmentId, categories, category, minBudget, maxBudget, minRating, sort, page, pageSize } =
      parsed.data;

    // `category` (singular, from older homepage links) folds into the multi-select list.
    const selectedCategories = Array.from(new Set([...categories, ...(category ? [category] : [])]));
    const filters: Filters = { city, treatmentId, categories: selectedCategories, minBudget, maxBudget, minRating };

    // Load the approved catalogue once and filter/facet/sort/paginate in memory.
    // Deliberate at POC scale (Section 8 caps this at 50 hospitals — a few
    // hundred rows): exact facet counts and rating filters are far simpler here
    // than in SQL. Revisit with indexed SQL aggregates before scaling past that.
    const rows = await app.prisma.hospital.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        specialities: true,
        photos: true,
        accreditations: true,
        _count: { select: { doctors: true } },
        reviews: { select: { rating: true } },
        treatmentPrices: {
          select: { indicativePrice: true, currency: true, treatmentId: true, treatment: { select: { category: true } } },
        },
      },
    });

    const hospitals: HospitalRow[] = rows.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      city: h.city,
      specialities: h.specialities,
      photos: h.photos,
      accreditations: h.accreditations,
      doctorCount: h._count.doctors,
      reviewCount: h.reviews.length,
      avgRating: h.reviews.length > 0 ? h.reviews.reduce((s, r) => s + r.rating, 0) / h.reviews.length : null,
      prices: h.treatmentPrices.map((p) => ({
        price: Number(p.indicativePrice),
        currency: p.currency,
        treatmentId: p.treatmentId,
        category: p.treatment.category,
      })),
    }));

    const matched = hospitals.filter((h) => hospitalMatches(h, filters));

    const enriched = matched.map((h) => {
      const sp = startingPriceFor(h, filters);
      return {
        id: h.id,
        name: h.name,
        slug: h.slug,
        city: h.city,
        specialities: h.specialities,
        photos: h.photos,
        accreditations: h.accreditations,
        doctorCount: h.doctorCount,
        reviewCount: h.reviewCount,
        avgRating: h.avgRating,
        startingPrice: sp ? sp.price : null,
        currency: sp?.currency ?? "INR",
      };
    });

    enriched.sort((a, b) => {
      if (sort === "cost_asc" || sort === "cost_desc") {
        if (a.startingPrice === null) return 1;
        if (b.startingPrice === null) return -1;
        return sort === "cost_asc" ? a.startingPrice - b.startingPrice : b.startingPrice - a.startingPrice;
      }
      // "recommended" and "rating_desc" both lead with quality signals; ratings
      // first, then volume of reviews as the tie-break.
      const ratingDelta = (b.avgRating ?? 0) - (a.avgRating ?? 0);
      if (ratingDelta !== 0) return ratingDelta;
      return b.reviewCount - a.reviewCount;
    });

    // Facet counts are computed with the facet's own dimension excluded, so a
    // count always answers "how many would I get if I picked this too?".
    const allCategories = Array.from(new Set(hospitals.flatMap((h) => h.prices.map((p) => p.category)))).sort();
    const categoryFacets = allCategories.map((value) => ({
      value,
      count: hospitals.filter((h) => hospitalMatches(h, { ...filters, categories: [value] })).length,
    }));
    const allCities = Array.from(new Set(hospitals.map((h) => h.city))).sort();
    const cityFacets = allCities.map((value) => ({
      value,
      count: hospitals.filter((h) => hospitalMatches(h, { ...filters, city: value })).length,
    }));
    const everyPrice = hospitals.flatMap((h) => h.prices.map((p) => p.price));

    return {
      items: enriched.slice((page - 1) * pageSize, page * pageSize),
      total: enriched.length,
      page,
      pageSize,
      facets: {
        categories: categoryFacets,
        cities: cityFacets,
        priceRange: everyPrice.length
          ? { min: Math.floor(Math.min(...everyPrice)), max: Math.ceil(Math.max(...everyPrice)) }
          : { min: 0, max: 0 },
      },
    };
  });

  app.get("/api/hospitals/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const hospital = await app.prisma.hospital.findFirst({
      where: { slug, status: "APPROVED" },
      include: {
        doctors: {
          select: {
            id: true,
            specialisation: true,
            qualifications: true,
            experienceYears: true,
            bio: true,
            photoUrl: true,
            user: { select: { name: true } },
          },
        },
        treatmentPrices: { include: { treatment: true } },
        reviews: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!hospital) return reply.code(404).send({ error: "Hospital not found" });

    const avgRating =
      hospital.reviews.length > 0
        ? hospital.reviews.reduce((sum, r) => sum + r.rating, 0) / hospital.reviews.length
        : null;

    return { ...hospital, avgRating };
  });

  app.get("/api/treatments", async () => {
    return app.prisma.treatment.findMany({ orderBy: { name: "asc" } });
  });
}
