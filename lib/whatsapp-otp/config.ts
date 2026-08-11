/**
 * Server-side configuration for WhatsApp OTP verification.
 *
 * All values are read from environment variables and are ONLY ever used on the
 * server. None of these are prefixed with NEXT_PUBLIC_, so Infobip credentials
 * can never leak into the client bundle.
 *
 * This module must never be imported from a "use client" component.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** OTP lifecycle knobs. Defaults match the spec (§10–§12). */
export const OTP_EXPIRY_SECONDS = num("WHATSAPP_OTP_EXPIRY_SECONDS", 300);
export const OTP_RESEND_COOLDOWN_SECONDS = num(
  "WHATSAPP_OTP_RESEND_COOLDOWN_SECONDS",
  60,
);
export const OTP_MAX_ATTEMPTS = num("WHATSAPP_OTP_MAX_ATTEMPTS", 5);
/** Max OTP sends allowed per phone number within a rolling hour. */
export const OTP_MAX_SENDS_PER_HOUR = num("WHATSAPP_OTP_MAX_SENDS_PER_HOUR", 5);
/** Max OTP send requests allowed per client IP within a rolling hour. */
export const OTP_MAX_SENDS_PER_IP_PER_HOUR = num(
  "WHATSAPP_OTP_MAX_SENDS_PER_IP_PER_HOUR",
  20,
);
/** How long a successful verification stays valid so /api/reg can consume it. */
export const VERIFIED_TTL_SECONDS = num("WHATSAPP_OTP_VERIFIED_TTL_SECONDS", 900);

/** Default region used to parse local (non-E.164) phone numbers. */
export const DEFAULT_COUNTRY = (
  process.env.WHATSAPP_OTP_DEFAULT_COUNTRY || "IN"
).toUpperCase();

/**
 * Secret used to HMAC the OTP before storage. We never store the raw OTP.
 * A dedicated secret is strongly recommended; if it is missing we fall back to
 * the Infobip API key so hashes are still keyed to something server-only.
 */
export function getHashSecret(): string {
  const secret =
    process.env.WHATSAPP_OTP_HASH_SECRET || process.env.INFOBIP_API_KEY;
  if (!secret) {
    throw new Error(
      "Missing WHATSAPP_OTP_HASH_SECRET (or INFOBIP_API_KEY fallback) for OTP hashing.",
    );
  }
  return secret;
}

export type InfobipConfig = {
  baseUrl: string;
  apiKey: string;
  sender: string;
  templateName: string;
  language: string;
  /**
   * Dynamic URL-button suffix for `fsd_website_otp_11082026`.
   * Empty / "otp" → send the generated OTP (required by the approved template).
   * Any other value is sent literally.
   */
  urlButtonParam: string;
};

/**
 * Reads and validates the Infobip configuration required to SEND a message.
 *
 * Note on `accountKey`: Infobip's WhatsApp send endpoint authenticates purely
 * with the API key (`Authorization: App <apiKey>`). INFOBIP_ACCOUNT_KEY is NOT
 * part of the send request, so it is intentionally not read here. Keeping it in
 * the environment is fine (some Infobip tooling references it), but forcing it
 * into the request would be incorrect.
 */
export function getInfobipConfig(): InfobipConfig {
  const apiKey = process.env.INFOBIP_API_KEY;
  const baseUrlRaw = process.env.INFOBIP_BASE_URL;
  if (!apiKey) throw new Error("Missing INFOBIP_API_KEY.");
  if (!baseUrlRaw) throw new Error("Missing INFOBIP_BASE_URL.");

  // Normalize base URL: allow with/without scheme, strip trailing slash.
  let baseUrl = baseUrlRaw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;

  const buttonParamRaw = (
    process.env.INFOBIP_TEMPLATE_URL_BUTTON_PARAM || ""
  ).trim();

  return {
    baseUrl,
    apiKey,
    sender: process.env.INFOBIP_WHATSAPP_SENDER || "918050162541",
    templateName:
      process.env.INFOBIP_TEMPLATE_NAME || "fsd_website_otp_11082026",
    language: process.env.INFOBIP_TEMPLATE_LANGUAGE || "en_IN",
    urlButtonParam: buttonParamRaw === "" ? "otp" : buttonParamRaw,
  };
}

/** True when Infobip is configured well enough to attempt a real send. */
export function hasInfobipConfig(): boolean {
  return Boolean(process.env.INFOBIP_API_KEY && process.env.INFOBIP_BASE_URL);
}
