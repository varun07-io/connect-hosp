import type { Auth } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Cheap synchronous check — deliberately does NOT touch the Firebase SDK, so
 *  callers can branch on it without pulling the library into the bundle. */
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let authPromise: Promise<Auth> | null = null;

/**
 * Loads the Firebase SDK on first use and returns its Auth instance, or null
 * when Firebase isn't configured.
 *
 * The SDK is ~177 KB (36 KB gzipped) — the heaviest dependency in the app. It's
 * imported dynamically so it only ever reaches the browser when a real Firebase
 * project is configured; with the dev-login switcher (DEV_AUTH_BYPASS) it is
 * never fetched at all, keeping it off the critical path for first paint.
 */
export async function getFirebaseAuth(): Promise<Auth | null> {
  if (!firebaseConfigured) return null;
  if (!authPromise) {
    authPromise = (async () => {
      const [{ initializeApp }, { getAuth }] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
      return getAuth(initializeApp(config));
    })();
  }
  return authPromise;
}
