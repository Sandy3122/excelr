"use client";

import type { LucideIcon } from "lucide-react";
import { SlidersHorizontal } from "lucide-react";

export function MobileToolbarButton({
  label,
  badge,
  icon: Icon = SlidersHorizontal,
  onClick,
}: {
  label: string;
  badge?: number;
  icon?: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
      {badge ? (
        <span className="rounded-full bg-navy-900 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
