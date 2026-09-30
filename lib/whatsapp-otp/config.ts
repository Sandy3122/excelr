/**
 * Account-level Infobip settings.
 *
 * These belong to the Infobip *account*, not to any one campaign: the API key,
 * base URL, the WhatsApp sender, the template language, and the OTP template.
 * Swapping Infobip accounts is an environment change, not a data migration.
 *
 * Campaign-shaped values — which automations run, when they fire, which
 * template each one sends, expiry, cooldowns and rate limits — live on the
 * placement drive and are edited in the admin panel.
 *
 * Where the two overlap, a drive that leaves a field blank inherits the
 * account default, so a new campaign works immediately and can still override.
 *
 * Server-only. Never import from a "use client" component.
 */

import { AUTOMATION_KINDS, type AutomationKind } from "@/lib/automations/types";

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

export type InfobipAccount = {
  baseUrl: string;
  apiKey: string;
  /** Account default sender; a drive may override it. */
  defaultSender: string;
};

/**
 * Note on `accountKey`: Infobip's WhatsApp send endpoint authenticates purely
 * with the API key (`Authorization: App <apiKey>`). INFOBIP_ACCOUNT_KEY is NOT
 * part of the send request, so it is intentionally not read here.
 */
export function getInfobipAccount(): InfobipAccount {
  const apiKey = process.env.INFOBIP_API_KEY;
  const baseUrlRaw = process.env.INFOBIP_BASE_URL;
  if (!apiKey) throw new Error("Missing INFOBIP_API_KEY.");
  if (!baseUrlRaw) throw new Error("Missing INFOBIP_BASE_URL.");

  // Normalize base URL: allow with/without scheme, strip trailing slash.
  let baseUrl = baseUrlRaw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;

  return {
    baseUrl,
    apiKey,
    defaultSender: (process.env.INFOBIP_WHATSAPP_SENDER || "").trim(),
  };
}

/** True when Infobip is configured well enough to attempt a real send. */
export function hasInfobipConfig(): boolean {
  return Boolean(process.env.INFOBIP_API_KEY && process.env.INFOBIP_BASE_URL);
}

const env = (name: string): string => (process.env[name] || "").trim();

/**
 * Account-wide WhatsApp defaults. A drive inherits any of these it leaves
 * blank, and a newly created drive is seeded from them so the admin sees real
 * values rather than empty boxes.
 */
export type WhatsAppAccountDefaults = {
  sender: string;
  language: string;
  otpTemplateName: string;
  otpUrlButtonParam: string;
  /** Starting template per automation, used when a drive is created. */
  automationTemplates: Record<AutomationKind, string>;
};

export function whatsappAccountDefaults(): WhatsAppAccountDefaults {
  return {
    sender: env("INFOBIP_WHATSAPP_SENDER"),
    language: env("INFOBIP_TEMPLATE_LANGUAGE") || "en_IN",
    otpTemplateName: env("INFOBIP_TEMPLATE_NAME"),
    otpUrlButtonParam: env("INFOBIP_TEMPLATE_URL_BUTTON_PARAM") || "otp",
    automationTemplates: {
      welcome: env("INFOBIP_CONFIRMATION_TEMPLATE_NAME"),
      things_to_carry: env("INFOBIP_THINGS_TO_CARRY_TEMPLATE_NAME"),
      reminder_day_before: env("INFOBIP_REMINDER_DAY_BEFORE_TEMPLATE_NAME"),
      reminder_event_day: env("INFOBIP_REMINDER_EVENT_DAY_TEMPLATE_NAME"),
    },
  };
}

/** Names of the account-level variables, for the admin panel's read-out. */
export const ACCOUNT_DEFAULT_ENV_VARS = {
  sender: "INFOBIP_WHATSAPP_SENDER",
  language: "INFOBIP_TEMPLATE_LANGUAGE",
  otpTemplateName: "INFOBIP_TEMPLATE_NAME",
  otpUrlButtonParam: "INFOBIP_TEMPLATE_URL_BUTTON_PARAM",
} as const;

export { AUTOMATION_KINDS };

/** Resolved per-send configuration: account credentials + drive settings. */
export type InfobipSendConfig = {
  baseUrl: string;
  apiKey: string;
  sender: string;
  language: string;
};
