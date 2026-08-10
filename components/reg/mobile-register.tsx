"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import RegistrationForm from "./registration-form";
import GradientButton from "./gradient-button";

/**
 * Mobile registration entry points (Figma hides the inline form card).
 * Hero ice CTA + Event Details orange CTA both open this modal.
 */
export function MobileRegisterTriggers() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-8 flex justify-center md:hidden">
        <GradientButton
          variant="orange"
          className="min-w-[240px] px-8 py-3.5 text-[16px]"
          onClick={() => setOpen(true)}
        >
          Register Now
        </GradientButton>
      </div>
      <MobileRegisterModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function MobileHeroRegisterButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-8 flex justify-start md:hidden">
        <GradientButton
          variant="white"
          className="pl-7 pr-3.5 py-2.5 text-[16px]"
          onClick={() => setOpen(true)}
        >
          Register Now
        </GradientButton>
      </div>
      <MobileRegisterModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function MobileRegisterModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-navy-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-6 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-page p-4 shadow-card-lg sm:max-w-lg sm:rounded-3xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close registration form"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-card"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <span id={titleId} className="sr-only">
          Register for ExcelR Placement Drive
        </span>
        <RegistrationForm />
      </div>
    </div>,
    document.body,
  );
}
