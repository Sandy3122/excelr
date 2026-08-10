import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Calendar, Clock, MapPin, ArrowRight } from "lucide-react";
import RegNavbar from "@/components/reg/reg-navbar";
import RegFooter from "@/components/reg/reg-footer";
import { EVENT } from "@/lib/reg-content";

export const metadata: Metadata = {
  title: "Thank You — ExcelR's Java Full Stack Placement Drive",
  description:
    "You're registered for ExcelR's Java Full Stack Placement Drive. Check your inbox for confirmation details.",
};

/** Post-registration confirmation page shown after a successful form submit. */
export default function ThankYouPage({
  searchParams,
}: {
  searchParams?: { name?: string };
}) {
  const name = searchParams?.name?.trim();
  const firstName = name?.split(/\s+/)[0];

  return (
    <main className="flex min-h-screen flex-col bg-page">
      <RegNavbar />

      <section className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-16 md:py-24">
        {/* Soft background atmosphere */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#C7D7FE_0%,transparent_55%)]"
        />

        <div className="relative z-10 w-full max-w-xl">
          <div className="rounded-4xl bg-white px-6 py-10 text-center shadow-card-lg md:px-12 md:py-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF2FF]">
              <CheckCircle2 className="h-9 w-9 text-brand-blue" strokeWidth={1.75} />
            </div>

            <h1 className="mt-6 font-heading text-[28px] font-bold leading-tight text-ink md:text-[36px]">
              Thank You{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-3 font-body text-[16px] leading-relaxed text-muted md:text-[17px]">
              You&apos;re successfully registered for{" "}
              <span className="font-semibold text-ink">{EVENT.title}</span>. A
              confirmation email with the venue and reporting time is on its way
              to your inbox.
            </p>

            <div className="mt-8 space-y-3 rounded-2xl bg-[#F0F4FF] px-5 py-5 text-left">
              <p className="font-heading text-[13px] font-semibold uppercase tracking-[0.6px] text-brand-blue">
                Event details
              </p>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 flex-none text-brand-blue" />
                <p className="font-body text-[14px] text-ink">
                  <span className="font-semibold">{EVENT.date}</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 flex-none text-brand-blue" />
                <p className="font-body text-[14px] text-ink">
                  <span className="font-semibold">9:00 AM Onwards</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-brand-blue" />
                <p className="font-body text-[14px] leading-snug text-ink">
                  <span className="font-semibold">ExcelR Marathahalli Campus</span>
                  <span className="mt-0.5 block text-muted">
                    Bengaluru, Karnataka 560037
                  </span>
                </p>
              </div>
            </div>

            <p className="mt-6 font-body text-[13px] leading-relaxed text-faint">
              Please bring your own laptop, resume copies, and a valid photo ID.
            </p>

            <Link
              href="/reg"
              className="btn-gradient mt-8 inline-flex px-7 py-3.5 text-[15px]"
            >
              <span>Back to Home</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      <RegFooter />
    </main>
  );
}
