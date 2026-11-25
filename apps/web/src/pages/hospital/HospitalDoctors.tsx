import * as React from "react";
import { Loader2, Mail, Pencil, Stethoscope, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHospitalDoctors } from "@/hooks/useApiMutations";
import { useInviteDoctor, useUpdateDoctor, type DoctorInput } from "@/hooks/useHospitalAdmin";
import { SPECIALITY_SUGGESTIONS } from "@/lib/hospitalVocab";
import type { HospitalDoctor } from "@/types/api";
import { initials } from "@/lib/utils";

export function HospitalDoctors() {
  const { data, isLoading } = useHospitalDoctors();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<HospitalDoctor | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doctors"
        description="Doctors you add appear on your public profile and can be assigned enquiries to call back."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add doctor
          </Button>
        }
      />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={Stethoscope}
          title="Add your first doctor"
          description="Patients choose hospitals partly on who will call them. Add at least one doctor per speciality you list."
          action={
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add doctor
            </Button>
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex gap-4 p-5">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{initials(d.user.name.replace(/^Dr\.?\s*/i, ""))}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-semibold">{d.user.name}</p>
                  {d.invitePending && <Badge variant="warning">Invite pending</Badge>}
                </div>
                <p className="text-sm text-primary-700">{d.specialisation}</p>
                <p className="text-xs text-muted-foreground">
                  {d.qualifications} · {d.experienceYears} yrs experience
                </p>
                {d.bio && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{d.bio}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className={d.openEnquiries > 4 ? "font-semibold text-amber-700" : "text-muted-foreground"}>
                    {d.openEnquiries} open {d.openEnquiries === 1 ? "callback" : "callbacks"}
                  </span>
                  {d.user.email && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3 w-3" /> {d.user.email}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Edit ${d.user.name}`} onClick={() => setEditing(d)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <DoctorDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <DoctorDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} doctor={editing ?? undefined} />
    </div>
  );
}

function DoctorDialog({ open, onOpenChange, doctor }: { open: boolean; onOpenChange: (o: boolean) => void; doctor?: HospitalDoctor }) {
  const invite = useInviteDoctor();
  const update = useUpdateDoctor();
  const editing = Boolean(doctor);
  const [form, setForm] = React.useState<DoctorInput>({ name: "", email: "", specialisation: "", qualifications: "", experienceYears: 0, bio: "" });

  React.useEffect(() => {
    if (!open) return;
    setForm(
      doctor
        ? {
            name: doctor.user.name,
            email: doctor.user.email ?? "",
            specialisation: doctor.specialisation,
            qualifications: doctor.qualifications,
            experienceYears: doctor.experienceYears,
            bio: doctor.bio ?? "",
          }
        : { name: "", email: "", specialisation: "", qualifications: "", experienceYears: 0, bio: "" },
    );
  }, [open, doctor]);

  const set = <K extends keyof DoctorInput>(k: K, v: DoctorInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid =
    form.specialisation.trim().length >= 2 &&
    form.qualifications.trim().length >= 2 &&
    (editing || (form.name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(form.email)));
  const pending = invite.isPending || update.isPending;

  function save() {
    const close = { onSuccess: () => onOpenChange(false) };
    const profile = {
      specialisation: form.specialisation.trim(),
      qualifications: form.qualifications.trim(),
      experienceYears: Number(form.experienceYears) || 0,
      bio: form.bio?.trim() || undefined,
    };
    if (doctor) update.mutate({ id: doctor.id, ...profile }, close);
    else invite.mutate({ name: form.name.trim(), email: form.email.trim(), ...profile }, close);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${doctor?.user.name}` : "Add a doctor"}</DialogTitle>
          <DialogDescription>
            {editing ? "Changes show on your public profile immediately." : "We'll email them an invite to sign in and start taking callbacks."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Full name</Label>
                <Input id="d-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Anita Rao" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-email">Work email</Label>
                <Input id="d-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="dr.rao@hospital.in" />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="d-spec">Specialisation</Label>
              <Input id="d-spec" list="speciality-options" value={form.specialisation} onChange={(e) => set("specialisation", e.target.value)} />
              <datalist id="speciality-options">
                {SPECIALITY_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-exp">Experience (yrs)</Label>
              <Input
                id="d-exp"
                type="number"
                min={0}
                max={70}
                value={form.experienceYears}
                onChange={(e) => set("experienceYears", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-qual">Qualifications</Label>
            <Input id="d-qual" value={form.qualifications} onChange={(e) => set("qualifications", e.target.value)} placeholder="MBBS, MS (Ortho)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-bio">Short bio <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="d-bio" rows={3} maxLength={1000} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Focus areas, procedures performed, languages spoken." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || pending} onClick={save}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add & send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
