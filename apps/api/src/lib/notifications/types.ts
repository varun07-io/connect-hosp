import type { NotificationChannel } from "@connect-hospital/shared";

export interface SendNotificationParams {
  channel: NotificationChannel;
  /** phone number, email address, or user id depending on channel */
  recipient: string;
  template: string;
  data: Record<string, string>;
}

export interface SendNotificationResult {
  status: "SENT" | "FAILED";
  providerRef?: string;
  error?: string;
}

/** All outbound channels (SMS/WhatsApp/Email/In-app) implement this so call sites
 *  (the BKG enquiry engine, VER decisions, etc.) never know which real provider is behind it. */
export interface NotificationProvider {
  send(params: SendNotificationParams): Promise<SendNotificationResult>;
}
