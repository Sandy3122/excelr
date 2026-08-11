"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type Phase = "idle" | "otp" | "verified";

const OTP_LENGTH = 6;
const DEFAULT_COOLDOWN = 60;

/**
 * WhatsApp phone-number field with inline OTP verification.
 *
 * Wraps the existing react-hook-form `phone` input: the user enters a number,
 * requests an OTP over WhatsApp, types the 6-digit code, and verifies. Until the
 * number is verified the parent keeps the submit button disabled.
 *
 * The OTP is never displayed; credentials/OTPs live entirely server-side.
 */
export default function WhatsAppOtpField({
  value,
  registerProps,
  error,
  verified,
  onVerifiedChange,
}: {
  value: string;
  registerProps: UseFormRegisterReturn;
  error?: string;
  verified: boolean;
  onVerifiedChange: (verified: boolean, normalizedPhone: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);

  // The field stores the raw local number; we always send E.164 (+91XXXXXXXXXX).
  const digitsOnly = (value || "").replace(/\D/g, "");
  const phoneComplete = digitsOnly.length === 10;
  const e164Input = phoneComplete ? `+91${digitsOnly}` : "";

  // Resend countdown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setDigits(Array(OTP_LENGTH).fill(""));
    setOtpError(null);
    setInfo(null);
    setResendIn(0);
    if (verified) onVerifiedChange(false, null);
  }, [verified, onVerifiedChange]);

  // If the user edits the phone number, any prior send/verify is invalidated.
  // Keep only digits, capped at the 10-digit Indian mobile length.
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    registerProps.onChange(e);
    if (phase !== "idle" || verified) resetToIdle();
  };

  const sendOtp = async () => {
    setSending(true);
    setOtpError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: e164Input }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        maskedPhone?: string;
        retryAfterSeconds?: number;
      };
      if (!res.ok || !data.success) {
        setOtpError(data.message || "Couldn't send OTP. Please try again.");
        if (data.retryAfterSeconds) setResendIn(data.retryAfterSeconds);
        return;
      }
      setMaskedPhone(data.maskedPhone ?? null);
      setPhase("otp");
      setDigits(Array(OTP_LENGTH).fill(""));
      setInfo(data.message || "OTP sent to your WhatsApp number.");
      setResendIn(data.retryAfterSeconds || DEFAULT_COOLDOWN);
      // Focus the first box on the next tick.
      setTimeout(() => boxRefs.current[0]?.focus(), 0);
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = useCallback(
    async (code: string) => {
      const phoneForApi = `+91${(value || "").replace(/\D/g, "").slice(0, 10)}`;
      setVerifying(true);
      setOtpError(null);
      try {
        const res = await fetch("/api/auth/whatsapp/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: phoneForApi, otp: code }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          verified?: boolean;
          message?: string;
        };
        if (!res.ok || !data.verified) {
          setOtpError(data.message || "Invalid OTP. Please try again.");
          setDigits(Array(OTP_LENGTH).fill(""));
          setTimeout(() => boxRefs.current[0]?.focus(), 0);
          return;
        }
        setPhase("verified");
        setInfo(null);
        onVerifiedChange(true, phoneForApi);
      } catch {
        setOtpError("Network error. Please try again.");
      } finally {
        setVerifying(false);
      }
    },
    [value, onVerifiedChange],
  );

  const setDigit = (index: number, char: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
  };

  const handleBoxChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    if (!char) {
      setDigit(index, "");
      return;
    }
    setDigit(index, char);
    if (index < OTP_LENGTH - 1) boxRefs.current[index + 1]?.focus();

    // Auto-submit when the last box is filled.
    const assembled = digits.map((d, i) => (i === index ? char : d)).join("");
    if (assembled.length === OTP_LENGTH && /^\d{6}$/.test(assembled)) {
      void verifyOtp(assembled);
    }
  };

  const handleBoxKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      boxRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      boxRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      boxRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    const chars = pasted.slice(0, OTP_LENGTH).split("");
    const next = Array(OTP_LENGTH).fill("");
    chars.forEach((c, i) => (next[i] = c));
    setDigits(next);
    const focusIndex = Math.min(chars.length, OTP_LENGTH - 1);
    boxRefs.current[focusIndex]?.focus();
    if (chars.length === OTP_LENGTH) void verifyOtp(chars.join(""));
  };

  return (
    <div>
      <label htmlFor="phone" className="field-label mb-1.5">
        WhatsApp Number
      </label>

      <div className="flex gap-2">
        <div
          className={`flex flex-1 items-stretch overflow-hidden rounded-xl border bg-white transition-colors focus-within:ring-2 focus-within:ring-brand-blue/20 ${
            verified
              ? "border-slate-300 opacity-70"
              : "border-slate-300 focus-within:border-brand-blue"
          }`}
        >
          <span className="flex select-none items-center border-r border-slate-300 bg-slate-50 px-3 font-body text-[15px] font-semibold text-muted">
            +91
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="00000 00000"
            className="min-w-0 flex-1 bg-transparent px-3 py-3 font-body text-[15px] text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
            disabled={verified}
            {...registerProps}
            onChange={handlePhoneChange}
          />
        </div>
        {!verified && (
          <button
            type="button"
            onClick={sendOtp}
            disabled={sending || !phoneComplete}
            className="btn-gradient shrink-0 px-4 py-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : phase === "otp" ? (
              "Resend"
            ) : (
              "Send OTP"
            )}
          </button>
        )}
      </div>

      {error && <p className="mt-1 font-body text-[13px] text-red-600">{error}</p>}

      {verified && (
        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-body text-[13px] font-semibold text-green-600">
            <CheckCircle2 className="h-4 w-4" /> WhatsApp number verified
          </span>
          <button
            type="button"
            onClick={resetToIdle}
            className="font-body text-[13px] text-brand-blue underline underline-offset-2"
          >
            Change number
          </button>
        </div>
      )}

      {phase === "otp" && !verified && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="flex items-center gap-1.5 font-body text-[13px] font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-brand-blue" />
            Enter verification code
          </p>
          <p className="mt-1 font-body text-[13px] text-muted">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-ink">
              {maskedPhone || "your WhatsApp"}
            </span>
            .
          </p>

          <div className="mt-3 flex gap-2" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                disabled={verifying}
                onChange={(e) => handleBoxChange(i, e)}
                onKeyDown={(e) => handleBoxKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white text-center font-heading text-[18px] font-semibold text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
              />
            ))}
          </div>

          {info && !otpError && (
            <p className="mt-2 font-body text-[13px] text-green-600">{info}</p>
          )}
          {otpError && (
            <p className="mt-2 font-body text-[13px] text-red-600">{otpError}</p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => void verifyOtp(digits.join(""))}
              disabled={verifying || digits.join("").length !== OTP_LENGTH}
              className="btn-gradient px-4 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : (
                "Verify OTP"
              )}
            </button>

            {resendIn > 0 ? (
              <span className="font-body text-[13px] text-faint">
                Resend OTP in {resendIn}s
              </span>
            ) : (
              <button
                type="button"
                onClick={sendOtp}
                disabled={sending}
                className="font-body text-[13px] text-brand-blue underline underline-offset-2 disabled:opacity-60"
              >
                Resend OTP
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={resetToIdle}
            className="mt-2 font-body text-[13px] text-muted underline underline-offset-2"
          >
            Change phone number
          </button>
        </div>
      )}
    </div>
  );
}
