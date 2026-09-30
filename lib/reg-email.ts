import { readFile } from "fs/promises";
import path from "path";
import { firstNameFrom } from "@/lib/first-name";
import { escapeHtml } from "@/lib/html-escape";
import type { PlacementDrive } from "@/lib/drives/types";

/**
 * Applicant emails.
 *
 * The HTML bodies are bundled files (they carry the brand layout), but every
 * campaign-specific detail in them — dates, venue, calendar link — is filled
 * from the placement drive at send time.
 */

export type EmailTemplateKey = "welcome" | "reminder_day_before";

const TEMPLATE_FILES: Record<EmailTemplateKey, string> = {
  welcome: "index.html",
  reminder_day_before: "email-reminder-day-before.html",
};

const templateCache = new Map<string, string>();

async function loadTemplate(file: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "reg", file);
  const cached = templateCache.get(filePath);
  if (cached) return cached;
  const html = await readFile(filePath, "utf8");
  templateCache.set(filePath, html);
  return html;
}

export const APPLICANT_REPLY_TO = (
  process.env.REG_REPLY_TO || "enquiry@excelr.com"
).trim();

function applyEmailMergeFields(
  template: string,
  fullName: string,
  drive?: PlacementDrive,
): string {
  const firstName = escapeHtml(firstNameFrom(fullName));
  const calendarLink = drive ? buildGoogleCalendarLink(drive) : "";
  const unsubscribe = `mailto:${APPLICANT_REPLY_TO}?subject=${encodeURIComponent(
    "Unsubscribe from ExcelR placement emails",
  )}`;

  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{calendar_link}}", calendarLink)
    .replaceAll("we_wk_unsubscribe_link", unsubscribe);
}

/**
 * Render a bundled applicant email.
 * Tokens: {{first_name}}, {{calendar_link}}, we_wk_unsubscribe_link
 */
export async function renderAutomationEmailHtml(
  key: EmailTemplateKey,
  fullName: string,
  drive?: PlacementDrive,
): Promise<string> {
  const template = await loadTemplate(TEMPLATE_FILES[key]);
  return applyEmailMergeFields(template, fullName, drive);
}

/** Plain-text alternative, built from the drive's own details. */
export function automationEmailText(
  key: EmailTemplateKey,
  firstName: string,
  drive: PlacementDrive,
): string {
  const when = drive.eventDayIstDate
    ? `Date:  ${drive.eventDayIstDate} (IST)`
    : "";
  const lines =
    key === "welcome"
      ? [
          `Hi ${firstName},`,
          "",
          `Your seat is confirmed for ${drive.name}.`,
          "",
          when,
          "",
          "Please bring your resume copies, photo ID, and laptop (mandatory).",
        ]
      : [
          `Hi ${firstName},`,
          "",
          `This is a reminder: ${drive.name} is tomorrow.`,
          "",
          when,
          "",
          "Please bring your laptop, resume copies, and a valid photo ID.",
        ];
  return [...lines, "", "— Team ExcelR, Placement & Career Services"]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
}

/** "Add to calendar" link for the drive's event day (09:00–18:00 IST). */
export function buildGoogleCalendarLink(drive: PlacementDrive): string {
  if (!drive.eventDayIstDate) return "";
  const day = drive.eventDayIstDate.replaceAll("-", "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: drive.name,
    // 09:00–18:00 IST = 03:30–12:30 UTC.
    dates: `${day}T033000Z/${day}T123000Z`,
    details: `${drive.name}. Bring your laptop, resume copies, and a valid photo ID.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
