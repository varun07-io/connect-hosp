import { env } from "../../env.js";
import { MockNotificationProvider } from "./mockProvider.js";
import type { NotificationProvider } from "./types.js";

// Phase 2: branch to a real MSG91 (SMS+WhatsApp) / Resend (email) adapter here
// once MSG91_AUTH_KEY / RESEND_API_KEY are configured. Until then every
// environment (including prod) safely falls back to the mock so the app never
// crashes for missing provider credentials.
export function getNotificationProvider(): NotificationProvider {
  if (env.MSG91_AUTH_KEY || env.RESEND_API_KEY) {
    console.warn(
      "Notification provider credentials detected but no real adapter is wired up yet — still using MockNotificationProvider.",
    );
  }
  return new MockNotificationProvider();
}

export type { NotificationProvider, SendNotificationParams, SendNotificationResult } from "./types.js";
