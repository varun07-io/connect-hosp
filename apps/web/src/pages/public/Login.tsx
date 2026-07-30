import * as React from "react";
import { useNavigate } from "react-router-dom";
import type { ConfirmationResult } from "firebase/auth";
import { Phone, ShieldCheck, Building2, UserRound, Stethoscope, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth, type DevUser } from "@/context/AuthContext";
import { getFirebaseAuth, firebaseConfigured } from "@/lib/firebase";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/roles";
import { initials } from "@/lib/utils";

export function Login() {
  const { isDevMode, devUsers, selectDevUser } = useAuth();
  const navigate = useNavigate();
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  async function handleDevSelect(user: DevUser) {
    if (switchingId) return; // ignore extra clicks mid-switch
    setSwitchingId(user.id);
    try {
      // Await the identity switch before navigating — the destination
      // route's role guard renders immediately on navigate() and would
      // otherwise see no session yet (or briefly, the previous one).
      await selectDevUser(user.id);
      navigate(ROLE_HOME[user.role]);
    } finally {
      setSwitchingId(null);
    }
  }

  if (isDevMode) {
    const grouped = devUsers.reduce<Record<string, DevUser[]>>((acc, u) => {
      (acc[u.role] ??= []).push(u);
      return acc;
    }, {});

    return (
      <div className="container flex min-h-[70vh] flex-col items-center justify-center py-12">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold">Dev login switcher</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            No Firebase project configured yet — pick any seeded account below to explore its dashboard. Set
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">VITE_FIREBASE_*</code> to switch to real
            OTP / staff login.
          </p>
        </div>
        <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {Object.entries(grouped).map(([role, users]) => (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{ROLE_LABEL[role as DevUser["role"]]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleDevSelect(u)}
                    disabled={Boolean(switchingId)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left text-sm hover:bg-muted disabled:cursor-wait disabled:opacity-60"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{initials(u.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.name}</span>
                      {u.hospital && <span className="block truncate text-xs text-muted-foreground">{u.hospital.name}</span>}
                    </span>
                    {switchingId === u.id && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                  </button>
                ))}
                {users.length === 0 && <p className="text-xs text-muted-foreground">None seeded</p>}
              </CardContent>
            </Card>
          ))}
          {devUsers.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              No users yet — run <code className="rounded bg-muted px-1.5 py-0.5">npm run db:seed</code> in
              apps/api.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log in to Connect Hospital</CardTitle>
          <CardDescription>Patients sign in with a mobile OTP. Hospital and platform staff use email & password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="patient">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="patient"><UserRound className="h-4 w-4" /> Patient</TabsTrigger>
              <TabsTrigger value="staff"><Building2 className="h-4 w-4" /> Hospital / Staff</TabsTrigger>
            </TabsList>
            <TabsContent value="patient"><PatientOtpLogin /></TabsContent>
            <TabsContent value="staff"><StaffLogin /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function PatientOtpLogin() {
  const [step, setStep] = React.useState<"phone" | "otp" | "profile">("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const confirmationRef = React.useRef<ConfirmationResult | null>(null);
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const [auth, { RecaptchaVerifier, signInWithPhoneNumber }] = await Promise.all([
        getFirebaseAuth(),
        import("firebase/auth"),
      ]);
      if (!auth) return;
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const formatted = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
      confirmationRef.current = await signInWithPhoneNumber(auth, formatted, verifier);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function confirmOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmationRef.current) return;
    setError(null);
    setLoading(true);
    try {
      await confirmationRef.current.confirm(code);
      // refreshMe awaits a confirmed /api/me before we act on it — same
      // reasoning as the dev switcher: navigating before this resolves lets
      // the destination route's role guard render with no session yet.
      const me = await refreshMe();
      if (me) {
        navigate(ROLE_HOME.PATIENT);
      } else {
        setStep("profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function completeProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/register-patient", { method: "POST", body: JSON.stringify({ name, city }) });
      await refreshMe();
      navigate(ROLE_HOME.PATIENT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete sign-up");
    } finally {
      setLoading(false);
    }
  }

  if (!firebaseConfigured) {
    return <p className="pt-4 text-sm text-muted-foreground">Firebase isn't configured in this environment.</p>;
  }

  return (
    <div className="space-y-4 pt-4">
      {step === "phone" && (
        <form onSubmit={sendOtp} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" required />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP
          </Button>
          <div id="recaptcha-container" />
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={confirmOtp} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="code">Enter the 6-digit code</Label>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify & continue
          </Button>
        </form>
      )}

      {step === "profile" && (
        <form onSubmit={completeProfile} className="space-y-3">
          <p className="text-sm text-muted-foreground">You're verified — tell us a little about you to finish signing up.</p>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Finish sign-up
          </Button>
        </form>
      )}
    </div>
  );
}

function StaffLogin() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const [auth, { signInWithEmailAndPassword }] = await Promise.all([getFirebaseAuth(), import("firebase/auth")]);
      if (!auth) return;
      await signInWithEmailAndPassword(auth, email, password);
      const me = await refreshMe();
      if (me) {
        navigate(ROLE_HOME[me.user.role]);
      } else {
        setError("No Connect Hospital account is linked to this login yet. Ask your Super Admin to provision one.");
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  if (!firebaseConfigured) {
    return <p className="pt-4 text-sm text-muted-foreground">Firebase isn't configured in this environment.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3 pt-4">
      <div className="space-y-1.5">
        <Label htmlFor="staff-email">Work email</Label>
        <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-password">Password</Label>
        <Input id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Stethoscope className="h-4 w-4" /> Sign in
      </Button>
    </form>
  );
}
