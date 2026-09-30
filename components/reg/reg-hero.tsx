"use client";

import Image from "next/image";
import GlowBlobs from "./glow-blobs";
import FreeBadge from "./free-badge";
import { MobileHeroRegisterButton } from "./mobile-register";
import { useRegEvent } from "./reg-event-context";
import type { HeroAnnounce, HeroBadge, HeroHeadingLine } from "@/lib/reg-event";

/**
 * Hero — white nav above, deep-blue backdrop with thin circle décor,
 * left copy (heading, role badge, glow underline, FREE badge) and a right-hand
 * cutout. Mobile keeps the ice CTA + laptop note. All copy comes from the
 * event config so each drive can supply its own.
 */
export default function RegHero({ closed = false }: { closed?: boolean }) {
  const { hero, laptopNote } = useRegEvent();

  return (
    <section
      className={`relative overflow-hidden text-white ${hero.backgroundClassName}`}
    >
      <GlowBlobs variant={hero.decor} />

      {/* Bleed layout: the cutout fills the section's height in the bottom-right
          corner. object-contain keeps it clear of the copy when the viewport is
          too narrow for the full-height render. */}
      {hero.imageLayout === "bleed" && (
        <div
          className={`absolute inset-y-0 right-0 z-0 hidden md:block ${hero.imageClassName}`}
        >
          <Image
            src={hero.image.src}
            alt={hero.image.alt}
            width={hero.image.width}
            height={hero.image.height}
            priority
            className="h-full w-full object-contain object-right-bottom"
          />
        </div>
      )}

      <div
        className={`relative mx-auto px-4 pb-0 ${hero.containerClassName} ${hero.paddingTopClassName}`}
      >
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-8 lg:gap-12">
          {/* LEFT — copy */}
          <div className="relative z-10 animate-fade-up">
            {hero.announce ? (
              <AnnounceCopy announce={hero.announce} />
            ) : (
              <>
                <h1 className="font-heading font-semibold leading-[1.02] tracking-[-1px] md:tracking-[-1.6px]">
                  {(hero.headingLines ?? []).map((line) => (
                    <HeadingLine key={line.text} line={line} />
                  ))}
                </h1>

                {hero.badge ? <RoleBadge badge={hero.badge} /> : null}

                {/* Accent underline — bright left → fade right, with glow */}
                <div className="mt-4 h-[3px] w-[180px] rounded-full bg-gradient-to-r from-[#7DD3FC] via-[#3B82F6] to-[#7DD3FC] md:mt-5 md:w-[220px]" />
              </>
            )}

            {hero.tagline ? (
              <p className="mt-6 max-w-[460px] font-body text-[15px] leading-[1.7] text-white/90 md:text-[17px] md:leading-[1.65]">
                {hero.tagline}
              </p>
            ) : null}

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
                {laptopNote}
              </p>
            </div>

            {/* FREE badge */}
            <div className={hero.freeBadgeWrapperClassName}>
              <FreeBadge className={hero.freeBadgeClassName} />
            </div>
          </div>

          {/* RIGHT — cutout (desktop only). The bleed layout draws it above,
              outside the grid; the column here just reserves its half. */}
          {hero.imageLayout === "column" ? (
            <div
              className={`relative mx-auto hidden w-full self-end md:block ${hero.imageClassName}`}
            >
              {hero.decor === "glow" && (
                <div
                  aria-hidden
                  className="absolute left-1/2 top-[20%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3B82F6]/30 blur-3xl"
                />
              )}
              <Image
                src={hero.image.src}
                alt={hero.image.alt}
                width={hero.image.width}
                height={hero.image.height}
                priority
                className="relative z-10 mx-auto h-auto w-full object-contain object-bottom"
              />
            </div>
          ) : (
            <div aria-hidden className="hidden md:block" />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Announcement hero copy, built to the approved banner:
 *
 *   ExcelR's
 *   PLACEMENT            (gold display)
 *   Drive  For Full Stack (script wordmark + role stacked beside it)
 *          Developers
 *   [ BTM EDITION ]      (gold bar, navy text)
 *   ──── Now ────
 *   BIGGER & BETTER
 *
 * Everything scales fluidly from md so the block keeps its proportions in the
 * hero's half-width column without stepping at breakpoints.
 */
function AnnounceCopy({ announce }: { announce: HeroAnnounce }) {
  return (
    <div className="font-heading">
      <p className="text-[26px] font-bold leading-none tracking-[-0.5px] text-white md:text-[clamp(28px,3.1vw_+_4px,44px)]">
        {announce.eyebrow}
      </p>

      <p className="mt-1 text-[46px] font-extrabold uppercase leading-[0.95] tracking-[-1px] text-[#FFC629] md:mt-2 md:text-[clamp(52px,6.2vw_-_4px,82px)]">
        {announce.headline}
      </p>

      <div className="mt-1 flex items-end gap-3 md:mt-2 md:gap-4">
        <span className="font-script text-[52px] leading-[0.8] text-white md:text-[clamp(56px,6.1vw_-_2px,80px)]">
          {announce.script}
        </span>
        <span className="pb-1.5 text-[16px] font-bold leading-[1.15] text-white md:pb-2 md:text-[clamp(17px,1.6vw_+_2px,26px)]">
          {announce.roleLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </span>
      </div>

      <p className="mt-3 inline-block bg-[#FFC629] px-5 py-1.5 text-[18px] font-extrabold uppercase tracking-[0.12em] text-[#0F2050] md:mt-4 md:px-7 md:py-2 md:text-[clamp(19px,1.7vw_+_3px,28px)]">
        {announce.edition}
      </p>

      {/* "Now" between two rules that fade out from the word. */}
      <div className="mt-4 flex items-center gap-3 md:mt-5 md:gap-4">
        <span className="h-px w-10 bg-gradient-to-l from-white/70 to-transparent md:w-16" />
        <span className="text-[20px] font-bold text-white md:text-[clamp(21px,1.8vw_+_3px,30px)]">
          {announce.nowLabel}
        </span>
        <span className="h-px w-10 bg-gradient-to-r from-white/70 to-transparent md:w-16" />
      </div>

      <p className="mt-3 text-[32px] font-extrabold uppercase leading-none tracking-[-0.5px] text-white md:mt-4 md:text-[clamp(34px,4vw_-_2px,54px)]">
        {announce.claim}
      </p>
    </div>
  );
}

function HeadingLine({ line }: { line: HeroHeadingLine }) {
  return (
    <span className={`block ${line.className}`}>
      <span className="text-white">{line.text}</span>
      {line.accent && (
        <span className="bg-gradient-to-r from-[#B4C2FF] to-[#8B9CF7] bg-clip-text text-transparent">
          {line.accent}
        </span>
      )}
      {line.small && (
        <span
          className={`ml-2 font-normal text-white ${line.smallClassName ?? ""}`}
        >
          {line.small}
        </span>
      )}
    </span>
  );
}

function RoleBadge({ badge }: { badge: HeroBadge }) {
  // The white plate scales on the same fluid curve as the heading, so it
  // shrinks with its column instead of crowding it at smaller breakpoints.
  if (badge.variant === "white") {
    return (
      <div className="mt-5 inline-block rounded-[10px] bg-white px-6 py-3 text-center shadow-[0_10px_34px_rgba(2,6,60,0.35)] md:mt-6 md:rounded-xl md:py-4 md:px-[clamp(24px,4.2vw_-_8px,40px)]">
        <span className="block font-heading text-[19px] font-bold tracking-[0.1em] text-navy-900 md:text-[clamp(19px,2.82vw_-_2.5px,30px)]">
          {badge.lines[0]}
        </span>
        {badge.lines[1] && (
          <span className="mt-0.5 block font-heading text-[16px] font-bold text-navy-900 md:text-[clamp(15px,2.26vw_-_2px,24px)]">
            {badge.lines[1]}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 inline-block rounded-[10px] border border-white/15 bg-gradient-to-b from-[#28499B] to-[#1B346F] px-6 py-2.5 shadow-[0_0_26px_rgba(37,66,148,0.5)] md:mt-6 md:rounded-xl md:px-8 md:py-3">
      {badge.lines.map((text, i) => (
        <span
          key={text}
          className={`block font-heading text-[22px] font-bold text-white md:text-[32px] lg:text-[40px] ${
            i > 0 ? "mt-0.5" : ""
          }`}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
