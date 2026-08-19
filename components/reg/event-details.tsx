import EventDetailItem from "./event-detail-item";
import RegistrationForm from "./registration-form";
import { MobileRegisterTriggers } from "./mobile-register";
import { EVENT_DETAILS } from "@/lib/reg-content";

/**
 * Event Details + Registration (Figma desktop 2-col / mobile stacked).
 * Desktop: form card pulled up to overlap the hero/details transition.
 * Mobile: form card hidden; orange "Register Now" opens a modal.
 *
 * Detail order — desktop: Date → Time → Venue → Salary → Who
 *                mobile:  Date → Time → Venue → Who → Salary
 */
export default function EventDetails({ closed = false }: { closed?: boolean }) {
  return (
    <section id="register" className="scroll-mt-20 bg-gradient-to-b from-[#EEF2FF] via-page to-[#F0F4FF] py-14 md:py-20">
      <div className="mx-auto max-w-content px-5 md:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start md:gap-12 lg:gap-16">
          {/* LEFT — event detail cards */}
          <div>
            <h2 className="font-heading text-[30px] font-bold leading-tight text-ink md:text-[36px]">
              Event Details
            </h2>
            <p className="mt-3 max-w-md font-body text-[16px] leading-[1.6] text-muted md:text-[17px]">
              An intensive placement drive designed to connect Java Full Stack talent
              with the Industry.
            </p>

            <div className="mt-7 flex flex-col gap-4">
              {EVENT_DETAILS.map((detail) => {
                // Desktop: Date Time Venue Salary Who | Mobile: Date Time Venue Who Salary
                const orderClass =
                  {
                    date: "order-1",
                    time: "order-2",
                    venue: "order-3",
                    salary: "order-5 md:order-4",
                    who: "order-4 md:order-5",
                  }[detail.key] ?? "order-6";
                return (
                  <div key={detail.key} className={orderClass}>
                    <EventDetailItem detail={detail} />
                  </div>
                );
              })}
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
