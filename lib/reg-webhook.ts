import { firstNameFrom } from "@/lib/first-name";
import type { RegistrationInput } from "@/lib/reg-schema";
import type { PlacementDrive } from "@/lib/drives/types";

const WEBHOOK_TIMEOUT_MS = 4_000;

/**
 * Where a drive's new registrations are posted. Configured per drive; an empty
 * value disables the webhook for that campaign.
 */
export function registrationWebhookUrl(drive: PlacementDrive): string {
  return drive.webhookUrl.trim();
}

export function buildRegistrationWebhookPayload(input: {
  drive: Pick<PlacementDrive, "id" | "slug" | "name" | "eventKey">;
  id: string;
  data: RegistrationInput;
  submittedAt: string;
}) {
  return {
    source: "excelr-placement-drive",
    event: input.drive.eventKey,
    placementDriveId: input.drive.id,
    placementDriveSlug: input.drive.slug,
    placementDriveName: input.drive.name,
    id: input.id,
    fullName: input.data.fullName,
    firstName: firstNameFrom(input.data.fullName),
    email: input.data.email,
    phone: input.data.phone,
    college: input.data.college,
    qualification: input.data.qualification,
    pageUrl: input.data.pageUrl,
    submittedAt: input.submittedAt,
  };
}

/**
 * Notify the drive's webhook of a new registration. Failures are logged only —
 * they must not block Firestore, email, or WhatsApp.
 */
export async function notifyRegistrationWebhook(input: {
  drive: PlacementDrive;
  id: string;
  data: RegistrationInput;
  submittedAt: string;
}): Promise<void> {
  const url = registrationWebhookUrl(input.drive);
  if (!url) return;

  const payload = buildRegistrationWebhookPayload(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[reg] webhook failed:", res.status, body.slice(0, 300));
    }
  } catch (err) {
    console.warn("[reg] webhook error:", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}
