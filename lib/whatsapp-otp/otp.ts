import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { getHashSecret } from "./config";

/**
 * Secure OTP primitives. All functions here run server-side only.
 *
 * - OTP is generated with crypto.randomInt (CSPRNG), never Math.random.
 * - OTP is never stored in plain text — only an HMAC-SHA256 hash is persisted.
 * - Comparison is constant-time to avoid timing side channels.
 */

/** Generate a cryptographically secure 6-digit numeric OTP as a string. */
export function generateOtp(): string {
  // randomInt(max) is uniform over [0, max) and uses a CSPRNG.
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/** HMAC-SHA256 the OTP with the server secret. Returns hex digest. */
export function hashOtp(otp: string): string {
  return createHmac("sha256", getHashSecret()).update(otp).digest("hex");
}

/**
 * Constant-time comparison of a submitted OTP against a stored hash.
 * Returns false on any length/format mismatch without leaking timing.
 */
export function verifyOtp(submitted: string, storedHash: string): boolean {
  const submittedHash = hashOtp(submitted);
  const a = Buffer.from(submittedHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** True when the value is exactly six ASCII digits. */
export function isValidOtpFormat(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}
