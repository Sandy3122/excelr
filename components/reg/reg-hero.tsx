import Image from "next/image";
import GlowBlobs from "./glow-blobs";
import FreeBadge from "./free-badge";
import { MobileHeroRegisterButton } from "./mobile-register";
import { EVENT } from "@/lib/reg-content";

/**
 * Hero — matches the Figma desktop hero screenshot:
 * white nav above, navy/royal gradient + thin circle décor,
 * left copy (lavender "Drive", blue role badge, glow underline, FREE badge),
 * right student cutout. Mobile keeps ice CTA + note.
 */
export default function RegHero({ closed = false }: { closed?: boolean }) {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(1200px_640px_at_30%_28%,#1E3F91_0%,#0E1B49_46%,#080D28_100%)] text-white">
      <GlowBlobs />

      <div className="relative mx-auto max-w-content px-4 pb-0 pt-14 md:pb-0 md:pt-16 lg:pb-0 lg:pt-16">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-8 lg:gap-12">
          {/* LEFT — copy */}
          <div className="relative z-10 animate-fade-up">
            <h1 className="font-heading font-semibold leading-[1.02] tracking-[-1px] text-[42px] md:text-[56px] md:tracking-[-1.6px] lg:text-[72px]">
              <span className="block text-white">ExcelR&apos;s</span>
              <span className="block">
                <span className="text-white">Placement </span>
                <span className="bg-gradient-to-r from-[#B4C2FF] to-[#8B9CF7] bg-clip-text text-transparent">
                  Drive
                </span>
              </span>
            </h1>

            {/* "For Java Full Stack" — indigo badge with subtle border + soft glow */}
            <div className="mt-5 inline-block rounded-[10px] border border-white/15 bg-gradient-to-b from-[#28499B] to-[#1B346F] px-6 py-2.5 shadow-[0_0_26px_rgba(37,66,148,0.5)] md:mt-6 md:rounded-xl md:px-8 md:py-3">
              <span className="font-heading text-[22px] font-bold text-white md:text-[32px] lg:text-[40px]">
                {EVENT.role}
              </span>
            </div>

            {/* Accent underline — bright left → fade right, with glow */}
            <div className="mt-4 h-[3px] w-[180px] rounded-full bg-gradient-to-r from-[#7DD3FC] via-[#3B82F6] to-[#7DD3FC] md:mt-5 md:w-[220px]" />

            <p className="mt-6 max-w-[420px] font-body text-[15px] leading-[1.7] text-white/90 md:text-[17px] md:leading-[1.65]">
              {EVENT.tagline}
            </p>

            {/* Mobile-only CTA + note */}
            <div className="md:hidden">
              {closed ? (
                <p className="mt-8 max-w-sm rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-body text-[14px] leading-relaxed text-white/90">
                  Registrations for this placement drive are closed.
                </p>
              ) : (
                <MobileHeroRegisterButton />
              )}
              <p className="mt-5 max-w-sm font-body text-[13px] leading-[1.5] text-slate-400">
                {EVENT.laptopNote}
              </p>
            </div>

            {/* FREE badge */}
            <div className="mt-8 mb-12">
              <FreeBadge className="h-auto w-[210px] drop-shadow-[0_0_20px_rgba(59,130,246,0.35)] md:w-[240px]" />
            </div>
          </div>

          {/* RIGHT — student photo (desktop only) */}
          <div className="relative mx-auto hidden w-full max-w-[560px] md:block self-end">
            <div
              aria-hidden
              className="absolute left-1/2 top-[40%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3B82F6]/30 blur-3xl"
            />
            <Image
              src="/reg/hero-student.png"
              alt="Student ready for the placement drive"
              width={580}
              height={640}
              priority
              className="relative z-10 mx-auto h-auto w-full max-w-[580px] object-contain object-bottom"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
