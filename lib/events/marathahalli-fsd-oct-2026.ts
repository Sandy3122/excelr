/**
 * ExcelR Placement Drive — Marathahalli, 9th & 10th October 2026.
 * Full Stack roles (Java & Python only). Mounted at /marathahalli-fsd-oct-2026.
 *
 * Copy and layout follow the approved design mock. Items marked
 * "CONFIRM" below were not legible in the mock and are drafted here.
 */

import type { EventDetail, FaqItem } from "../reg-content";
import type { RegEventConfig } from "../reg-event";

const ASSETS = "/reg/Marthali-FSD-Sep-2026";

const LAPTOP_NOTE =
  "Note: Candidates are requested to bring their own laptops to complete the technical round.";

const DETAILS: EventDetail[] = [
  {
    key: "date",
    icon: "calendar",
    label: "Date",
    value: "9th and 10th Oct, 2026",
  },
  {
    key: "venue",
    icon: "map-pin",
    label: "Venue",
    title: "ExcelR Marathahalli Campus",
    value:
      "Next to Meghana Foods, T-2 4th Floor, Raja Ikon, Sy No. 89/1, Munnekollai Village, Marathahalli – Sarjapur Outer Ring Rd, above YES Bank, Bengaluru, Karnataka 560037",
    valueStyle: "muted",
  },
  {
    key: "salary",
    icon: "rupee",
    label: "Salary Range",
    value: "Salary up to 10 LPA",
  },
  {
    key: "who",
    icon: "users",
    label: "Who Can Apply",
    value: "Freshers With Full Stack Skills",
  },
  {
    key: "note",
    icon: "note",
    label: "Note:",
    value: "We will confirm your reporting time and date before Oct 8th.",
  },
];

const FAQS: FaqItem[] = [
  {
    q: "Who is eligible to attend this placement drive?",
    a: "Freshers only.\nEven working professionals with non-IT experience can apply as freshers.",
  },
  {
    q: "Is there any registration fee?",
    a: "No. The placement drive is absolutely free for all candidates. There is no registration or participation fee at any stage.",
  },
  {
    // CONFIRM — adapted from the Java-only drive to cover Java & Python.
    q: "What technologies will the interviews focus on?",
    a: "Java and Python Full Stack only. Expect core language and OOP fundamentals, Spring / Spring Boot (Java) or Django / Flask (Python), REST APIs, SQL databases, and front-end basics — HTML, CSS, JavaScript and a modern framework.",
  },
  {
    q: "How many companies will be participating?",
    a: "Multiple hiring partners will be participating across the two days. The final list of companies is shared with registered candidates ahead of the event.",
  },
  {
    q: "Will I get an on-the-spot offer?",
    a: "Selected candidates may receive offers on the same day, depending on each company's interview process. Some companies may schedule a follow-up round after the drive.",
  },
  {
    q: "What should I bring on the day?",
    a: "Please bring your own laptop for the technical round, multiple copies of your updated resume, and a valid photo ID for verification.",
  },
  {
    // CONFIRM — answer drafted; not legible in the mock.
    q: "Can I attend the placement drive on both days?",
    a: "You will be allotted one of the two days. We confirm your reporting date and time before 8th October, so please attend on the day assigned to you.",
  },
  {
    // CONFIRM — answer drafted; not legible in the mock.
    q: "Will different companies be present on October 9th and 10th?",
    a: "Yes. The participating companies differ between the two days. The list for your allotted day is shared with you along with your reporting details.",
  },
];

export const MARATHAHALLI_FSD_OCT_2026: RegEventConfig = {
  href: "/marathahalli-fsd-oct-2026",
  thankYouHref: "/marathahalli-fsd-oct-2026/thank-you",
  name: "ExcelR’s Placement Drive in Marathahalli",

  meta: {
    title:
      "Register — ExcelR's Full Stack Placement Drive, Marathahalli (Java & Python)",
    description:
      "Secure your spot at ExcelR's Full Stack Placement Drive on 9th and 10th October 2026, Marathahalli Campus, Bengaluru. Java & Python roles, salary up to 10 LPA. Absolutely free for all.",
  },

  hero: {
    // Near-flat electric navy, sampled from the mock (#010D7A ± 8).
    backgroundClassName:
      "bg-[radial-gradient(1600px_900px_at_50%_45%,#020F7E_0%,#010C74_100%)]",
    decor: "outline",
    containerClassName: "max-w-content",
    paddingTopClassName: "pt-14 md:pt-16 lg:pt-16",
    freeBadgeWrapperClassName: "mt-8 mb-12",
    headingLines: [
      {
        text: "ExcelR’s",
        className: "text-[34px] md:text-[46px] lg:text-[60px]",
      },
      {
        text: "Placement Drive",
        className: "text-[42px] md:text-[56px] lg:text-[72px]",
      },
      {
        text: "in Marathahalli",
        small: "(Bangalore)",
        className: "text-[30px] md:text-[42px] lg:text-[54px]",
        smallClassName: "text-[20px] md:text-[28px] lg:text-[36px]",
      },
    ],
    badge: {
      variant: "white",
      lines: ["For Full Stack Roles", "(Only For Java & Python)"],
    },
    tagline:
      "Connect with top tech companies, ace your interviews, and launch your career at ExcelR’s Marathahalli Campus.",
    image: {
      src: `${ASSETS}/hero-student.png`,
      width: 924,
      height: 742,
      alt: "Student announcing the placement drive — bigger and better",
    },
    // Landscape artwork, so it needs more width than the portrait cutout on
    // /reg to read at the same visual weight.
    imageClassName: "max-w-[640px]",
    freeBadgeClassName:
      "h-auto w-[170px] drop-shadow-[0_0_20px_rgba(59,130,246,0.35)] md:w-[200px]",
  },

  freeBadgeSrc: `${ASSETS}/free-badge.png`,

  // The shared close time in `meta/registrationWindow` belongs to the August
  // drive — honouring it here would show this page as closed on day one.
  // Flip to "global" once the window is per-drive (see the backend config work).
  registrationWindow: "open",

  details: {
    heading: "Event Details",
    intro:
      "An intensive placement drive designed to connect Full Stack talent with the Industry.",
    items: DETAILS,
  },

  faqs: FAQS,

  footer: {
    copyright: "© 2026 PlaceDrive. All rights reserved.",
    location: "Marathahalli Campus, Bangalore — 9 & 10 Oct 2026",
  },

  laptopNote: LAPTOP_NOTE,

  closedNotice:
    "Online registration for ExcelR’s Full Stack Placement Drive in Marathahalli is no longer being accepted. If you have already registered, your seat remains confirmed.",

  thankYou: {
    meta: {
      title: "Thank You — ExcelR's Full Stack Placement Drive, Marathahalli",
      description:
        "You're registered for ExcelR's Full Stack Placement Drive on 9th and 10th October 2026. Check your inbox for confirmation details.",
    },
    date: "9th and 10th Oct, 2026",
    venueName: "ExcelR Marathahalli Campus",
    venueArea: "Bengaluru, Karnataka 560037",
    note: "We will confirm your reporting time and date before Oct 8th.",
    bringNote:
      "Please bring your own laptop, resume copies, and a valid photo ID.",
  },
};
