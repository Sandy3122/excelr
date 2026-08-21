import { firstNameFrom } from "@/lib/first-name";
import type { RegistrationInput } from "@/lib/reg-schema";

export const DEFAULT_REGISTRATION_N8N_WEBHOOK_URL =
  "https://excelr.app.n8n.cloud/webhook/java-fsd-registration";

const WEBHOOK_TIMEOUT_MS = 4_000;

export function registrationN8nWebhookUrl(): string {
  const fromEnv = process.env.REGISTRATION_N8N_WEBHOOK_URL?.trim();
  if (fromEnv === "") return "";
  return fromEnv || DEFAULT_REGISTRATION_N8N_WEBHOOK_URL;
}

export function buildRegistrationWebhookPayload(input: {
  id: string;
  data: RegistrationInput;
  submittedAt: string;
}) {
  return {
    source: "excelr-placement-drive",
    event: "java-fullstack-placement-drive",
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
 * Notify n8n of a new registration. Failures are logged only — they must not
 * block Firestore, email, or WhatsApp.
 */
export async function notifyRegistrationWebhook(input: {
  id: string;
  data: RegistrationInput;
  submittedAt: string;
}): Promise<void> {
  const url = registrationN8nWebhookUrl();
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
      console.warn(
        "[reg] n8n webhook failed:",
        res.status,
        body.slice(0, 300),
      );
    }
  } catch (err) {
    console.warn(
      "[reg] n8n webhook error:",
      err instanceof Error ? err.message : err,
    );
  } finally {
    clearTimeout(timer);
  }
}
