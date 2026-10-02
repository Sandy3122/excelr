/**
 * A registration landing page is described entirely by a `RegEventConfig`.
 *
 * `/reg` renders `DEFAULT_REG_EVENT` (the original Java Full Stack drive) and
 * every additional drive gets its own config under `lib/events/`, so a new
 * landing page is a config file plus a two-line route — no component forks.
 */

import {
  EVENT,
  EVENT_DETAILS,
  FAQS,
  FOOTER,
  type EventDetail,
  type FaqItem,
} from "./reg-content";

/**
 * One line of the hero H1. Rendered as:
 *   `<text><accent><small>`
 * where `accent` picks up the lavender gradient and `small` is a smaller,
 * lighter trailing fragment (e.g. "(Bangalore)").
 */
export type HeroHeadingLine = {
  text: string;
  accent?: string;
  small?: string;
  /** Size / tracking classes for the line. */
  className: string;
  /** Size classes for the `small` fragment. */
  smallClassName?: string;
};

/**
 * Announcement-style hero copy: a yellow display headline, a script wordmark
 * with the role beside it, an edition bar, and a claim line. Supply this
 * instead of `headingLines` + `badge` when a drive uses that treatment.
 */
export type HeroAnnounce = {
  /** Small line above the headline, e.g. "ExcelR's". */
  eyebrow: string;
  /** Large yellow display word, e.g. "PLACEMENT". */
  headline: string;
  /** Script wordmark rendered beneath it, e.g. "Drive". */
  script: string;
  /** Role, stacked to the right of the script word. */
  roleLines: readonly string[];
  /** Filled bar under the wordmark, e.g. "BTM EDITION". */
  edition: string;
  /** Small word between the rules, e.g. "Now". */
  nowLabel: string;
  /** Closing claim, e.g. "BIGGER & BETTER". */
  claim: string;
};

export type HeroBadge = {
  /** `indigo` = the original glowing blue plate, `white` = solid white plate. */
  variant: "indigo" | "white";
  /** One line, or two when the role needs a qualifier underneath. */
  lines: readonly string[];
};

export type RegEventConfig = {
  /**
   * Placement drive this page belongs to. The admin creates a drive with this
   * slug and configures every automation, template and limit against it — the
   * page itself carries no campaign behaviour, only its identity.
   */
  driveSlug: string;
  /** Route the page is mounted at, e.g. `/reg`. Used for "Back to Home". */
  href: string;
  /** Route of this event's post-registration page. */
  thankYouHref: string;
  /** Plain-English event name, used in confirmation and closed copy. */
  name: string;

  meta: { title: string; description: string };

  hero: {
    /** Tailwind background classes for the hero section. */
    backgroundClassName: string;
    /** `glow` = coloured blobs + circle outlines, `outline` = circles only. */
    decor: "glow" | "outline";
    /** Width of the hero's inner container. */
    containerClassName: string;
    /** Top padding of the hero container. */
    paddingTopClassName: string;
    /** Margin around the FREE badge — sets the gap to the hero's bottom edge. */
    freeBadgeWrapperClassName: string;
    /** Stacked heading. Omit when `announce` is supplied. */
    headingLines?: readonly HeroHeadingLine[];
    /** Role plate under the heading. Omit when `announce` is supplied. */
    badge?: HeroBadge;
    /** Announcement treatment; replaces `headingLines` + `badge`. */
    announce?: HeroAnnounce;
    /** Supporting sentence. Omit on designs that do not carry one. */
    tagline?: string;
    image: { src: string; width: number; height: number; alt: string };
    /**
     * `column` — the cutout sits inside the right grid column, bottom-aligned.
     * `bleed`  — it spans the section's full height, anchored to the
     *            bottom-right corner, so it reads as tall as the copy beside
     *            it instead of being capped by half the container.
     */
    imageLayout: "column" | "bleed";
    /** Sizing box for the cutout — column max-width, or bleed box width. */
    imageClassName: string;
    /** Rendered width of the "Absolutely FREE for All" badge. */
    freeBadgeClassName: string;
  };

  /** "Absolutely FREE for All" artwork for this event. */
  freeBadgeSrc: string;

  details: {
    heading: string;
    intro: string;
    items: readonly EventDetail[];
  };

  faqs: readonly FaqItem[];

  footer: { copyright: string; location: string };

  /** Small print under the register button and in the mobile hero. */
  laptopNote: string;

  /** Shown in place of the form once registrations close. */
  closedNotice: string;

  thankYou: {
    meta: { title: string; description: string };
    /** Facts listed in the confirmation card. */
    date: string;
    time?: string;
    venueName: string;
    venueArea: string;
    /** Optional extra line under the facts (e.g. "reporting time to follow"). */
    note?: string;
    bringNote: string;
  };
};

const HERO_HEADING_SIZE = "text-[42px] md:text-[56px] lg:text-[72px]";

/** The original `/reg` drive. Kept byte-for-byte equivalent to the old page. */
export const DEFAULT_REG_EVENT: RegEventConfig = {
  driveSlug: "reg",
  href: "/reg",
  thankYouHref: "/thank-you",
  name: EVENT.title,

  meta: {
    title: "Register — ExcelR's Java Full Stack Placement Drive",
    description:
      "Secure your spot at ExcelR's Java Full Stack Placement Drive on 22nd August 2026, BTM Campus, Bengaluru. Absolutely free for all.",
  },

  hero: {
    backgroundClassName:
      "bg-[radial-gradient(1200px_640px_at_30%_28%,#1E3F91_0%,#0E1B49_46%,#080D28_100%)]",
    decor: "glow",
    containerClassName: "max-w-content",
    paddingTopClassName: "pt-14 md:pt-16 lg:pt-16",
    freeBadgeWrapperClassName: "mt-8 mb-12",
    headingLines: [
      { text: "ExcelR’s", className: HERO_HEADING_SIZE },
      { text: "Placement ", accent: "Drive", className: HERO_HEADING_SIZE },
    ],
    badge: { variant: "indigo", lines: [EVENT.role] },
    tagline: EVENT.tagline,
    image: {
      src: "/reg/hero-student.png",
      width: 590,
      height: 580,
      alt: "Student ready for the placement drive",
    },
    imageLayout: "column",
    imageClassName: "max-w-[580px]",
    freeBadgeClassName:
      "h-auto w-[210px] drop-shadow-[0_0_20px_rgba(59,130,246,0.35)] md:w-[240px]",
  },

  freeBadgeSrc: "/reg/free-badge.png",

  details: {
    heading: "Event Details",
    intro:
      "An intensive placement drive designed to connect Java Full Stack talent with the Industry.",
    items: EVENT_DETAILS,
  },

  faqs: FAQS,

  footer: FOOTER,

  laptopNote: EVENT.laptopNote,

  closedNotice:
    "Online registration for ExcelR’s Java Full Stack Placement Drive is no longer being accepted. If you have already registered, your seat remains confirmed.",

  thankYou: {
    meta: {
      title: "Thank You — ExcelR's Java Full Stack Placement Drive",
      description:
        "You're registered for ExcelR's Java Full Stack Placement Drive. Check your inbox for confirmation details.",
    },
    date: EVENT.date,
    time: "9:00 AM Onwards",
    venueName: "ExcelR BTM Campus",
    venueArea: "Bengaluru, Karnataka 560037",
    bringNote:
      "Please bring your own laptop, resume copies, and a valid photo ID.",
  },
};
