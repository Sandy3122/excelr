import {
  OTP_EXPIRY_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_MAX_SENDS_PER_IP_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
  VERIFIED_TTL_SECONDS,
  hasInfobipConfig,
} from "./config";
import { generateOtp, hashOtp, isValidOtpFormat, verifyOtp } from "./otp";
import { normalizePhone, type NormalizedPhone } from "./phone";
import { getOtpStore } from "./store";
import { sendWhatsAppOtp } from "./infobip";

/**
 * Business logic for the send/verify endpoints. Route handlers stay thin and
 * only translate these typed results into HTTP responses + user-facing copy.
 *
 * Every result uses a stable machine `code` so the API layer controls the exact
 * wording. Raw OTPs, hashes, API keys and full phone numbers never appear here.
 */

const HOUR = 3600;

export type SendCode =
  | "SENT"
  | "INVALID_PHONE"
  | "COOLDOWN"
  | "RATE_LIMITED"
  | "SEND_FAILED"
  | "NOT_CONFIGURED";

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
 * Generate + send an OTP for a phone number.
 *
 * @param rawPhone user-supplied phone string
 * @param clientIp client IP for IP-level rate limiting (may be null/unknown)
 * @param now      injectable clock (ms) for deterministic tests
 */
export async function requestOtp(
  rawPhone: string,
  clientIp: string | null,
  now: number = Date.now(),
): Promise<SendOtpResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, code: "INVALID_PHONE" };

  if (!hasInfobipConfig()) {
    return { ok: false, code: "NOT_CONFIGURED", phone };
  }

  const store = getOtpStore();

  // IP-level abuse guard (best-effort; skipped when IP is unknown).
  if (clientIp) {
    const ipCount = await store.incrementCounter(`ip:${clientIp}`, HOUR);
    if (ipCount > OTP_MAX_SENDS_PER_IP_PER_HOUR) {
      return { ok: false, code: "RATE_LIMITED", phone };
    }
  }

  // Per-phone resend cooldown, based on the last successful send.
  const existing = await store.getRecord(phone.e164);
  if (existing) {
    const elapsed = (now - existing.lastSentAt) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        code: "COOLDOWN",
        phone,
        retryAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed),
      };
    }
  }

  // Per-phone hourly cap.
  const sendCount = await store.incrementCounter(`send:${phone.e164}`, HOUR);
  if (sendCount > OTP_MAX_SENDS_PER_HOUR) {
    return { ok: false, code: "RATE_LIMITED", phone };
  }

  // Generate + hash. A new send always invalidates the previous OTP by
  // overwriting the record (and resetting the attempt counter).
  const otp = generateOtp();
  const record = {
    otpHash: hashOtp(otp),
    expiresAt: now + OTP_EXPIRY_SECONDS * 1000,
    attemptCount: 0,
    createdAt: now,
    lastSentAt: now,
  };
  await store.setRecord(phone.e164, record, OTP_EXPIRY_SECONDS);

  const sent = await sendWhatsAppOtp(phone.infobip, otp);
  if (!sent.ok) {
    // Roll back the stored record so the user can retry immediately.
    await store.deleteRecord(phone.e164);
    return { ok: false, code: "SEND_FAILED", phone };
  }

  return { ok: true, code: "SENT", phone };
}

/**
 * Verify a submitted OTP. On success the OTP is invalidated and a short-lived
 * verified marker is written so the registration route can trust the phone.
 */
export async function confirmOtp(
  rawPhone: string,
  submittedOtp: unknown,
  now: number = Date.now(),
): Promise<VerifyOtpResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, code: "INVALID_PHONE" };
  if (!isValidOtpFormat(submittedOtp)) {
    return { ok: false, code: "INVALID_FORMAT" };
  }

  const store = getOtpStore();
  const record = await store.getRecord(phone.e164);
  if (!record) return { ok: false, code: "NO_OTP" };

  if (record.expiresAt <= now) {
    await store.deleteRecord(phone.e164);
    return { ok: false, code: "EXPIRED" };
  }

  if (record.attemptCount >= OTP_MAX_ATTEMPTS) {
    await store.deleteRecord(phone.e164);
    return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  }

  const matches = verifyOtp(submittedOtp, record.otpHash);
  if (!matches) {
    const attemptCount = record.attemptCount + 1;
    const remaining = OTP_MAX_ATTEMPTS - attemptCount;
    if (remaining <= 0) {
      await store.deleteRecord(phone.e164);
      return { ok: false, code: "TOO_MANY_ATTEMPTS", attemptsRemaining: 0 };
    }
    const ttl = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));
    await store.setRecord(phone.e164, { ...record, attemptCount }, ttl);
    return { ok: false, code: "INCORRECT", attemptsRemaining: remaining };
  }

  // Success — single-use: destroy the OTP and mark the phone verified.
  await store.deleteRecord(phone.e164);
  await store.setVerified(phone.e164, VERIFIED_TTL_SECONDS);
  return { ok: true, code: "VERIFIED" };
}

/**
 * Non-destructively check whether a phone currently holds a verified marker.
 * Used by /api/reg to gate a submission before doing any work.
 */
export async function isPhoneVerified(
  rawPhone: string,
): Promise<{ verified: boolean; phone: NormalizedPhone | null }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { verified: false, phone: null };
  const verified = await getOtpStore().isVerified(phone.e164);
  return { verified, phone };
}

/**
 * Consume the verified marker for a phone (used by /api/reg once the
 * registration has succeeded). Returns true exactly once per verification.
 */
export async function consumePhoneVerification(
  rawPhone: string,
): Promise<{ verified: boolean; phone: NormalizedPhone | null }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { verified: false, phone: null };
  const verified = await getOtpStore().consumeVerified(phone.e164);
  return { verified, phone };
}
