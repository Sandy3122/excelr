"use client";

import type { ChangeEvent } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * WhatsApp phone-number field (10-digit Indian mobile with +91 prefix).
 * OTP verification happens in a modal after the form is submitted.
 */
export default function WhatsAppPhoneField({
  registerProps,
  error,
}: {
  registerProps: UseFormRegisterReturn;
  error?: string;
}) {
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    registerProps.onChange(e);
  };

  return (
    <div>
      <label htmlFor="phone" className="field-label mb-1.5">
        WhatsApp Number
      </label>

      <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white transition-colors focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
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
          className="min-w-0 flex-1 bg-transparent px-3 py-3 font-body text-[15px] text-ink outline-none placeholder:text-faint"
          {...registerProps}
          onChange={handlePhoneChange}
        />
      </div>

      {error && <p className="mt-1 font-body text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
