import {
  changedGovtHospitalFields,
  cleanText,
  govtHospitalKey,
  normalizeGovtHospital,
  type GovtHospitalField,
  type GovtHospitalInput,
} from "@connect-hospital/shared";
import type { GovtHospital } from "@/hooks/useGovtHospitals";

/** Columns we read, in the KASS list's order. Header matching is fuzzy, so
 *  "Empanelment Ref-ID", "Empanelment RefID" or "Ref ID" all work. */
export const IMPORT_COLUMNS: { field: keyof Omit<GovtHospitalInput, "specialities"> | "specialities"; label: string; required: boolean; example: string; match: RegExp }[] = [
  { field: "refId", label: "Empanelment Ref-ID", required: false, example: "T_18480194377895", match: /empan|ref/ },
  { field: "name", label: "Hospital Name", required: true, example: "K C General Hospital", match: /hospital ?name|^name$/ },
  { field: "district", label: "District", required: true, example: "Bengaluru", match: /district/ },
  { field: "taluk", label: "Taluk", required: false, example: "Bangalore", match: /taluk|taluka|tehsil/ },
  { field: "address", label: "Address", required: false, example: "Malleshwaram Bangalore", match: /address/ },
  { field: "specialities", label: "Speciality", required: false, example: "GENERAL SURGERY, ENT, ORTHOPAEDICS", match: /special/ },
  { field: "subType", label: "Hospital Sub Type", required: false, example: "Government Hospital", match: /sub ?type|hospital type|^type$|category/ },
];

export interface ParsedRow extends GovtHospitalInput {
  /** 1-based position across the whole file — stable id for the preview. */
  index: number;
  sheet: string;
  rowNumber: number;
  errors: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  sheetsRead: number;
  /** Sheets where no header row (with a "Hospital Name" column) was found. */
  sheetsSkipped: string[];
}

type Cell = string | number | boolean | Date | null | undefined;

function norm(cell: Cell) {
  return cleanText(cell).toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

/** Map header cells → our fields. Returns null if this row isn't a header. */
function mapHeader(row: Cell[]): Partial<Record<(typeof IMPORT_COLUMNS)[number]["field"], number>> | null {
  const map: Partial<Record<(typeof IMPORT_COLUMNS)[number]["field"], number>> = {};
  row.forEach((cell, i) => {
    const h = norm(cell);
    if (!h) return;
    // Name first: "hospital name" must not be claimed by "hospital sub type".
    for (const col of IMPORT_COLUMNS) {
      if (map[col.field] === undefined && col.match.test(h)) {
        map[col.field] = i;
        break;
      }
    }
  });
  return map.name !== undefined ? map : null;
}

function parseTable(sheet: string, table: Cell[][], startIndex: number): { rows: ParsedRow[]; headerFound: boolean } {
  const headerAt = table.findIndex((r) => mapHeader(r) !== null);
  if (headerAt < 0) return { rows: [], headerFound: false };
  const cols = mapHeader(table[headerAt])!;
  const get = (r: Cell[], f: keyof typeof cols) => (cols[f] === undefined ? null : r[cols[f]!]);

  // A district banner ("Bengaluru" alone on a row — in the KASS layout it sits
  // between the title and the header) fills in the district for rows that
  // leave the column blank. Title rows ("… HOSPITAL LIST") are not banners.
  const isBanner = (r: Cell[]) => {
    const filled = r.filter((c) => cleanText(c) !== "");
    return filled.length === 1 && typeof filled[0] === "string" && !/list|hospital/i.test(filled[0]) ? cleanText(filled[0]) : "";
  };
  let banner = "";
  for (let i = 0; i < headerAt; i++) banner = isBanner(table[i] ?? []) || banner;
  const rows: ParsedRow[] = [];
  for (let i = headerAt + 1; i < table.length; i++) {
    const r = table[i] ?? [];
    const filled = r.filter((c) => cleanText(c) !== "");
    if (filled.length === 0) continue;
    if (mapHeader(r)) continue; // header repeated on every printed page
    const name = cleanText(get(r, "name"));
    if (!name) {
      banner = isBanner(r) || banner;
      continue;
    }
    const row = normalizeGovtHospital({
      refId: get(r, "refId"),
      name,
      district: cleanText(get(r, "district")) || banner,
      taluk: get(r, "taluk"),
      address: get(r, "address"),
      specialities: get(r, "specialities"),
      subType: get(r, "subType"),
    });
    const errors: string[] = [];
    if (!row.district) errors.push("District is missing");
    if (row.name.length > 200) errors.push("Name is too long");
    rows.push({ ...row, index: startIndex + rows.length, sheet, rowNumber: i + 1, errors });
  }
  return { rows, headerFound: true };
}

/** Minimal RFC 4180 CSV reader (quoted fields, embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

export async function parseHospitalFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  let sheets: { sheet: string; data: Cell[][] }[];
  if (name.endsWith(".csv")) {
    sheets = [{ sheet: file.name, data: parseCsv((await file.text()).replace(/^﻿/, "")) }];
  } else if (name.endsWith(".xlsx")) {
    // Loaded on demand — the parser is only needed on this admin screen.
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    sheets = await readXlsxFile(file);
  } else {
    throw new Error("Please upload an .xlsx or .csv file. (Older .xls files: open in Excel and “Save As” .xlsx.)");
  }

  const rows: ParsedRow[] = [];
  const sheetsSkipped: string[] = [];
  for (const s of sheets) {
    const { rows: parsed, headerFound } = parseTable(s.sheet, s.data, rows.length + 1);
    if (!headerFound) sheetsSkipped.push(s.sheet);
    rows.push(...parsed);
  }
  if (rows.length === 0) {
    throw new Error(
      sheetsSkipped.length === sheets.length
        ? "Couldn't find a header row with a “Hospital Name” column. Download the sample Excel to see the expected format."
        : "The file has a header row but no hospital rows under it.",
    );
  }
  return { rows, sheetsRead: sheets.length, sheetsSkipped };
}

export type RowStatus = "new" | "updated" | "unchanged" | "duplicate" | "invalid";
export type CompareStatus = "new" | "updated" | "unchanged";

export interface ClassifiedRow {
  row: ParsedRow;
  key: string;
  status: RowStatus;
  /** For duplicates: index of the first row with the same identity. */
  duplicateOf?: number;
  /** How this row compares with the live directory (valid rows only) —
   *  used when an admin picks a later duplicate over the first one. */
  compare?: CompareStatus;
  existing?: GovtHospital;
  changes: GovtHospitalField[];
}

/** Compare a parsed file with the current directory, exactly as the API will. */
export function classifyRows(rows: ParsedRow[], existing: GovtHospital[]): ClassifiedRow[] {
  const current = new Map(existing.map((h) => [h.key, h]));
  const firstSeen = new Map<string, number>();
  return rows.map((row) => {
    const key = govtHospitalKey(row);
    if (row.errors.length) return { row, key, status: "invalid", changes: [] };
    const match = current.get(key);
    const changes = match ? changedGovtHospitalFields(match, row) : [];
    const compare: CompareStatus = !match ? "new" : changes.length ? "updated" : "unchanged";
    const first = firstSeen.get(key);
    if (first !== undefined) return { row, key, status: "duplicate", duplicateOf: first, compare, existing: match, changes };
    firstSeen.set(key, row.index);
    return { row, key, status: compare, compare, existing: match, changes };
  });
}

const CSV_HEADERS = ["Sl.No", "Empanelment Ref-ID", "Hospital Name", "District", "Taluk", "Address", "Speciality", "Hospital Sub Type"];

/** Current directory as a CSV in the import format — edit and re-upload. */
export function toImportCsv(items: GovtHospital[]): string {
  const esc = (v: string | null | undefined) => {
    const s = v ?? "";
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = items.map((h, i) =>
    [String(i + 1), h.refId, h.name, h.district, h.taluk, h.address, h.specialities.join(", "), h.subType].map(esc).join(","),
  );
  return "\uFEFF" + [CSV_HEADERS.join(","), ...lines].join("\r\n");
}
