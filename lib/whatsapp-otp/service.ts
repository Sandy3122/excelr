/**
 * Business logic for the send/verify endpoints, scoped to one placement drive.
 *
 * Expiry, cooldown, attempt caps and rate limits all come from the drive's
 * configuration. Store keys are namespaced by drive id so one campaign's OTP
 * traffic can never consume another's budget or satisfy another's verification.
 *
 * Every result uses a stable machine `code` so the API layer controls the exact
 * wording. Raw OTPs, hashes, API keys and full phone numbers never appear here.
 */

import { hasInfobipConfig } from "./config";
import { generateOtp, hashOtp, isValidOtpFormat, verifyOtp } from "./otp";
import { normalizePhone, type NormalizedPhone } from "./phone";
import { getOtpStore } from "./store";
import { sendWhatsAppOtp } from "./infobip";
import { notifyAdminOfFailure } from "@/lib/reg-admin-alert";
import {
  DriveConfigurationError,
  driveOtpTemplate,
  driveSendConfig,
} from "@/lib/drives/whatsapp";
import type { PlacementDrive } from "@/lib/drives/types";

const HOUR = 3600;

export type SendCode =
  | "SENT"
  | "INVALID_PHONE"
  | "COOLDOWN"
  | "RATE_LIMITED"
  | "SEND_FAILED"
  | "NOT_CONFIGURED"
  | "STORE_UNAVAILABLE";

export type SendOtpResult = {
  ok: boolean;
  code: SendCode;
  /** Normalized phone (present when the phone parsed), for the client to reuse. */
  phone?: NormalizedPhone;
  /** Seconds the caller should wait before the cooldown clears. */
  retryAfterSeconds?: number;
};

export type VerifyCode =
  | "VERIFIED"
  | "STORE_UNAVAILABLE"
  | "INVALID_PHONE"
  | "INVALID_FORMAT"
  | "NO_OTP"
  | "EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "INCORRECT";

export type VerifyOtpResult = {
  ok: boolean;
  code: VerifyCode;
  attemptsRemaining?: number;
};

/**
 * Store keys carry the drive id. Without this, a verification obtained on one
 * campaign's landing page would satisfy another campaign's registration.
 */
/**
 * OTP state lives in Redis. When that is unreachable the request used to throw
 * out of here and surface as a bare 500 with nothing but driver noise in the
 * log - indistinguishable from "the OTP just never arrived". Failures are now
 * named, logged once with the cause, and reported to the caller.
 */
class OtpStoreError extends Error {
  constructor(public readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : "OTP store unavailable");
    this.name = "OtpStoreError";
  }
}

async function store$<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(
      `[whatsapp-otp] OTP store unavailable during "${op}": ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `Check REDIS_URL / UPSTASH_REDIS_REST_URL connectivity.`,
    );
    throw new OtpStoreError(err);
  }
}

function keys(driveId: string, phoneE164: string) {
  return {
    otp: `d:${driveId}:otp:${phoneE164}`,
    verified: `d:${driveId}:verified:${phoneE164}`,
    send: `d:${driveId}:send:${phoneE164}`,
    ip: (ip: string) => `d:${driveId}:ip:${ip}`,
  };
}

/**
 * Generate + send an OTP for a phone number on one drive.
 *
 * @param drive    the campaign the request came from
 * @param rawPhone user-supplied phone string
 * @param clientIp client IP for IP-level rate limiting (may be null/unknown)
 * @param now      injectable clock (ms) for deterministic tests
 */
export async function requestOtp(
  drive: PlacementDrive,
  rawPhone: string,
  clientIp: string | null,
  now: number = Date.now(),
): Promise<SendOtpResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, code: "INVALID_PHONE" };

  if (!hasInfobipConfig()) {
    await notifyAdminOfFailure({
      step: "whatsapp_otp_send",
      reason: "Infobip is not configured (missing API key or base URL).",
      details: { Drive: drive.slug, Phone: phone.masked },
    });
    return { ok: false, code: "NOT_CONFIGURED", phone };
  }

  let template: { templateName: string; urlButtonParam: string };
  let sendConfig;
  try {
    template = driveOtpTemplate(drive);
    sendConfig = driveSendConfig(drive);
  } catch (err) {
    if (err instanceof DriveConfigurationError) {
      console.error("[whatsapp-otp]", err.message);
      await notifyAdminOfFailure({
        step: "whatsapp_otp_send",
        reason: err.message,
        details: { Drive: drive.slug, Field: err.field, Phone: phone.masked },
      });
      return { ok: false, code: "NOT_CONFIGURED", phone };
    }
    throw err;
  }

  const limits = drive.whatsapp.limits;
  const store = getOtpStore();
  const k = keys(drive.id, phone.e164);

  try {
  // IP-level abuse guard (best-effort; skipped when IP is unknown).
  if (clientIp) {
    const ipCount = await store$("ip counter", () =>
      store.incrementCounter(k.ip(clientIp), HOUR),
    );
    if (ipCount > limits.maxSendsPerIpPerHour) {
      return { ok: false, code: "RATE_LIMITED", phone };
    }
  }

  // Per-phone resend cooldown, based on the last successful send.
  const existing = await store$("read record", () => store.getRecord(k.otp));
  if (existing) {
    const elapsed = (now - existing.lastSentAt) / 1000;
    if (elapsed < limits.resendCooldownSeconds) {
      return {
        ok: false,
        code: "COOLDOWN",
        phone,
        retryAfterSeconds: Math.ceil(limits.resendCooldownSeconds - elapsed),
      };
    }
  }

  // Per-phone hourly cap.
  const sendCount = await store$("send counter", () =>
    store.incrementCounter(k.send, HOUR),
  );
  if (sendCount > limits.maxSendsPerHour) {
    return { ok: false, code: "RATE_LIMITED", phone };
  }

  // Generate + hash. A new send always invalidates the previous OTP by
  // overwriting the record (and resetting the attempt counter).
  const otp = generateOtp();
  const record = {
    otpHash: hashOtp(otp),
    expiresAt: now + limits.otpExpirySeconds * 1000,
    attemptCount: 0,
    createdAt: now,
    lastSentAt: now,
  };
  await store$("write record", () =>
    store.setRecord(k.otp, record, limits.otpExpirySeconds),
  );

  const sent = await sendWhatsAppOtp(
    sendConfig,
    phone.infobip,
    otp,
    template.templateName,
    template.urlButtonParam,
  );
  if (!sent.ok) {
    // Roll back the stored record so the user can retry immediately.
    await store.deleteRecord(k.otp).catch(() => {});
    await notifyAdminOfFailure({
      step: "whatsapp_otp_send",
      reason: "Infobip failed to send the WhatsApp OTP template.",
      details: {
        Drive: drive.slug,
        Template: template.templateName,
        Phone: phone.masked,
      },
    });
    return { ok: false, code: "SEND_FAILED", phone };
  }

  // Infobip accepting a template is not the same as WhatsApp delivering it.
  // Log the provider id so a "no OTP arrived" report can be traced in the
  // Infobip portal without reproducing the send.
  console.info(
    `[whatsapp-otp] Infobip accepted OTP for ${phone.masked} ` +
      `(drive=${drive.slug}, template=${template.templateName}` +
      `${sent.providerMessageId ? `, messageId=${sent.providerMessageId}` : ""}).`,
  );

  return { ok: true, code: "SENT", phone };
  } catch (err) {
    if (err instanceof OtpStoreError) {
      return { ok: false, code: "STORE_UNAVAILABLE", phone };
    }
    throw err;
  }
}

/**
 * Verify a submitted OTP. On success the OTP is invalidated and a short-lived
 * verified marker is written so the registration route can trust the phone.
 */
export async function confirmOtp(
  drive: PlacementDrive,
  rawPhone: string,
  submittedOtp: unknown,
  now: number = Date.now(),
): Promise<VerifyOtpResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, code: "INVALID_PHONE" };
  if (!isValidOtpFormat(submittedOtp)) {
    return { ok: false, code: "INVALID_FORMAT" };
  }

  const limits = drive.whatsapp.limits;
  const store = getOtpStore();
  const k = keys(drive.id, phone.e164);

  let record;
  try {
    record = await store$("read record", () => store.getRecord(k.otp));
  } catch {
    return { ok: false, code: "STORE_UNAVAILABLE" };
  }
  if (!record) return { ok: false, code: "NO_OTP" };

  if (record.expiresAt <= now) {
    await store.deleteRecord(k.otp);
    return { ok: false, code: "EXPIRED" };
  }

  if (record.attemptCount >= limits.maxVerifyAttempts) {
    await store.deleteRecord(k.otp);
    return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  }

  const matches = verifyOtp(submittedOtp, record.otpHash);
  if (!matches) {
    const attemptCount = record.attemptCount + 1;
    const remaining = limits.maxVerifyAttempts - attemptCount;
    if (remaining <= 0) {
      await store.deleteRecord(k.otp);
      return { ok: false, code: "TOO_MANY_ATTEMPTS", attemptsRemaining: 0 };
    }
    const ttl = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));
    await store.setRecord(k.otp, { ...record, attemptCount }, ttl);
    return { ok: false, code: "INCORRECT", attemptsRemaining: remaining };
  }

  // Success - single-use: destroy the OTP and mark the phone verified.
  await store.deleteRecord(k.otp);
  await store.setVerified(k.verified, limits.verifiedTtlSeconds);
  return { ok: true, code: "VERIFIED" };
}

/**
 * Non-destructively check whether a phone holds a verified marker for this
 * drive. Used by /api/reg to gate a submission before doing any work.
 */
export async function isPhoneVerified(
  drive: PlacementDrive,
  rawPhone: string,
): Promise<{ verified: boolean; phone: NormalizedPhone | null }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { verified: false, phone: null };
  const verified = await getOtpStore().isVerified(
    keys(drive.id, phone.e164).verified,
  );
  return { verified, phone };
}

/**
 * Consume the verified marker (used by /api/reg once the registration has
 * succeeded). Returns true exactly once per verification.
 */
export async function consumePhoneVerification(
  drive: PlacementDrive,
  rawPhone: string,
): Promise<{ verified: boolean; phone: NormalizedPhone | null }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { verified: false, phone: null };
  const verified = await getOtpStore().consumeVerified(
    keys(drive.id, phone.e164).verified,
  );
  return { verified, phone };
}
