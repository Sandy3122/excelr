"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, ShieldCheck, X } from "lucide-react";

const OTP_LENGTH = 6;
const DEFAULT_COOLDOWN = 60;

type Mode = "otp" | "edit-phone";

/**
 * Modal shown after the registration form is submitted.
 * Sends / verifies WhatsApp OTP and lets the user change the phone number.
 */
export default function OtpVerificationModal({
  open,
  initialPhone,
  registering = false,
  onClose,
  onVerified,
  onPhoneChange,
}: {
  open: boolean;
  /** 10-digit local Indian mobile number from the form. */
  initialPhone: string;
  /** True while the parent is submitting registration after OTP success. */
  registering?: boolean;
  onClose: () => void;
  onVerified: (phone: string) => void | Promise<void>;
  /** Keep the parent form phone field in sync when the user edits here. */
  onPhoneChange: (phone: string) => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("otp");
  const [phone, setPhone] = useState(initialPhone);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [completing, setCompleting] = useState(false);

  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const sentForOpenRef = useRef(false);

  const phoneComplete = phone.length === 10;
  const e164 = phoneComplete ? `+91${phone}` : "";
  const showRegistering = registering || completing;

  useEffect(() => setMounted(true), []);

  const sendOtp = useCallback(async (phoneDigits: string) => {
    if (phoneDigits.length !== 10) return;
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: `+91${phoneDigits}` }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        maskedPhone?: string;
        retryAfterSeconds?: number;
      };
      if (!res.ok || !data.success) {
        setError(data.message || "Couldn't send OTP. Please try again.");
        if (data.retryAfterSeconds) setResendIn(data.retryAfterSeconds);
        return;
      }
      setMaskedPhone(data.maskedPhone ?? null);
      setOtpSent(true);
      setMode("otp");
      setDigits(Array(OTP_LENGTH).fill(""));
      setInfo(data.message || "OTP sent to your WhatsApp number.");
      setResendIn(data.retryAfterSeconds || DEFAULT_COOLDOWN);
      setTimeout(() => boxRefs.current[0]?.focus(), 0);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }, []);

  // Snapshot phone + auto-send only when the modal opens (not when parent syncs phone edits).
  useEffect(() => {
    if (!open) {
      sentForOpenRef.current = false;
      return;
    }
    if (sentForOpenRef.current) return;
    sentForOpenRef.current = true;

    const local = initialPhone.replace(/\D/g, "").slice(0, 10);
    setPhone(local);
    setMode("otp");
    setDigits(Array(OTP_LENGTH).fill(""));
    setError(null);
    setInfo(null);
    setMaskedPhone(null);
    setResendIn(0);
    setOtpSent(false);
    setVerifying(false);
    setSending(false);
    setCompleting(false);

    if (local.length === 10) void sendOtp(local);
    // intentionally only re-run on open toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !showRegistering) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, showRegistering]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const verifyOtp = useCallback(
    async (code: string) => {
      if (!e164) return;
      setVerifying(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/whatsapp/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: e164, otp: code }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          verified?: boolean;
          message?: string;
        };
        if (!res.ok || !data.verified) {
          setError(data.message || "Invalid OTP. Please try again.");
          setDigits(Array(OTP_LENGTH).fill(""));
          setTimeout(() => boxRefs.current[0]?.focus(), 0);
          return;
        }
        // Stay on the completing screen immediately — never flash the form.
        setCompleting(true);
        await Promise.resolve(onVerified(phone));
      } catch {
        setCompleting(false);
        setError("Network error. Please try again.");
      } finally {
        setVerifying(false);
      }
    },
    [e164, phone, onVerified],
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

  const handlePhoneEdit = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(next);
    onPhoneChange(next);
    setError(null);
    setInfo(null);
  };

  const startChangePhone = () => {
    setMode("edit-phone");
    setDigits(Array(OTP_LENGTH).fill(""));
    setError(null);
    setInfo(null);
    setOtpSent(false);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-navy-900/70 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={showRegistering ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-card-lg animate-fade-up sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {!showRegistering && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink transition-colors hover:bg-slate-200"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        )}

        {showRegistering ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
            <p
              id={titleId}
              className="font-heading text-[20px] font-semibold text-ink"
            >
              Completing registration…
            </p>
            <p className="font-body text-[14px] text-muted">
              Please wait. we&apos;re confirming your seat.
            </p>
          </div>
        ) : (
          <>
        <div className="pr-8">
          <p className="flex items-center gap-1.5 font-heading text-[20px] font-semibold text-ink">
            <ShieldCheck className="h-5 w-5 text-brand-blue" />
            <span id={titleId}>Verify WhatsApp</span>
          </p>
          <p className="mt-1 font-body text-[14px] text-muted">
            Enter the 6-digit code we sent to complete registration.
          </p>
        </div>

        {mode === "edit-phone" ? (
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="otp-phone-edit" className="field-label mb-1.5">
                WhatsApp Number
              </label>
              <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
                <span className="flex select-none items-center border-r border-slate-300 bg-slate-50 px-3 font-body text-[15px] font-semibold text-muted">
                  +91
                </span>
                <input
                  id="otp-phone-edit"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  placeholder="00000 00000"
                  value={phone}
                  onChange={handlePhoneEdit}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 font-body text-[15px] text-ink outline-none placeholder:text-faint"
                />
              </div>
            </div>

            {error && (
              <p className="font-body text-[13px] text-red-600">{error}</p>
            )}

            <button
              type="button"
              onClick={() => void sendOtp(phone)}
              disabled={sending || !phoneComplete}
              className="btn-gradient w-full px-4 py-3 text-[15px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                "Send OTP"
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("otp");
                setError(null);
              }}
              disabled={!otpSent}
              className="w-full font-body text-[13px] text-muted underline underline-offset-2 disabled:opacity-40"
            >
              Back to code entry
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <p className="font-body text-[13px] text-muted">
              Code sent to{" "}
              <span className="font-semibold text-ink">
                {maskedPhone || (phoneComplete ? `+91 ${phone}` : "your WhatsApp")}
              </span>
            </p>

            {sending && !otpSent ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-4">
                <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
                <p className="font-body text-[14px] text-muted">Sending OTP…</p>
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-2" onPaste={handlePaste}>
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
                      disabled={verifying || sending}
                      onChange={(e) => handleBoxChange(i, e)}
                      onKeyDown={(e) => handleBoxKeyDown(i, e)}
                      aria-label={`Digit ${i + 1}`}
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white text-center font-heading text-[18px] font-semibold text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
                    />
                  ))}
                </div>

                {info && !error && (
                  <p className="mt-2 font-body text-[13px] text-green-600">{info}</p>
                )}
                {error && (
                  <p className="mt-2 font-body text-[13px] text-red-600">{error}</p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void verifyOtp(digits.join(""))}
                    disabled={
                      verifying ||
                      sending ||
                      digits.join("").length !== OTP_LENGTH
                    }
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
                      onClick={() => void sendOtp(phone)}
                      disabled={sending || !phoneComplete}
                      className="font-body text-[13px] text-brand-blue underline underline-offset-2 disabled:opacity-60"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={startChangePhone}
              className="mt-4 font-body text-[13px] text-muted underline underline-offset-2"
            >
              Change phone number
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
