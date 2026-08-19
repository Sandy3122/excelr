export default function RegistrationClosedBanner() {
  return (
    <div
      role="status"
      className="border-b border-navy-900/10 bg-navy-900 px-4 py-2.5 text-center text-sm font-medium text-white"
    >
      Registrations for this placement drive are closed. Thank you for your interest.
    </div>
  );
}

export function RegistrationClosedNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white text-center shadow-card ${
        compact ? "px-4 py-5" : "px-6 py-8"
      }`}
    >
      <p className="font-heading text-lg font-bold text-navy-900 md:text-xl">
        Registrations are closed
      </p>
      <p className="mt-2 font-body text-[14px] leading-relaxed text-muted md:text-[15px]">
        Online registration for ExcelR&apos;s Java Full Stack Placement Drive is no
        longer being accepted. If you have already registered, your seat remains
        confirmed.
      </p>
    </div>
  );
}
