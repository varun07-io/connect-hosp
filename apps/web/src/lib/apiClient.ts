import { getFirebaseAuth, firebaseConfigured } from "@/lib/firebase";

const API_URL = import.meta.env.VITE_API_URL;
export const DEV_USER_STORAGE_KEY = "connect-hospital:dev-user-id";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  if (firebaseConfigured) {
    const auth = await getFirebaseAuth();
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
  }
  const devUserId = localStorage.getItem(DEV_USER_STORAGE_KEY);
  return devUserId ? { "x-dev-user": devUserId } : {};
}

/** True for transport-level failures (DNS, connection reset, cold tunnel) as
 *  opposed to a real HTTP response. An ApiError means the server answered —
 *  a 401/403/404 is a genuine answer and must never be retried. */
export function isTransportError(err: unknown): boolean {
  return !(err instanceof ApiError);
}

/** apiFetch, but retrying transport failures with backoff. Used for calls made
 *  outside react-query (e.g. the auth bootstrap) so a single cold-start blip on
 *  a slow link doesn't leave the app permanently stuck in a broken state. */
export async function apiFetchWithRetry<T>(path: string, init?: RequestInit, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await apiFetch<T>(path, init);
    } catch (err) {
      if (!isTransportError(err)) throw err;
      lastError = err;
      if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** The API sends either a string or zod's `flatten()` shape
 *  ({ formErrors: string[], fieldErrors: { field: string[] } }) — turn the
 *  latter into one readable sentence instead of "[object Object]". */
function readableError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const { formErrors = [], fieldErrors = {} } = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const field = Object.entries(fieldErrors).find(([, msgs]) => msgs?.length);
    if (formErrors[0]) return formErrors[0];
    if (field) {
      const label = field[0].replace(/([A-Z])/g, " $1").toLowerCase();
      return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${field[1][0]}`;
    }
  }
  return "Request failed";
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // Only set this when there's actually a body — Fastify's JSON parser
      // rejects an empty body sent with `application/json` (e.g. bodyless
      // PATCH actions like acknowledge), which previously failed silently.
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...authHeader,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, readableError(body.error));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
