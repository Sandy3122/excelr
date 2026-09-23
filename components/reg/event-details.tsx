"use client";

import EventDetailItem from "./event-detail-item";
import RegistrationForm from "./registration-form";
import { MobileRegisterTriggers } from "./mobile-register";
import { useRegEvent } from "./reg-event-context";

/**
 * Event Details + Registration (Figma desktop 2-col / mobile stacked).
 * Desktop: form card pulled up to overlap the hero/details transition.
 * Mobile: form card hidden; orange "Register Now" opens a modal.
 *
 * Cards follow the config's array order on desktop; an item may override its
 * mobile position with `mobileOrder` (the original drive swaps Salary / Who).
 */
export default function EventDetails({ closed = false }: { closed?: boolean }) {
  const { details } = useRegEvent();

  return (
    <section id="register" className="scroll-mt-20 bg-gradient-to-b from-[#EEF2FF] via-page to-[#F0F4FF] py-14 md:py-20">
      <div className="mx-auto max-w-content px-5 md:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start md:gap-12 lg:gap-16">
          {/* LEFT — event detail cards */}
          <div>
            <h2 className="font-heading text-[30px] font-bold leading-tight text-ink md:text-[36px]">
              {details.heading}
            </h2>
            <p className="mt-3 max-w-md font-body text-[16px] leading-[1.6] text-muted md:text-[17px]">
              {details.intro}
            </p>

            <div className="mt-7 flex flex-col gap-4">
              {details.items.map((detail, i) => (
                <div
                  key={detail.key}
                  className={`${ORDER[(detail.mobileOrder ?? i + 1) - 1]} ${MD_ORDER[i]}`}
                >
                  <EventDetailItem detail={detail} />
                </div>
              ))}
            </div>

            <MobileRegisterTriggers closed={closed} />
          </div>

          {/* RIGHT — registration form card (desktop only), top-aligned with Event Details */}
          <div className="relative z-20 hidden md:block">
            <RegistrationForm closed={closed} />
          </div>
        </div>
      </div>
    </section>
  );
}

// Listed literally so Tailwind keeps these classes in the build.
const ORDER = [
  "order-1",
  "order-2",
  "order-3",
  "order-4",
  "order-5",
  "order-6",
  "order-7",
  "order-8",
];
const MD_ORDER = [
  "md:order-1",
  "md:order-2",
  "md:order-3",
  "md:order-4",
  "md:order-5",
  "md:order-6",
  "md:order-7",
  "md:order-8",
];
