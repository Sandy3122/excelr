"use client";

import { useRegEvent } from "./reg-event-context";

/**
 * Dark navy footer (spec §3.5 + reference). Reads its copy from the
 * surrounding `RegEventProvider` by default; pages rendered without a
 * provider (e.g. the query-param-driven `/thank-you`) pass `footer` directly.
 */
export default function RegFooter({
  footer,
}: {
  footer?: { copyright: string; location: string };
}) {
  const contextFooter = useRegEvent().footer;
  const { copyright, location } = footer ?? contextFooter;

  return (
    <footer className="bg-navy-900 text-white">
      <div className="mx-auto flex max-w-content flex-col items-center gap-1 px-6 py-5 text-center md:h-[66px] md:flex-row md:justify-between md:gap-0 md:py-0 md:text-left">
        <p className="font-body text-[14px] text-slate-300">{copyright}</p>
        {location ? (
          <p className="font-body text-[14px] text-slate-400">{location}</p>
        ) : null}
      </div>
    </footer>
  );
}
