"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { registrationFormSchema, type RegistrationFormInput, type RegistrationInput } from "@/lib/reg-schema";
import { EVENT, QUALIFICATION_OPTIONS } from "@/lib/reg-content";
import WhatsAppPhoneField from "./whatsapp-phone-field";
import OtpVerificationModal from "./otp-verification-modal";
import { RegistrationClosedNotice } from "./registration-closed";

type Status = "idle" | "awaiting-otp" | "submitting" | "error";

function currentPageUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

export default function RegistrationForm({
  className = "",
  bare = false,
  closed = false,
}: {
  className?: string;
  /** Render without the card chrome (bg/rounded/shadow/padding) — e.g. inside the mobile modal, which supplies its own card. */
  bare?: boolean;
  closed?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<RegistrationFormInput | null>(
    null,
  );
  const [phoneVerified, setPhoneVerified] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<RegistrationFormInput>({
    resolver: zodResolver(registrationFormSchema),
    mode: "onTouched",
  });

  const phoneValue = watch("phone") || "";

  const registerUser = useCallback(
    async (values: RegistrationFormInput, { keepModal = false } = {}) => {
      if (closed) return;
      setStatus("submitting");
      setServerError(null);
      const payload: RegistrationInput = {
        ...values,
        pageUrl: currentPageUrl(),
      };
      try {
        const res = await fetch("/api/reg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Something went wrong. Please try again.");
        }
        const params = new URLSearchParams({ name: values.fullName });
        router.replace(`/reg/thank-you?${params.toString()}`);
      } catch (err) {
        if (keepModal) setOtpOpen(false);
        setStatus("error");
        setServerError(
          err instanceof Error ? err.message : "Registration failed.",
        );
      }
    },
    [router, closed],
  );

  const onSubmit = async (values: RegistrationFormInput) => {
    if (closed) return;
    setServerError(null);

    // If this number was already verified (e.g. register failed after OTP),
    // skip the OTP step and submit directly.
    if (phoneVerified) {
      setPendingValues(values);
      await registerUser(values);
      return;
    }

    setPendingValues(values);
    setStatus("awaiting-otp");
    setOtpOpen(true);
  };

  const handleOtpVerified = useCallback(
    async (verifiedPhone: string) => {
      setPhoneVerified(true);
      setValue("phone", verifiedPhone, { shouldValidate: true });

      const values: RegistrationFormInput = {
        ...(pendingValues ?? getValues()),
        phone: verifiedPhone,
      };
      setPendingValues(values);
      // Keep the OTP modal open with a registering state — do not flash the form.
      await registerUser(values, { keepModal: true });
    },
    [pendingValues, getValues, setValue, registerUser],
  );

  const handlePhoneChangeFromModal = useCallback(
    (phone: string) => {
      setPhoneVerified(false);
      setValue("phone", phone, { shouldValidate: true, shouldDirty: true });
      setPendingValues((prev) => (prev ? { ...prev, phone } : prev));
    },
    [setValue],
  );

  const handleCloseOtp = useCallback(() => {
    // Don't dismiss while registration is in flight after OTP success.
    if (status === "submitting") return;
    setOtpOpen(false);
    setStatus("idle");
  }, [status]);

  const isBusy = status === "awaiting-otp" || status === "submitting";

  return (
    <div
      className={
        bare
          ? `relative ${className}`
          : `relative min-h-[28rem] rounded-4xl bg-white p-6 shadow-card-lg md:p-10 ${className}`
      }
    >
      <div
        className={closed ? "pointer-events-none select-none blur-[2.5px] opacity-40" : ""}
        aria-hidden={closed}
      >
      <div className="mb-6">
        <h2 className="font-heading text-[24px] font-semibold text-ink">
          Register Now
        </h2>
        <p className="mt-1 font-body text-[15px] text-muted">
          To Secure Your Career
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Full Name" htmlFor="fullName" error={errors.fullName?.message}>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Name"
            className="field-input"
            {...register("fullName")}
          />
        </Field>

        <Field label="Email Address" htmlFor="email" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="xyz@example.com"
            className="field-input"
            {...register("email")}
          />
        </Field>

        <WhatsAppPhoneField
          registerProps={register("phone", {
            onChange: () => {
              // Editing the form phone after a prior verify invalidates it.
              setPhoneVerified(false);
            },
          })}
          error={errors.phone?.message}
        />

        <Field
          label="College / University"
          htmlFor="college"
          error={errors.college?.message}
        >
          <input
            id="college"
            type="text"
            autoComplete="organization"
            placeholder="College Name"
            className="field-input"
            {...register("college")}
          />
        </Field>

        <Field
          label="Highest Qualification"
          htmlFor="qualification"
          error={errors.qualification?.message}
        >
          <select
            id="qualification"
            defaultValue=""
            className="field-input appearance-none bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
            style={{
              backgroundImage:
                'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2362748E\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'></polyline></svg>")',
            }}
            {...register("qualification")}
          >
            <option value="" disabled>
              Select qualification
            </option>
            {QUALIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        {status === "error" && serverError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 font-body text-[14px] text-red-600">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isBusy}
          className="btn-gradient w-full px-6 py-4 text-[16px] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Registering…</span>
            </>
          ) : status === "awaiting-otp" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verify to continue…</span>
            </>
          ) : (
            <>
              <span>Register for Free</span>
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
            </>
          )}
        </button>

        <p className="pt-1 font-body text-[13px] leading-[1.5] text-faint">
          {EVENT.laptopNote}
        </p>
      </form>
      </div>

      {closed ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-5">
          <RegistrationClosedNotice compact={bare} />
        </div>
      ) : (
        <OtpVerificationModal
          open={otpOpen}
          initialPhone={pendingValues?.phone || phoneValue}
          registering={status === "submitting"}
          onClose={handleCloseOtp}
          onVerified={handleOtpVerified}
          onPhoneChange={handlePhoneChangeFromModal}
        />
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 font-body text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
