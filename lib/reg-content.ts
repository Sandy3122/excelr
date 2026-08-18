/**
 * Single source of copy for the ExcelR Placement Drive registration page.
 * Keeping event details, FAQ, and form options here means the UI and the
 * server route stay in sync (e.g. qualification options are validated
 * against this list on the server too).
 */

export const EVENT = {
  title: "ExcelR's Placement Drive",
  role: "For Java Full Stack",
  tagline:
    "Connect with top tech companies, ace your interviews, and launch your career — all in one day at ExcelR's Marathahalli Campus.",
  laptopNote:
    "Note: Candidates are requested to bring their own laptops to complete the technical round.",
  date: "22nd August 2026",
  dateShort: "22 Aug 2026",
} as const;

export type EventDetail = {
  key: string;
  icon: "calendar" | "clock" | "map-pin" | "rupee" | "users";
  label: string;
  /** Optional bold heading shown above the value (used by Venue). */
  title?: string;
  value: string;
  /** Render the value with an underline (used by the Venue address). */
  underlineValue?: boolean;
};

export const EVENT_DETAILS: EventDetail[] = [
  { key: "date", icon: "calendar", label: "Date", value: "22nd August 2026" },
  { key: "time", icon: "clock", label: "Time", value: "9:00 AM Onwards" },
  {
    key: "venue",
    icon: "map-pin",
    label: "Venue",
    title: "ExcelR Marathahalli Campus",
    value:
      "T-2 4th Floor, Raja Ikon Sy, No.89/1 Munnekolala, Village, Marathahalli – Sarjapur Outer Ring Rd, above Yes Bank, Marathahalli, Bengaluru, Karnataka 560037",
    underlineValue: true,
  },
  { key: "salary", icon: "rupee", label: "Salary Range", value: "salary upto 10 LPA" },
  {
    key: "who",
    icon: "users",
    label: "Who Can Apply",
    value: "Freshers With Java Full Stack Knowledge",
  },
];

/**
 * Highest Qualification options.
 * NOTE: exact options were not fully readable from the Figma design —
 * these are the suggested set from the spec (§3.3). Confirm with the design owner.
 */
export const QUALIFICATION_OPTIONS = [
  "B.E / B.Tech",
  "B.Sc",
  "BCA",
  "M.E / M.Tech",
  "M.Sc",
  "MCA",
  "Other",
] as const;

export type FaqItem = { q: string; a: string };

/**
 * FAQ copy — matches the Figma FAQ frame (6 items; first expanded by default).
 */
export const FAQS: FaqItem[] = [
  {
    q: "Who is eligible to attend this placement drive?",
    a: "The drive is open to all — freshers who have recently graduated and experienced professionals looking to switch roles in Java Full Stack development. Any educational background is welcome as long as you have the relevant skills.",
  },
  {
    q: "Is there any registration fee?",
    a: "No. The placement drive is absolutely free for all candidates. There is no registration or participation fee at any stage.",
  },
  {
    q: "What technologies will the interviews focus on?",
    a: "Interviews focus on the Java Full Stack ecosystem — core Java and OOP, Spring / Spring Boot, REST APIs, SQL databases, and front-end fundamentals (HTML, CSS, JavaScript, and a modern framework).",
  },
  {
    q: "How many companies will be participating?",
    a: "Multiple hiring partners will be participating on the day. The final list of companies is shared with registered candidates ahead of the event.",
  },
  {
    q: "Will I get an on-the-spot offer?",
    a: "Selected candidates may receive offers on the same day, depending on each company's interview process. Some companies may schedule a follow-up round after the drive.",
  },
  {
    q: "What should I bring on the day?",
    a: "Please bring your own laptop for the technical round, multiple copies of your updated resume, and a valid photo ID for verification.",
  },
];

export const FOOTER = {
  copyright: "© 2026 PlaceDrive. All rights reserved.",
  location: "Marathahalli Campus, Bangalore — 22 Aug 2026",
} as const;
