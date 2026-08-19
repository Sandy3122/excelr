"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import RegistrationForm from "./registration-form";
import GradientButton from "./gradient-button";
import { RegistrationClosedNotice } from "./registration-closed";

/**
 * Mobile registration entry points (Figma hides the inline form card).
 * Hero ice CTA + Event Details orange CTA both open this modal.
 */
export function MobileRegisterTriggers({ closed = false }: { closed?: boolean }) {
  const [open, setOpen] = useState(false);

  if (closed) {
    return (
      <div className="mt-8 md:hidden">
        <RegistrationClosedNotice compact />
      </div>
    );
  }

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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-navy-900/70 backdrop-blur-sm sm:items-center sm:p-6 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-card-lg animate-fade-up sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close registration form"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink transition-colors hover:bg-slate-200"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <span id={titleId} className="sr-only">
          Register for ExcelR Placement Drive
        </span>
        <div className="overflow-y-auto px-5 py-6 sm:px-6">
          <RegistrationForm bare closed={false} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
