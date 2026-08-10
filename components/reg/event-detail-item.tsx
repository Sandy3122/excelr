import { Calendar, Clock, MapPin, Users } from "lucide-react";
import type { EventDetail } from "@/lib/reg-content";

/** White card: icon chip + blue uppercase label + value (spec §3.3 + reference). Used 5×. */
export default function EventDetailItem({ detail }: { detail: EventDetail }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-card md:p-5">
      {/* 48×48 rounded icon chip, light-blue bg */}
      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-tint3 text-brand-blue md:h-12 md:w-12">
        <DetailIcon icon={detail.icon} />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="font-body text-[12px] font-semibold uppercase tracking-[0.6px] text-brand-blue">
          {detail.label}
        </p>
        {detail.title && (
          <p className="mt-1 font-body text-[15px] font-semibold text-ink">{detail.title}</p>
        )}
        <p
          className={`mt-1 font-body text-[15px] leading-[1.5] ${
            detail.underlineValue
              ? "text-brand-blue underline decoration-brand-blue/40 underline-offset-2"
              : "font-semibold text-ink"
          }`}
        >
          {detail.value}
        </p>
      </div>
    </div>
  );
}

function DetailIcon({ icon }: { icon: EventDetail["icon"] }) {
  const cls = "h-5 w-5";
  switch (icon) {
    case "calendar":
      return <Calendar className={cls} strokeWidth={2} />;
    case "clock":
      return <Clock className={cls} strokeWidth={2} />;
    case "map-pin":
      return <MapPin className={cls} strokeWidth={2} />;
    case "users":
      return <Users className={cls} strokeWidth={2} />;
    case "rupee":
      // ₹ is a text glyph per the spec (no lucide equivalent)
      return <span className="font-heading text-[20px] font-semibold leading-none">₹</span>;
  }
}
