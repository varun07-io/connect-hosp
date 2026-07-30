import "dotenv/config";
import { z } from "zod";

/**
 * Parses a boolean env var.
 *
 * NOT z.coerce.boolean(): that applies JS truthiness to the raw string, so the
 * literal "false" becomes `true` (Boolean("false") === true) and a flag can
 * never be switched off from the environment. Accepts only explicit values and
 * rejects anything else, so a typo fails loudly at boot instead of silently
 * defaulting to the wrong (and here, less safe) value.
 */
const booleanFromEnv = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === "true" || v === "1"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),

  // Firebase Admin — used to verify ID tokens minted by the frontend's Firebase Auth.
  // Leave unset in local dev to fall back to the DEV_AUTH_BYPASS mode below.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Dev-only: when true, a request may authenticate via an `x-dev-user` header
  // (a User.id) instead of a real Firebase token. Must never be enabled in production.
  DEV_AUTH_BYPASS: booleanFromEnv(true),

  // Notification providers (Phase 2). Absent => MockNotificationProvider is used.
  MSG91_AUTH_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Storage providers (Phase 2). Absent => LocalDiskStorageProvider is used.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // Signs the expiring download links the LocalDiskStorageProvider issues for
  // the medical-records vault (VLT-06). Any string is fine for local dev; set a
  // long random value in every deployed environment.
  FILE_SIGNING_SECRET: z.string().min(16).default("dev-only-insecure-signing-secret-change-me"),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),

  // Escape hatch for the hosted client demo, which has no Firebase project and
  // therefore relies on the dev-login switcher. Deliberately verbose to name so
  // it can't be enabled by accident or mistaken for a normal setting: turning it
  // on lets ANYONE with the URL sign in as ANY role, including Super Admin.
  // Only ever acceptable against seeded, fake data.
  ALLOW_INSECURE_DEMO_AUTH: booleanFromEnv(false),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && env.DEV_AUTH_BYPASS) {
  if (!env.ALLOW_INSECURE_DEMO_AUTH) {
    console.error(
      "DEV_AUTH_BYPASS must be disabled in production. Refusing to start.\n" +
        "If this is the throwaway client-demo deployment running on seeded fake data, " +
        "set ALLOW_INSECURE_DEMO_AUTH=true to acknowledge the risk explicitly.",
    );
    process.exit(1);
  }
  console.warn(
    "\n*** INSECURE DEMO MODE ***\n" +
      "Dev-login bypass is ACTIVE in production: anyone with the URL can sign in as any\n" +
      "role, including Super Admin. Never point this at real patient data.\n",
  );
}
