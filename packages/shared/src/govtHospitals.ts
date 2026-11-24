import { z } from "zod";

/**
 * Government hospital directory (KASS empanelment list) — normalisation rules
 * shared by the browser import preview and the API import, so the preview
 * always shows exactly what the import will do.
 */

export interface GovtHospitalInput {
  refId: string | null;
  name: string;
  district: string;
  taluk: string | null;
  address: string | null;
  specialities: string[];
  subType: string | null;
}

/** Collapse whitespace (including line breaks inside spreadsheet cells). */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

const ACRONYMS = new Set(["ENT", "TKR", "THR", "RIRS", "COVID", "GP", "L&T", "ICU", "NICU", "IVF", "HIV", "AIDS", "OPD"]);
const SMALL_WORDS = new Set(["and", "of", "the", "in", "for", "to", "&"]);

/** "OBSTETRICS AND GYNAECOLOGY" → "Obstetrics and Gynaecology"; keeps ENT, TKR, COVID… */
export function normalizeSpeciality(raw: string): string {
  const text = cleanText(raw);
  let first = true;
  return text.replace(/[A-Za-z&]+/g, (word) => {
    const upper = word.toUpperCase();
    const lower = word.toLowerCase();
    let out: string;
    if (ACRONYMS.has(upper)) out = upper;
    else if (!first && SMALL_WORDS.has(lower)) out = lower;
    else out = lower.charAt(0).toUpperCase() + lower.slice(1);
    first = false;
    return out;
  });
}

/** Split a speciality cell, normalise and de-duplicate. Commas/semicolons
 *  separate items; line breaks are usually just wrapped text inside the cell
 *  ("OBSTETRICS AND⏎GYNAECOLOGY"), so they only separate items when a cell
 *  has no commas or semicolons at all. */
export function splitSpecialities(raw: unknown): string[] {
  const text = String(raw ?? "");
  const separator = /[,;]/.test(text) ? /[,;]+/ : /\n+/;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(separator)) {
    const s = normalizeSpeciality(part);
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function keyPart(s: string | null | undefined) {
  return cleanText(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Identity of a hospital across uploads: the Empanelment Ref-ID when present,
 *  otherwise name + district + taluk. */
export function govtHospitalKey(row: Pick<GovtHospitalInput, "refId" | "name" | "district" | "taluk">): string {
  const ref = cleanText(row.refId).toUpperCase();
  if (ref) return `ref:${ref}`;
  return `name:${keyPart(row.name)}|${keyPart(row.district)}|${keyPart(row.taluk)}`;
}

/** Fields compared to decide whether an existing hospital would change. */
export const GOVT_HOSPITAL_FIELDS = ["name", "district", "taluk", "address", "specialities", "subType"] as const;
export type GovtHospitalField = (typeof GOVT_HOSPITAL_FIELDS)[number];

export function changedGovtHospitalFields(
  before: Omit<GovtHospitalInput, "refId">,
  after: Omit<GovtHospitalInput, "refId">,
): GovtHospitalField[] {
  return GOVT_HOSPITAL_FIELDS.filter((f) => {
    if (f === "specialities") return before.specialities.join("|") !== after.specialities.join("|");
    return (before[f] ?? "") !== (after[f] ?? "");
  });
}

/** Normalise one already-mapped row; returns null fields as null, never "". */
export function normalizeGovtHospital(row: {
  refId?: unknown;
  name?: unknown;
  district?: unknown;
  taluk?: unknown;
  address?: unknown;
  specialities?: unknown;
  subType?: unknown;
}): GovtHospitalInput {
  const opt = (v: unknown) => cleanText(v) || null;
  return {
    refId: opt(row.refId)?.toUpperCase() ?? null,
    name: cleanText(row.name),
    district: cleanText(row.district),
    taluk: opt(row.taluk),
    address: opt(row.address),
    specialities: Array.isArray(row.specialities) ? splitSpecialities(row.specialities.join(",")) : splitSpecialities(row.specialities),
    subType: opt(row.subType),
  };
}

export const govtHospitalRowSchema = z.object({
  refId: z.string().max(60).nullable(),
  name: z.string().min(1, "Hospital name is required").max(200),
  district: z.string().min(1, "District is required").max(80),
  taluk: z.string().max(80).nullable(),
  address: z.string().max(500).nullable(),
  specialities: z.array(z.string().max(120)).max(80),
  subType: z.string().max(120).nullable(),
});

export const govtHospitalImportSchema = z.object({
  rows: z.array(govtHospitalRowSchema).min(1).max(10_000),
  /** merge: add new + update changed. replace: also remove hospitals missing from the file. */
  mode: z.enum(["merge", "replace"]),
});
export type GovtHospitalImportInput = z.infer<typeof govtHospitalImportSchema>;

export interface GovtHospitalImportResult {
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  duplicatesSkipped: number;
}
