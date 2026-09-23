"use client";

import { useRegEvent } from "./reg-event-context";

/** Dark navy footer (spec §3.5 + reference). */
export default function RegFooter() {
  const { footer } = useRegEvent();

  return (
    <footer className="bg-navy-900 text-white">
      <div className="mx-auto flex max-w-content flex-col items-center gap-1 px-6 py-5 text-center md:h-[66px] md:flex-row md:justify-between md:gap-0 md:py-0 md:text-left">
        <p className="font-body text-[14px] text-slate-300">{footer.copyright}</p>
        <p className="font-body text-[14px] text-slate-400">{footer.location}</p>
      </div>
    </footer>
  );
}
