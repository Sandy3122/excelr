"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { registrationSchema, type RegistrationInput } from "@/lib/reg-schema";
import { EVENT, QUALIFICATION_OPTIONS } from "@/lib/reg-content";

type Status = "idle" | "submitting" | "success" | "error";

export default function RegistrationForm({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: RegistrationInput) => {
    setStatus("submitting");
    setServerError(null);
    try {
      const res = await fetch("/api/reg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
      reset();
    } catch (err) {
      setStatus("error");
      setServerError(err instanceof Error ? err.message : "Registration failed.");
    }
  };

  if (status === "success") {
    return (
      <div className={`rounded-4xl bg-white p-8 shadow-card-lg md:p-10 ${className}`}>
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 className="h-14 w-14 text-brand-blue" strokeWidth={1.75} />
          <h2 className="mt-4 font-heading text-[24px] font-semibold text-ink">
            You&apos;re registered!
          </h2>
          <p className="mt-2 max-w-sm font-body text-[15px] leading-relaxed text-muted">
            Thanks for signing up for ExcelR&apos;s Placement Drive. A confirmation
            email with the venue and reporting time is on its way to your inbox.
          </p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="mt-6 font-body text-[14px] font-semibold text-brand-blue hover:underline"
          >
            Register another candidate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-4xl bg-white p-6 shadow-card-lg md:p-10 ${className}`}>
      <div className="mb-6">
        <h2 className="font-heading text-[24px] font-semibold text-ink">Register Now</h2>
        <p className="mt-1 font-body text-[15px] text-muted">To Secure Your Career</p>
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

        <Field label="Phone Number" htmlFor="phone" error={errors.phone?.message}>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+91 00000 00000"
            className="field-input"
            {...register("phone")}
          />
        </Field>

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
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2362748E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")",
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
          disabled={status === "submitting"}
          className="btn-gradient w-full px-6 py-4 text-[16px] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Registering…</span>
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
