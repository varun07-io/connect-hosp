import type { GovtHospital } from "@/hooks/useGovtHospitals";

/** Everyday words → the speciality vocabulary used in the KASS list. */
export const SYNONYMS: Record<string, string[]> = {
  eye: ["ophthalmology", "cataract"],
  eyes: ["ophthalmology", "cataract"],
  heart: ["cardio", "angioplasty", "bypass"],
  cardiac: ["cardio", "angioplasty", "bypass"],
  child: ["paediatric", "neonatal", "child"],
  children: ["paediatric", "neonatal", "child"],
  kids: ["paediatric", "neonatal"],
  baby: ["neonatal", "paediatric"],
  cancer: ["oncology"],
  bone: ["orthopaedic"],
  bones: ["orthopaedic"],
  knee: ["orthopaedic", "tkr"],
  hip: ["orthopaedic", "thr"],
  brain: ["neuro"],
  nerve: ["neuro"],
  kidney: ["nephro", "urology", "kidney", "dialysis"],
  pregnancy: ["obstetrics"],
  delivery: ["obstetrics"],
  maternity: ["obstetrics", "gynaecology"],
  women: ["gynaecology", "obstetrics"],
  teeth: ["dental"],
  tooth: ["dental"],
  dentist: ["dental"],
  ear: ["ent"],
  nose: ["ent"],
  throat: ["ent"],
  lung: ["pulmonology"],
  lungs: ["pulmonology"],
  liver: ["gastro", "liver"],
  stomach: ["gastro"],
  mental: ["mental", "nimhans"],
  accident: ["accident", "trauma", "polytrauma"],
  emergency: ["emergency", "accident", "trauma"],
};

/** Short terms ("ent", "gp") must match whole words — otherwise "ent" would
 *  match "government" and "accident". */
export function contains(text: string, term: string) {
  if (term.length > 3) return text.includes(term);
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

export function matchesTerm(text: string, t: string) {
  return contains(text, t) || (SYNONYMS[t] ?? []).some((s) => contains(text, s));
}

export function tokenize(q: string) {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

export function haystack(h: GovtHospital) {
  return [h.name, h.address, h.district, h.taluk, h.subType, h.refId, ...h.specialities, ...h.schemes].join(" ").toLowerCase();
}

export function matchesQuery(hay: string, tokens: string[]) {
  return tokens.every((t) => matchesTerm(hay, t));
}

export type FacetKey = "district" | "taluk" | "types" | "specs" | "schemes";

export interface DirectoryFilters {
  q: string;
  district: string[];
  taluk: string[];
  types: string[];
  specs: string[];
  schemes: string[];
}

/** Values a hospital contributes to each facet. */
export function facetValues(h: GovtHospital, key: FacetKey): string[] {
  switch (key) {
    case "district":
      return [h.district];
    case "taluk":
      return h.taluk ? [h.taluk] : [];
    case "types":
      return h.subType ? [h.subType] : [];
    case "specs":
      return h.specialities;
    case "schemes":
      return h.schemes;
  }
}

/** Specialities narrow (hospital must offer *all* selected); every other facet
 *  widens (any selected value matches). */
export function passes(h: GovtHospital, f: DirectoryFilters, skip?: FacetKey) {
  for (const key of ["district", "taluk", "types", "specs", "schemes"] as FacetKey[]) {
    if (key === skip || f[key].length === 0) continue;
    const values = facetValues(h, key);
    const ok = key === "specs" ? f.specs.every((s) => values.includes(s)) : f[key].some((v) => values.includes(v));
    if (!ok) return false;
  }
  return true;
}

export function applyFilters(items: { h: GovtHospital; hay: string }[], f: DirectoryFilters, skip?: FacetKey) {
  const tokens = tokenize(f.q);
  return items.filter(({ h, hay }) => (!tokens.length || matchesQuery(hay, tokens)) && passes(h, f, skip));
}

export function typeTone(subType: string | null): { badge: string; solid: string; bar: string } {
  const t = (subType ?? "").toLowerCase();
  if (t.includes("medical college")) return { badge: "bg-violet-100 text-violet-800", solid: "bg-violet-600", bar: "bg-violet-500" };
  if (t.includes("government of india") || t.includes("railway")) return { badge: "bg-sky-100 text-sky-800", solid: "bg-sky-600", bar: "bg-sky-500" };
  if (t.includes("taluk")) return { badge: "bg-amber-100 text-amber-800", solid: "bg-amber-600", bar: "bg-amber-500" };
  if (t.includes("autonomous")) return { badge: "bg-primary-100 text-primary-800", solid: "bg-primary-600", bar: "bg-primary-500" };
  return { badge: "bg-slate-100 text-slate-700", solid: "bg-slate-600", bar: "bg-accent-400" };
}

/** First letter of the first meaningful word ("Govt Hsis Gosha" → "H"? no: skip generic words). */
export function avatarLetter(name: string) {
  const generic = new Set(["govt", "government", "general", "the", "dr", "sri", "sir", "inst", "institute", "of"]);
  const word = name.split(/\s+/).find((w) => !generic.has(w.toLowerCase().replace(/\./g, ""))) ?? name;
  return word.charAt(0).toUpperCase();
}

export function mapsQuery(h: GovtHospital) {
  return [h.name, h.address, h.district].filter(Boolean).join(", ");
}

export function directionsUrl(h: GovtHospital) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(h))}`;
}

export function locationLine(h: GovtHospital) {
  return [h.taluk, h.district].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
}
