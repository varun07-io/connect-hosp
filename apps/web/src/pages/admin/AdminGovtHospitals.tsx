import * as React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import type { GovtHospitalImportResult } from "@connect-hospital/shared";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGovtHospitals, useImportGovtHospitals, type GovtHospital } from "@/hooks/useGovtHospitals";
import {
  IMPORT_COLUMNS,
  classifyRows,
  parseHospitalFile,
  toImportCsv,
  type ClassifiedRow,
  type ParseResult,
  type RowStatus,
} from "@/lib/govtHospitalImport";
import { apiErrorMessage } from "@/hooks/useHospitalAdmin";
import { cn, formatDate } from "@/lib/utils";

const SAMPLE_URL = "/samples/kass-govt-hospitals-sample.xlsx";
const PREVIEW_PAGE = 100;

const STATUS_META: Record<RowStatus, { label: string; chip: string; tile: string; icon: typeof CheckCircle2 }> = {
  new: { label: "New", chip: "bg-green-100 text-green-800", tile: "border-green-200 bg-green-50 text-green-900", icon: PlusCircle },
  updated: { label: "Updated", chip: "bg-sky-100 text-sky-800", tile: "border-sky-200 bg-sky-50 text-sky-900", icon: RefreshCw },
  unchanged: { label: "Unchanged", chip: "bg-muted text-muted-foreground", tile: "border-border bg-muted/40 text-foreground", icon: CheckCircle2 },
  duplicate: { label: "Duplicate", chip: "bg-amber-100 text-amber-800", tile: "border-amber-200 bg-amber-50 text-amber-900", icon: Copy },
  invalid: { label: "Invalid", chip: "bg-red-100 text-red-800", tile: "border-red-200 bg-red-50 text-red-900", icon: XCircle },
};

type Step = "upload" | "review" | "done";

export function AdminGovtHospitals() {
  const { data: current } = useGovtHospitals();
  const importer = useImportGovtHospitals();
  const [step, setStep] = React.useState<Step>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [parsed, setParsed] = React.useState<ParseResult | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [result, setResult] = React.useState<GovtHospitalImportResult | null>(null);

  async function handleFile(f: File) {
    setFile(f);
    setParseError(null);
    setParsing(true);
    try {
      const res = await parseHospitalFile(f);
      setParsed(res);
      setStep("review");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Couldn't read this file.");
    } finally {
      setParsing(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setParseError(null);
    setResult(null);
    importer.reset();
  }

  function exportCurrent() {
    if (!current) return;
    const blob = new Blob([toImportCsv(current.items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `govt-hospitals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Government hospital list"
        description={
          current
            ? `${current.total} hospitals listed${current.lastUpdated ? ` · last updated ${formatDate(current.lastUpdated)}` : ""}`
            : "Upload the KASS empanelment list to update the public directory."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/government-hospitals" target="_blank">
                Public page <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={exportCurrent} disabled={!current?.total}>
              <Download className="h-4 w-4" /> Export current list
            </Button>
          </>
        }
      />

      <Stepper step={step} />

      {step === "upload" && (
        <UploadStep onFile={handleFile} parsing={parsing} error={parseError} fileName={file?.name} />
      )}

      {step === "review" && parsed && file && (
        <ReviewStep
          file={file}
          parsed={parsed}
          existing={current?.items ?? []}
          importing={importer.isPending}
          error={importer.isError ? apiErrorMessage(importer.error) : null}
          onBack={reset}
          onImport={(rows, mode) =>
            importer.mutate(
              { rows, mode },
              {
                onSuccess: (res) => {
                  setResult(res);
                  setStep("done");
                },
              },
            )
          }
        />
      )}

      {step === "done" && result && <DoneStep result={result} onAgain={reset} />}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload file" },
    { key: "review", label: "Review & remove duplicates" },
    { key: "done", label: "Published" },
  ];
  const at = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              i < at && "bg-primary-600 text-white",
              i === at && "bg-primary-600 text-white ring-4 ring-primary-100",
              i > at && "bg-muted text-muted-foreground",
            )}
          >
            {i < at ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn("hidden text-sm font-medium sm:inline", i === at ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
          {i < steps.length - 1 && <span className={cn("h-px flex-1", i < at ? "bg-primary-600" : "bg-border")} />}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({ onFile, parsing, error, fileName }: { onFile: (f: File) => void; parsing: boolean; error: string | null; fileName?: string }) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardContent className="p-5">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
              dragging ? "border-primary-500 bg-primary-50" : "border-border hover:border-primary-300 hover:bg-muted/40",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              {parsing ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileSpreadsheet className="h-7 w-7" />}
            </span>
            <div>
              <p className="font-display text-lg font-semibold">{parsing ? `Reading ${fileName}…` : "Drop your Excel file here"}</p>
              <p className="mt-1 text-sm text-muted-foreground">or click to browse · .xlsx or .csv · nothing is published until you confirm</p>
            </div>
            {!parsing && (
              <span className="mt-1 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
                <Upload className="h-4 w-4" /> Choose file
              </span>
            )}
          </label>
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p>
                <span className="font-semibold">{fileName}:</span> {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="font-display font-semibold">Expected format</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Same layout as the KASS hospital list. Title rows, district banners, repeated headers and extra sheets are fine — we find
              the header row automatically.
            </p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {IMPORT_COLUMNS.map((c) => (
              <li key={c.field} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="font-medium">
                  {c.label}
                  {c.required && <span className="ml-1 text-destructive">*</span>}
                </span>
                <span className="truncate text-right text-xs text-muted-foreground">{c.example}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> required. Rows with the same Empanelment Ref-ID (or the same name, district and taluk
            when there's no Ref-ID) count as duplicates.
          </p>
          <Button asChild variant="subtle" className="w-full">
            <a href={SAMPLE_URL} download>
              <Download className="h-4 w-4" /> Download sample Excel
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewStep({
  file,
  parsed,
  existing,
  importing,
  error,
  onBack,
  onImport,
}: {
  file: File;
  parsed: ParseResult;
  existing: GovtHospital[];
  importing: boolean;
  error: string | null;
  onBack: () => void;
  onImport: (rows: ClassifiedRow["row"][], mode: "merge" | "replace") => void;
}) {
  const classified = React.useMemo(() => classifyRows(parsed.rows, existing), [parsed, existing]);
  // One chosen row per hospital identity; duplicates and invalid rows start excluded.
  const [chosen, setChosen] = React.useState<Map<string, number | null>>(() => {
    const m = new Map<string, number | null>();
    for (const c of classified) if (c.status !== "invalid" && c.status !== "duplicate") m.set(c.key, c.row.index);
    return m;
  });
  const [mode, setMode] = React.useState<"merge" | "replace">("merge");
  const [tab, setTab] = React.useState<RowStatus | "all">("all");
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PREVIEW_PAGE);

  const isChosen = (c: ClassifiedRow) => chosen.get(c.key) === c.row.index;
  const toggle = (c: ClassifiedRow) =>
    setChosen((prev) => {
      const next = new Map(prev);
      next.set(c.key, isChosen(c) ? null : c.row.index);
      return next;
    });

  const counts = classified.reduce<Record<RowStatus, number>>(
    (acc, c) => ((acc[c.status] += 1), acc),
    { new: 0, updated: 0, unchanged: 0, duplicate: 0, invalid: 0 },
  );
  const selected = classified.filter(isChosen);
  const summary = { new: 0, updated: 0, unchanged: 0 };
  for (const c of selected) summary[c.compare ?? "new"] += 1;
  const keep = new Set(selected.map((c) => c.key));
  const removals = mode === "replace" ? existing.filter((h) => !keep.has(h.key)) : [];
  const changes = summary.new + summary.updated + removals.length;

  const needle = q.trim().toLowerCase();
  const visible = classified.filter(
    (c) =>
      (tab === "all" || c.status === tab) &&
      (!needle || [c.row.name, c.row.refId, c.row.district, c.row.taluk].some((v) => v?.toLowerCase().includes(needle))),
  );

  return (
    <div className="space-y-4 pb-24">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {parsed.rows.length} rows read from {parsed.sheetsRead} sheet{parsed.sheetsRead > 1 ? "s" : ""}
                {parsed.sheetsSkipped.length > 0 && ` · skipped (no header): ${parsed.sheetsSkipped.join(", ")}`}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Choose a different file
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(STATUS_META) as RowStatus[]).map((s) => {
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => {
                setTab(tab === s ? "all" : s);
                setLimit(PREVIEW_PAGE);
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition-shadow hover:shadow-soft",
                meta.tile,
                tab === s && "ring-2 ring-primary-500 ring-offset-1",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{meta.label}</p>
                <meta.icon className="h-4 w-4 opacity-70" />
              </div>
              <p className="mt-1 font-display text-2xl font-bold">{counts[s]}</p>
              <p className="text-[11px] opacity-80">
                {s === "new" && "not in the current list"}
                {s === "updated" && "details changed"}
                {s === "unchanged" && "already up to date"}
                {s === "duplicate" && "repeats — excluded"}
                {s === "invalid" && "missing data — excluded"}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">How should this file update the list?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { v: "merge", title: "Add & update", desc: "Add new hospitals and update changed ones. Hospitals not in this file stay listed." },
                { v: "replace", title: "Replace the whole list", desc: "Make the directory exactly this file. Hospitals not in it are removed." },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setMode(o.v)}
                aria-pressed={mode === o.v}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  mode === o.v ? "border-primary-600 bg-primary-50 ring-1 ring-primary-600" : "border-border hover:bg-muted/40",
                )}
              >
                <p className="text-sm font-semibold">{o.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.desc}</p>
              </button>
            ))}
          </div>
          {mode === "replace" && removals.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> {removals.length} listed hospital{removals.length > 1 ? "s" : ""} will be removed
              </p>
              <p className="mt-1 text-xs">
                {removals.slice(0, 6).map((h) => h.name).join(", ")}
                {removals.length > 6 && ` and ${removals.length - 6} more`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {(["all", ...Object.keys(STATUS_META)] as (RowStatus | "all")[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setLimit(PREVIEW_PAGE);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  tab === t ? "bg-primary-600 text-white" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t === "all" ? `All ${classified.length}` : `${STATUS_META[t].label} ${counts[t]}`}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rows" className="h-8 pl-8 text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5" />
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Hospital</th>
                <th className="px-3 py-2.5 font-medium">District / Taluk</th>
                <th className="px-3 py-2.5 font-medium">Specialities</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 text-right font-medium">Row</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, limit).map((c) => (
                <PreviewRow key={c.row.index} c={c} chosen={isChosen(c)} onToggle={() => toggle(c)} />
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No rows here.</p>}
        </div>
        {visible.length > limit && (
          <div className="border-t border-border p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PREVIEW_PAGE)}>
              Show {Math.min(PREVIEW_PAGE, visible.length - limit)} more of {visible.length - limit}
            </Button>
          </div>
        )}
      </div>

      {/* Sticky confirmation bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:left-64">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="text-sm">
            <p className="font-semibold">
              {changes === 0 ? "Nothing to change — the list is already up to date" : `${changes} change${changes > 1 ? "s" : ""} will be published`}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.new} new · {summary.updated} updated · {summary.unchanged} unchanged
              {mode === "replace" ? ` · ${removals.length} removed` : ""} · {counts.duplicate + counts.invalid} excluded
            </p>
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack}>
              Cancel
            </Button>
            <Button disabled={importing || selected.length === 0 || changes === 0} onClick={() => onImport(selected.map((c) => c.row), mode)}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publish {changes > 0 ? `${changes} change${changes > 1 ? "s" : ""}` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  name: "name",
  district: "district",
  taluk: "taluk",
  address: "address",
  specialities: "specialities",
  subType: "type",
};

function PreviewRow({ c, chosen, onToggle }: { c: ClassifiedRow; chosen: boolean; onToggle: () => void }) {
  const meta = STATUS_META[c.status];
  const r = c.row;
  const disabled = c.status === "invalid";
  return (
    <tr className={cn("border-t border-border align-top", !chosen && "bg-muted/20 text-muted-foreground")}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={chosen}
          disabled={disabled}
          onChange={onToggle}
          className="h-4 w-4 rounded accent-primary-600 disabled:opacity-40"
          aria-label={`Include ${r.name}`}
        />
      </td>
      <td className="px-3 py-3">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.chip)}>
          <meta.icon className="h-3 w-3" /> {meta.label}
        </span>
        {c.status === "duplicate" && (
          <p className="mt-1 text-[11px]">{chosen ? `Using this instead of row #${c.duplicateOf}` : `Same as row #${c.duplicateOf}`}</p>
        )}
        {c.status === "updated" && <p className="mt-1 text-[11px]">Changed: {c.changes.map((f) => FIELD_LABEL[f]).join(", ")}</p>}
        {c.status === "invalid" && <p className="mt-1 text-[11px] text-destructive">{r.errors.join("; ")}</p>}
      </td>
      <td className="px-3 py-3">
        <p className={cn("font-medium", chosen && "text-foreground")}>{r.name}</p>
        {r.refId && <p className="font-mono text-[11px] text-muted-foreground">{r.refId}</p>}
        {c.status === "updated" && c.changes.includes("name") && c.existing && (
          <p className="text-[11px] text-muted-foreground line-through">{c.existing.name}</p>
        )}
      </td>
      <td className="px-3 py-3 text-xs">
        {r.district || <span className="text-destructive">—</span>}
        {r.taluk && <span className="block text-muted-foreground">{r.taluk}</span>}
      </td>
      <td className="max-w-[260px] px-3 py-3 text-xs" title={r.specialities.join(", ")}>
        <span className="line-clamp-2">{r.specialities.join(", ") || "—"}</span>
        <span className="text-muted-foreground">{r.specialities.length} listed</span>
      </td>
      <td className="px-3 py-3 text-xs">{r.subType ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right text-[11px] text-muted-foreground">
        #{r.index}
        <span className="block">
          {r.sheet} · row {r.rowNumber}
        </span>
      </td>
    </tr>
  );
}

function DoneStep({ result, onAgain }: { result: GovtHospitalImportResult; onAgain: () => void }) {
  const tiles = [
    { label: "Added", value: result.created, tone: "text-green-700" },
    { label: "Updated", value: result.updated, tone: "text-sky-700" },
    { label: "Unchanged", value: result.unchanged, tone: "text-muted-foreground" },
    { label: "Removed", value: result.removed, tone: "text-red-700" },
  ];
  return (
    <Card>
      <CardContent className="flex flex-col items-center p-8 text-center sm:p-12">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">Hospital list updated</h2>
        <p className="mt-1 text-muted-foreground">The public directory now shows these changes.</p>
        <div className="mt-6 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-border p-3">
              <p className={cn("font-display text-2xl font-bold", t.tone)}>{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>
        {result.duplicatesSkipped > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">{result.duplicatesSkipped} duplicate rows were skipped by the server.</p>
        )}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onAgain}>
            <Upload className="h-4 w-4" /> Import another file
          </Button>
          <Button asChild>
            <Link to="/government-hospitals" target="_blank">
              View public page <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
