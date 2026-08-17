import { readFile } from "fs/promises";
import path from "path";
import { firstNameFrom } from "@/lib/first-name";
import { escapeHtml } from "@/lib/html-escape";

const WELCOME_TEMPLATE_PATH = path.join(process.cwd(), "public", "reg", "index.html");
const REMINDER_TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "reg",
  "email-reminder-day-before.html",
);

const templateCache = new Map<string, string>();

async function loadTemplate(filePath: string): Promise<string> {
  const cached = templateCache.get(filePath);
  if (cached) return cached;
  const html = await readFile(filePath, "utf8");
  templateCache.set(filePath, html);
  return html;
}

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

export const REMINDER_DAY_BEFORE_EMAIL = {
  subject: "Tomorrow, 9:00 AM — your Java Full Stack Placement Drive",
  fromName: "ExcelR Placement Team",
  replyTo: "enquiry@excelr.com",
} as const;

function applyEmailMergeFields(template: string, fullName: string): string {
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

/**
 * Load public/reg/index.html and fill merge fields for the applicant confirmation email.
 * Tokens: {{first_name}}, {{calendar_link}}, we_wk_unsubscribe_link
 */
export async function renderApplicantEmailHtml(fullName: string): Promise<string> {
  const template = await loadTemplate(WELCOME_TEMPLATE_PATH);
  return applyEmailMergeFields(template, fullName);
}

export async function renderReminderDayBeforeEmailHtml(
  fullName: string,
): Promise<string> {
  const template = await loadTemplate(REMINDER_TEMPLATE_PATH);
  return applyEmailMergeFields(template, fullName);
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
