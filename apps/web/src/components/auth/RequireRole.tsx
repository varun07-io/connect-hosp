import { Navigate } from "react-router-dom";
import type { Role } from "@connect-hospital/shared";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert } from "lucide-react";

export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { me, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isAuthenticated || !me) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(me.user.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="font-display text-xl font-semibold">Access denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account ({me.user.role.replace("_", " ").toLowerCase()}) doesn't have access to this area.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
