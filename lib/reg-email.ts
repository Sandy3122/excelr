import { readFile } from "fs/promises";
import path from "path";

const TEMPLATE_PATH = path.join(process.cwd(), "public", "reg", "index.html");

/** Event window for the "Add to calendar" CTA (IST → UTC for Google Calendar). */
const CALENDAR = {
  title: "ExcelR Java Full Stack Placement Drive",
  /** 22 Aug 2026 09:00–18:00 IST = 03:30–12:30 UTC */
  startUtc: "20260822T033000Z",
  endUtc: "20260822T123000Z",
  location:
    "ExcelR Marathahalli Campus, Unit No. T-2, 4th Floor, Raja Ikon, Marathahalli, Bengaluru 560037",
  details:
    "Java Full Stack Placement Drive at ExcelR Marathahalli Campus. Arrive by 8:45 AM for registration. Bring your laptop, resume copies, and a valid photo ID.",
} as const;

export const APPLICANT_EMAIL = {
  subject: "You're confirmed: Java Full Stack Placement Drive — 22 Aug, Marathahalli",
  fromName: "ExcelR Placement Team",
  replyTo: "enquiry@excelr.com",
} as const;

/**
 * Load public/reg/index.html and fill merge fields for the applicant confirmation email.
 * Tokens: {{first_name}}, {{calendar_link}}, we_wk_unsubscribe_link
 */
export async function renderApplicantEmailHtml(fullName: string): Promise<string> {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const firstName = escapeHtml(firstNameFrom(fullName));
  const calendarLink = buildGoogleCalendarLink();
  const unsubscribe = `mailto:${APPLICANT_EMAIL.replyTo}?subject=${encodeURIComponent(
    "Unsubscribe from ExcelR placement emails",
  )}`;

  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{calendar_link}}", calendarLink)
    .replaceAll("we_wk_unsubscribe_link", unsubscribe);
}

function firstNameFrom(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "there";
}

function buildGoogleCalendarLink(): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: CALENDAR.title,
    dates: `${CALENDAR.startUtc}/${CALENDAR.endUtc}`,
    details: CALENDAR.details,
    location: CALENDAR.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
