import type { SendCode, VerifyCode } from "./service";

/** Extract the best-effort client IP from proxy headers (Vercel/standard). */
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

/** User-facing copy for send-otp outcomes (spec §15). Never leaks internals. */
export const SEND_MESSAGES: Record<SendCode, string> = {
  SENT: "OTP sent to your WhatsApp number.",
  INVALID_PHONE: "Please enter a valid WhatsApp number.",
  COOLDOWN: "Please wait before requesting another OTP.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  SEND_FAILED: "We couldn't send the OTP right now. Please try again shortly.",
  NOT_CONFIGURED:
    "WhatsApp verification is temporarily unavailable. Please try again later.",
};

/** User-facing copy for verify-otp outcomes (spec §15). */
export const VERIFY_MESSAGES: Record<VerifyCode, string> = {
  VERIFIED: "Your WhatsApp number is verified.",
  INVALID_PHONE: "Please enter a valid WhatsApp number.",
  INVALID_FORMAT: "Please enter the 6-digit code.",
  NO_OTP: "This OTP has expired. Please request a new one.",
  EXPIRED: "This OTP has expired. Please request a new one.",
  TOO_MANY_ATTEMPTS:
    "Too many incorrect attempts. Please request a new OTP.",
  INCORRECT: "Invalid OTP. Please try again.",
};

/** HTTP status for each send outcome. */
export function sendStatus(code: SendCode): number {
  switch (code) {
    case "SENT":
      return 200;
    case "INVALID_PHONE":
      return 400;
    case "COOLDOWN":
    case "RATE_LIMITED":
      return 429;
    case "SEND_FAILED":
    case "NOT_CONFIGURED":
      return 502;
  }
}

/** HTTP status for each verify outcome. */
export function verifyStatus(code: VerifyCode): number {
  switch (code) {
    case "VERIFIED":
      return 200;
    case "INVALID_PHONE":
    case "INVALID_FORMAT":
      return 400;
    case "NO_OTP":
    case "EXPIRED":
    case "INCORRECT":
      return 400;
    case "TOO_MANY_ATTEMPTS":
      return 429;
  }
}
