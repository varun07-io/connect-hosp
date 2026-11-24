import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Phone,
  Search,
  UserPlus,
} from "lucide-react";
import type { EnquiryStatus } from "@connect-hospital/shared";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { EnquiryStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppConfig, useHospitalEnquiries, useHospitalMe } from "@/hooks/useApiQueries";
import { useAcknowledgeEnquiry, useAssignEnquiry, useHospitalDoctors } from "@/hooks/useApiMutations";
import { useHospitalEnquiry } from "@/hooks/useHospitalAdmin";
import { slaState, type SlaTone } from "@/lib/sla";
import type { EnquiryListItem } from "@/types/api";
import { cn, formatCurrency, formatDateTime, formatRelative } from "@/lib/utils";

type Tab = "action" | "doctor" | "done" | "all";
const TAB_STATUSES: Record<Exclude<Tab, "all">, EnquiryStatus[]> = {
  action: ["NEW", "ACKNOWLEDGED", "REOPENED"],
  doctor: ["ASSIGNED", "CONTACTED", "NO_RESPONSE"],
  done: ["GUIDED", "CLOSED", "CANCELLED"],
};
const TAB_LABEL: Record<Tab, string> = { action: "Needs action", doctor: "With doctor", done: "Completed", all: "All" };

/** Re-render once a minute so deadline countdowns stay honest. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const SLA_CHIP: Record<SlaTone, string> = {
  ok: "bg-muted text-muted-foreground",
  soon: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
};

export function HospitalEnquiries() {
  const { data, isLoading } = useHospitalEnquiries();
  const { data: hospital } = useHospitalMe();
  const slaHours = hospital?.slaCallbackHours ?? 48;
  const { paymentsEnabled } = useAppConfig();
  const now = useNow();
  const [tab, setTab] = React.useState<Tab>("action");
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const items = React.useMemo(() => data ?? [], [data]);
  const counts = {
    action: items.filter((e) => TAB_STATUSES.action.includes(e.status)).length,
    doctor: items.filter((e) => TAB_STATUSES.doctor.includes(e.status)).length,
    done: items.filter((e) => TAB_STATUSES.done.includes(e.status)).length,
    all: items.length,
  };
  const overdue = items.filter((e) => slaState(e.createdAt, e.status, slaHours, now)?.tone === "overdue").length;

  const q = query.trim().toLowerCase();
  const visible = items
    .filter((e) => tab === "all" || TAB_STATUSES[tab].includes(e.status))
    .filter((e) => !q || [e.patient?.name, e.treatment?.name, e.condition].some((v) => v?.toLowerCase().includes(q)))
    // Most urgent first while anything is still awaiting a call; newest first otherwise.
    .sort((a, b) => {
      const sa = slaState(a.createdAt, a.status, slaHours, now);
      const sb = slaState(b.createdAt, b.status, slaHours, now);
      if (sa && sb) return sa.msLeft - sb.msLeft;
      if (sa) return -1;
      if (sb) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Enquiry inbox"
        description={`Acknowledge, assign a doctor and make sure every patient gets a call within ${slaHours} hours.`}
      />

      {overdue > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <p>
            <span className="font-semibold">{overdue} {overdue === 1 ? "patient is" : "patients are"} past the {slaHours}-hour callback deadline.</span>{" "}
            Call them first{paymentsEnabled ? " — paid deposits become eligible for an automatic refund" : ""}.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-full overflow-x-auto rounded-lg border border-border bg-background p-1 md:w-auto" role="tablist">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-primary-600 text-white shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABEL[t]}
              <span className={cn("ml-1.5 text-xs", tab === t ? "text-primary-100" : "text-muted-foreground")}>{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient, treatment…" className="pl-9" />
        </div>
      </div>

      {isLoading && <Skeleton className="h-72 rounded-xl" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No enquiries yet"
          description="When patients request a callback from your profile, they'll land here with their condition and preferred call time."
        />
      )}

      {!isLoading && items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {visible.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nothing here right now.</p>}
          <ul className="divide-y divide-border">
            {visible.map((e) => (
              <InboxRow key={e.id} enquiry={e} sla={slaState(e.createdAt, e.status, slaHours, now)} onOpen={() => setOpenId(e.id)} />
            ))}
          </ul>
        </div>
      )}

      <Sheet open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
          {openId && <EnquiryPanel id={openId} slaHours={slaHours} now={now} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InboxRow({
  enquiry: e,
  sla,
  onOpen,
}: {
  enquiry: EnquiryListItem;
  sla: ReturnType<typeof slaState>;
  onOpen: () => void;
}) {
  const unpaid = e.paymentRequired && (!e.payment || ["PENDING", "FAILED"].includes(e.payment.status));
  return (
    <li>
      <button onClick={onOpen} className="flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{e.patient?.name}</p>
            <span className="text-xs text-muted-foreground">
              {e.intent === "SURGERY" ? "Surgery" : "Second opinion"}
              {e.treatment ? ` · ${e.treatment.name}` : ""}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{e.condition}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {e.preferredCallbackWindow}
            </span>
            {e.assignedDoctor && <span>{e.assignedDoctor.user.name}</span>}
            {(e._count?.attachments ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> {e._count!.attachments} report{e._count!.attachments > 1 ? "s" : ""}
              </span>
            )}
            {e.payment?.status === "VERIFIED" && (
              <span className="flex items-center gap-1 font-medium text-green-700">
                <CreditCard className="h-3 w-3" /> Deposit paid
              </span>
            )}
            {unpaid && <span className="text-amber-700">Deposit unpaid</span>}
            <span>Received {formatRelative(e.createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <EnquiryStatusBadge status={e.status} />
          {sla && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", SLA_CHIP[sla.tone])}>{sla.label}</span>}
        </div>
      </button>
    </li>
  );
}

function EnquiryPanel({ id, slaHours, now }: { id: string; slaHours: number; now: number }) {
  const { data: e, isLoading } = useHospitalEnquiry(id);
  const { data: doctors } = useHospitalDoctors();
  const acknowledge = useAcknowledgeEnquiry();
  const assign = useAssignEnquiry();
  const [doctorId, setDoctorId] = React.useState("");

  if (isLoading || !e) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const sla = slaState(e.createdAt, e.status, slaHours, now);
  const canAck = e.status === "NEW";
  const canAssign = e.status === "NEW" || e.status === "ACKNOWLEDGED";

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border p-6 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-bold">{e.patient.name}</h2>
          <EnquiryStatusBadge status={e.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {e.intent === "SURGERY" ? "Surgery consultation" : "Second opinion"}
          {e.treatment ? ` · ${e.treatment.name}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {e.patient.phone && (
            <Button asChild size="sm" variant="outline">
              <a href={`tel:${e.patient.phone}`}>
                <Phone className="h-3.5 w-3.5" /> {e.patient.phone}
              </a>
            </Button>
          )}
          {e.patient.email && (
            <Button asChild size="sm" variant="ghost">
              <a href={`mailto:${e.patient.email}`}>
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            </Button>
          )}
        </div>
        {sla && (
          <p
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
              SLA_CHIP[sla.tone],
            )}
          >
            <Clock className="h-3.5 w-3.5" /> {sla.label} · deadline {formatDateTime(new Date(sla.deadline))}
          </p>
        )}
      </div>

      {(canAck || canAssign) && (
        <div className="space-y-3 border-b border-border bg-primary-50/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-800">Next step</p>
          {canAssign && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="bg-background sm:flex-1">
                  <SelectValue placeholder="Choose a doctor to call the patient" />
                </SelectTrigger>
                <SelectContent>
                  {doctors?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.user.name} — {d.specialisation} · {d.openEnquiries} open
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!doctorId || assign.isPending}
                onClick={() => assign.mutate({ enquiryId: e.id, doctorId }, { onSuccess: () => setDoctorId("") })}
              >
                {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Assign
              </Button>
            </div>
          )}
          {canAck && (
            <Button variant="outline" size="sm" className="bg-background" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(e.id)}>
              {acknowledge.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Acknowledge only — assign later
            </Button>
          )}
        </div>
      )}

      <div className="space-y-6 p-6">
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient's description</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{e.condition}</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> Prefers a call: <span className="font-medium text-foreground">{e.preferredCallbackWindow}</span>
          </p>
        </section>

        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shared reports</p>
          {e.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">None shared.</p>
          ) : (
            <ul className="space-y-1.5">
              {e.attachments.map(({ medicalRecord: r }) => (
                <li key={r.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-primary-600" /> {r.title}
                  <span className="ml-auto text-[11px] uppercase text-muted-foreground">{r.category.replace("_", " ").toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(e.paymentRequired || e.payment) && (
          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deposit</p>
            {e.payment?.status === "VERIFIED" ? (
              <Badge variant="success">
                <CreditCard className="h-3 w-3" /> {formatCurrency(e.payment.amount)} paid
              </Badge>
            ) : e.payment && ["REFUND_INITIATED", "REFUNDED"].includes(e.payment.status) ? (
              <Badge variant="muted">Refunded</Badge>
            ) : (
              <Badge variant="warning">Not paid yet</Badge>
            )}
          </section>
        )}

        {e.callbackNotes && (
          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor's call notes</p>
            <p className="rounded-lg bg-muted/50 p-3 text-sm">{e.callbackNotes}</p>
          </section>
        )}

        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
          {e.statusHistory.length === 0 && <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>}
          <ol className="space-y-3 border-l border-border pl-4">
            {[...e.statusHistory].reverse().map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary-600" />
                <p className="text-sm font-medium">{h.toStatus.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(h.createdAt)}
                  {h.actor ? ` · ${h.actor.name}` : ""}
                </p>
                {h.note && !h.note.startsWith("Seeded") && <p className="mt-0.5 text-sm text-muted-foreground">{h.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
