import Image from "next/image";
import GlowBlobs from "./glow-blobs";
import FreeBadge from "./free-badge";
import { MobileHeroRegisterButton } from "./mobile-register";
import { EVENT } from "@/lib/reg-content";

/**
 * Hero / banner — matches Figma Desktop (8:889) + Mobile (1:508):
 * - Desktop: 2-col, left-aligned copy, student photo right. No CTA (form is inline).
 * - Mobile: stacked, center-aligned; ice-gradient "Register Now" + note + FREE badge.
 */
export default function RegHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0A0F27] via-navy-900 to-[#1A1A4A] text-white">
      <GlowBlobs />

      <div className="relative mx-auto max-w-content px-6 py-12 md:py-16 lg:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          {/* LEFT — copy (left-aligned on both breakpoints, per design) */}
          <div className="animate-fade-up">
            <h1 className="font-heading font-bold leading-[1.05] tracking-[-1px] text-[40px] md:text-[56px] md:tracking-[-1.5px] lg:text-[68px]">
              <span className="block text-white">ExcelR&apos;s</span>
              <span className="block">
                <span className="text-white">Placement </span>
                <span className="text-[#A5B4FC]">Drive</span>
              </span>
            </h1>

            {/* "For Java Full Stack" — solid blue pill */}
            <div className="mt-5 inline-block rounded-xl border border-white/20 bg-[#2545D1] px-5 py-2.5 shadow-lg shadow-black/25">
              <span className="font-heading font-bold text-white text-[22px] md:text-[30px] lg:text-[34px]">
                {EVENT.role}
              </span>
            </div>

            {/* accent underline bar */}
            <div className="mt-5 h-1 w-[200px] rounded-full bg-gradient-to-r from-brand-blue to-brand-indigo md:w-[240px]" />

            <p className="mt-6 max-w-md font-body text-[16px] leading-[1.65] text-slate-200 md:text-[17px]">
              {EVENT.tagline}
            </p>

            {/* Mobile-only CTA + note */}
            <div className="md:hidden">
              <MobileHeroRegisterButton />
              <p className="mt-5 max-w-sm font-body text-[13px] leading-[1.5] text-slate-400">
                {EVENT.laptopNote}
              </p>
            </div>

            {/* FREE badge */}
            <div className="mt-8 flex justify-start">
              <FreeBadge className="h-auto w-[200px] drop-shadow-xl md:w-[220px]" />
            </div>
          </div>

          {/* RIGHT — student photo (desktop only) */}
          <div className="relative mx-auto hidden w-full max-w-[540px] md:block">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue/25 blur-3xl"
            />
            <Image
              src="/reg/hero-student.png"
              alt="Student ready for the placement drive"
              width={540}
              height={580}
              priority
              className="relative z-10 mx-auto h-auto w-full max-w-[500px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
