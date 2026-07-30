import type { NotificationProvider, SendNotificationParams, SendNotificationResult } from "./types.js";

/**
 * Local-dev / no-account stand-in for MSG91 (SMS+WhatsApp) and Resend (email).
 * "Sends" by logging, so the full enquiry -> notify -> dashboard loop is demoable
 * before any provider account exists. Swap via lib/notifications/index.ts once
 * MSG91_AUTH_KEY / RESEND_API_KEY are set in the environment.
 */
export class MockNotificationProvider implements NotificationProvider {
  async send(params: SendNotificationParams): Promise<SendNotificationResult> {
    console.log(
      `[mock-notify] channel=${params.channel} to=${params.recipient} template=${params.template}`,
      params.data,
    );
    return { status: "SENT", providerRef: `mock_${Date.now()}` };
  }
}
