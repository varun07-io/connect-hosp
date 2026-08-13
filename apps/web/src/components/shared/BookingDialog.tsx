import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { EnquiryIntent } from "@connect-hospital/shared";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useCreateEnquiry } from "@/hooks/useApiMutations";
import { cn } from "@/lib/utils";

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitalId: string;
  hospitalName: string;
  treatments: { id: string; name: string }[];
  defaultIntent: EnquiryIntent;
}

export function BookingDialog({ open, onOpenChange, hospitalId, hospitalName, treatments, defaultIntent }: BookingDialogProps) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const createEnquiry = useCreateEnquiry();

  const [intent, setIntent] = React.useState<EnquiryIntent>(defaultIntent);
  const [treatmentId, setTreatmentId] = React.useState<string>("none");
  const [condition, setCondition] = React.useState("");
  const [callbackWindow, setCallbackWindow] = React.useState("Weekdays, 10am - 1pm");
  const [consent, setConsent] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setIntent(defaultIntent);
      setSubmitted(false);
      createEnquiry.reset();
    }
  }, [open, defaultIntent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me?.user.role !== "PATIENT") return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent || !condition.trim()) return;
    createEnquiry.mutate(
      {
        hospitalId,
        intent,
        treatmentId: treatmentId === "none" ? undefined : treatmentId,
        condition,
        preferredCallbackWindow: callbackWindow,
        consentAccepted: true,
      },
      { onSuccess: () => setSubmitted(true) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <DialogTitle>Enquiry sent to {hospitalName}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              The hospital has been notified. A doctor will call you at your preferred window — track status from
              your dashboard.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={() => navigate("/patient")}>View my enquiries</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{intent === "SURGERY" ? "Book a visit" : "Get a second opinion"}</DialogTitle>
              <DialogDescription>at {hospitalName}. A doctor will call you to guide next steps.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIntent("SURGERY")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    intent === "SURGERY" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border text-muted-foreground",
                  )}
                >
                  Surgery booking
                </button>
                <button
                  type="button"
                  onClick={() => setIntent("SECOND_OPINION")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    intent === "SECOND_OPINION" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border text-muted-foreground",
                  )}
                >
                  Second opinion
                </button>
              </div>

              <div className="space-y-1.5">
                <Label>Treatment (optional)</Label>
                <Select value={treatmentId} onValueChange={setTreatmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a treatment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not sure yet</SelectItem>
                    {treatments.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="condition">Describe your condition</Label>
                <Textarea
                  id="condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="e.g. Persistent knee pain, difficulty walking for 3 months."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="callback-window">Preferred callback window</Label>
                <Input id="callback-window" value={callbackWindow} onChange={(e) => setCallbackWindow(e.target.value)} required />
              </div>

              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input text-primary-600 focus:ring-primary-500"
                />
                I consent to share my details with {hospitalName} so a doctor can call me back.
              </label>

              {createEnquiry.isError && (
                <p className="text-sm text-destructive">Something went wrong — please try again.</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!consent || !condition.trim() || createEnquiry.isPending}>
                {createEnquiry.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit enquiry
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
