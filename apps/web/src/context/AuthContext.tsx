import * as React from "react";
import { flushSync } from "react-dom";
import type { Role } from "@connect-hospital/shared";
import { apiFetch, apiFetchWithRetry, ApiError, DEV_USER_STORAGE_KEY } from "@/lib/apiClient";
import { getFirebaseAuth, firebaseConfigured } from "@/lib/firebase";
import { useQuery } from "@tanstack/react-query";

interface MeResponse {
  user: { id: string; role: Role; hospitalId: string | null; name: string; email: string | null };
  hospital: { id: string; name: string; slug: string; status: string } | null;
}

export interface DevUser {
  id: string;
  name: string;
  role: Role;
  hospitalId: string | null;
  email: string | null;
  hospital: { name: string } | null;
}

interface AuthContextValue {
  me: MeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  devUsers: DevUser[];
  isDevMode: boolean;
  /** Switches to the given seeded account and resolves only once its /api/me
   *  data has been fetched *and* applied to state — callers must await this
   *  before navigating (see fetchMe below for why `flushSync` matters here). */
  selectDevUser: (id: string) => Promise<void>;
  /** Re-fetches /api/me and waits for the result to be applied to state —
   *  call after any real Firebase sign-in before navigating, same reason. */
  refreshMe: () => Promise<MeResponse | null>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseReady, setFirebaseReady] = React.useState(!firebaseConfigured);
  // `me` is deliberately plain state, not a react-query cache value: fetchMe
  // is called from event handlers that immediately navigate() right after
  // awaiting it (dev-login switch, OTP/staff sign-in), and the destination
  // route's role guard reads this same context on its very first render.
  // react-query's cache-update notification reaches this component
  // asynchronously (a render the query lib schedules on its own timing) —
  // awaiting `fetchQuery`'s *promise* does not guarantee that scheduled
  // render has actually committed yet, so the guard could still see the old
  // value for one render. `flushSync` forces the commit before fetchMe
  // returns, so by the time the caller navigates, this component has
  // already re-rendered with fresh data and passed it down through context.
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchMe = React.useCallback(async (): Promise<MeResponse | null> => {
    let result: MeResponse | null;
    try {
      result = await apiFetchWithRetry<MeResponse>("/api/me");
    } catch (err) {
      // 401 is the normal "not signed in" answer. Anything else (including a
      // transport failure that survived all retries) also resolves to "no
      // session" rather than propagating — leaving isLoading stuck true would
      // pin the whole app on a "Loading…" screen with no way out.
      if (!(err instanceof ApiError)) {
        console.error("Could not reach the API to resolve the current session:", err);
      }
      result = null;
    }
    flushSync(() => {
      setMe(result);
      setIsLoading(false);
    });
    return result;
  }, []);

  React.useEffect(() => {
    if (!firebaseReady) return;
    void fetchMe();
    // Only re-run when firebaseReady flips (dev mode: once, true from the
    // start; Firebase mode: once the SDK reports its initial auth state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady]);

  React.useEffect(() => {
    if (!firebaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    // Firebase (and its auth-state listener) is loaded on demand — see
    // getFirebaseAuth. Nothing here runs in dev-switcher mode.
    void (async () => {
      const [auth, { onAuthStateChanged }] = await Promise.all([getFirebaseAuth(), import("firebase/auth")]);
      if (!auth || cancelled) return;
      unsubscribe = onAuthStateChanged(auth, () => {
        setFirebaseReady(true);
        void fetchMe();
      });
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [fetchMe]);

  const devUsersQuery = useQuery({
    queryKey: ["dev-users"],
    queryFn: () => apiFetch<DevUser[]>("/api/dev/users"),
    enabled: !firebaseConfigured,
    // Inherits the transport-aware retry from the QueryClient default — a
    // single cold-start blip must not leave the login page permanently
    // claiming there are no accounts.
    staleTime: Infinity,
  });

  const selectDevUser = React.useCallback(
    async (id: string) => {
      localStorage.setItem(DEV_USER_STORAGE_KEY, id);
      await fetchMe();
    },
    [fetchMe],
  );

  const signOut = React.useCallback(async () => {
    localStorage.removeItem(DEV_USER_STORAGE_KEY);
    const auth = await getFirebaseAuth();
    if (auth) await auth.signOut();
    flushSync(() => setMe(null));
  }, []);

  const value: AuthContextValue = {
    me,
    isLoading,
    isAuthenticated: Boolean(me),
    devUsers: devUsersQuery.data ?? [],
    isDevMode: !firebaseConfigured,
    selectDevUser,
    refreshMe: fetchMe,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
