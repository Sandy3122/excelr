/**
 * ExcelR Placement Drive - BTM Campus, 9th & 10th October 2026.
 * Full Stack roles (Java & Python only). Mounted at /fsd-oct-2026.
 *
 * The hero follows the approved announcement banner and the FAQ copy is the
 * approved wording.
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
    title: "ExcelR BTM Campus",
    value:
      "No 10, Safeway Plaza, Ground Floor, 27th Main Rd, Old Madiwala, Jay Bheema Nagar, 1st Stage, BTM 1st Stage, Bengaluru, Karnataka 560068",
    valueStyle: "muted",
    href: "https://maps.app.goo.gl/pSsNVYGbWbwrMpcT8",
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
    q: "What technologies will the interviews focus on?",
    a: "Java & Python Full Stack only.\nMERN and MEAN Stack are not included in this placement drive.",
  },
  {
    q: "How many companies will be participating?",
    a: "Multiple hiring partners will join the drive.\nRegistered candidates can choose any 2 companies from the final list shared on the event day.",
  },
  {
    q: "Will I get an on-the-spot offer?",
    a: "Results will be shared by EOD on October 10th. Candidates who clear all rounds at the ExcelR campus will be referred to the respective companies for the next stage of their selection process.",
  },
  {
    q: "What should I bring on the day?",
    a: "Please bring your own laptop and charger, a soft copy of your updated resume, and a valid photo ID for verification.",
  },
  {
    q: "Can I attend the placement drive on both days?",
    a: "Once you register, you will receive your call letter by October 8th. You will be assigned one of the two days - October 9th or 10th along with a specific reporting time. All details will be shared with you via email or WhatsApp by October 8th.\nPlease note: Candidates can attend the drive only once and cannot appear on both days.",
  },
  {
    q: "Will different companies be present on October 9th and 10th?",
    a: "No. The same set of hiring companies will be participating on both days. Candidates can attend the drive only on their assigned day.",
  },
];

export const FSD_OCT_2026: RegEventConfig = {
  driveSlug: "fsd-oct-2026",
  href: "/fsd-oct-2026",
  thankYouHref: "/thank-you",
  name: "ExcelR’s Placement Drive for Full Stack Developers",

  meta: {
    title:
      "Register - ExcelR's Full Stack Placement Drive, BTM (Java & Python)",
    description:
      "Secure your spot at ExcelR's Full Stack Placement Drive on 9th and 10th October 2026, BTM Campus, Bengaluru. Java & Python roles, salary up to 10 LPA. Absolutely free for all.",
  },

  hero: {
    // Near-flat electric navy, sampled from the mock (#010D7A ± 8).
    backgroundClassName:
      "bg-[radial-gradient(1600px_900px_at_50%_45%,#020F7E_0%,#010C74_100%)]",
    decor: "outline",
    containerClassName: "max-w-content",
    paddingTopClassName: "pt-14 md:pt-16 pb-4 lg:pt-16",
    freeBadgeWrapperClassName: "mt-8 mb-12",
    // Announcement treatment from the approved banner.
    announce: {
      eyebrow: "ExcelR\u2019s",
      headline: "PLACEMENT",
      script: "Drive",
      roleLines: ["For Full Stack", "Developers"],
      edition: "BTM EDITION",
      nowLabel: "Now",
      claim: "BIGGER & BETTER",
    },
    image: {
      src: `${ASSETS}/hero-student.png`,
      width: 924,
      height: 742,
      alt: "Student announcing the placement drive - bigger and better",
    },
    // Landscape artwork, so half the 1152px container leaves it looking small.
    // Spanning the section's full height top-aligns it with the copy and lets
    // it run into the page gutter. The box is anchored off 50% - the container
    // is centred, so that is always where the two grid columns meet. At md it
    // starts on the column boundary; from xl it crosses into the column's
    // unused space, which the copy never reaches (the widest line, the h1, ends
    // 33px short), and that extra width is what gets the artwork to full height.
    imageLayout: "bleed",
    imageClassName:
      "left-[calc(50%+16px)] lg:left-[calc(50%+8px)] xl:left-[calc(50%-30px)]",
    freeBadgeClassName:
      "h-auto w-[170px] drop-shadow-[0_0_20px_rgba(59,130,246,0.35)] md:w-[clamp(150px,13vw_+_50px,200px)]",
  },

  freeBadgeSrc: `${ASSETS}/free-badge.png`,

  details: {
    heading: "Event Details",
    intro:
      "An intensive placement drive designed to connect Full Stack talent with the Industry.",
    items: DETAILS,
  },

  faqs: FAQS,

  footer: {
    copyright: "© 2026 PlaceDrive. All rights reserved.",
    location: "BTM Campus, Bangalore - 9 & 10 Oct 2026",
  },

  laptopNote: LAPTOP_NOTE,

  closedNotice:
    "Online registration for ExcelR’s Full Stack Placement Drive at BTM is no longer being accepted. If you have already registered, your seat remains confirmed.",

  thankYou: {
    meta: {
      title: "Thank You - ExcelR's Full Stack Placement Drive, BTM",
      description:
        "You're registered for ExcelR's Full Stack Placement Drive on 9th and 10th October 2026. Check your inbox for confirmation details.",
    },
    date: "9th and 10th Oct, 2026",
    venueName: "ExcelR BTM Campus",
    venueArea: "BTM 1st Stage, Bengaluru, Karnataka 560068",
    note: "We will confirm your reporting time and date before Oct 8th.",
    bringNote:
      "Please bring your own laptop, resume copies, and a valid photo ID.",
  },
};
