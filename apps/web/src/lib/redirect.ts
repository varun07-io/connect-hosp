import type { Role } from "@connect-hospital/shared";
import { ROLE_HOME } from "@/lib/roles";

/** Where to go after sign-in. Honours a `?next=` path (set when a logged-out
 *  user tried to book, or hit a protected page) as long as it is a same-site
 *  path the role can actually use — otherwise falls back to the role's home. */
export function postLoginPath(role: Role, next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return ROLE_HOME[role];
  const isPublic = next.startsWith("/hospitals/") || next.startsWith("/search") || next === "/";
  if (isPublic && role === "PATIENT") return next;
  if (next.startsWith(ROLE_HOME[role])) return next;
  return ROLE_HOME[role];
}

export function loginPathFor(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}
