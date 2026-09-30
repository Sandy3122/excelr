import { readFile } from "fs/promises";
import path from "path";
import { firstNameFrom } from "@/lib/first-name";
import { escapeHtml } from "@/lib/html-escape";
import type { PlacementDrive } from "@/lib/drives/types";

/**
 * Applicant emails.
 *
 * Each landing page keeps its own email bodies next to its route:
 *
 *   app/{slug}/index.html                      welcome
 *   app/{slug}/email-reminder-day-before.html  day-before reminder
 *
 * so a new campaign ships its page and its emails together. Anything a drive
 * does not provide falls back to the shared copies in public/reg, which is
 * what /reg still uses.
 *
 * Campaign-specific details inside the HTML — first name, calendar link,
 * unsubscribe — are merged in at send time.
 */

export type EmailTemplateKey = "welcome" | "reminder_day_before";

const TEMPLATE_FILES: Record<EmailTemplateKey, string> = {
  welcome: "index.html",
  reminder_day_before: "email-reminder-day-before.html",
};

const templateCache = new Map<string, string>();
const announcedTemplates = new Set<string>();

/** Matches the drive slug format, so a slug can never escape its directory. */
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Where to look for one email body, most specific first: the page's own folder,
 * then the shared copy.
 */
function templateCandidates(file: string, slug?: string): string[] {
  const paths: string[] = [];
  if (slug && SAFE_SLUG.test(slug)) {
    paths.push(path.join(process.cwd(), "app", slug, file));
  }
  paths.push(path.join(process.cwd(), "public", "reg", file));
  return paths;
}

async function loadTemplate(file: string, slug?: string): Promise<string> {
  const candidates = templateCandidates(file, slug);
  const cacheKey = `${slug || "-"}:${file}`;
  const cached = templateCache.get(cacheKey);
  if (cached) return cached;

  for (const filePath of candidates) {
    try {
      const html = await readFile(filePath, "utf8");
      templateCache.set(cacheKey, html);
      if (!announcedTemplates.has(cacheKey)) {
        announcedTemplates.add(cacheKey);
        console.info(`[reg-email] ${file} for "${slug || "default"}" → ${filePath}`);
      }
      return html;
    } catch {
      // Try the next candidate; only the last miss is an error.
    }
  }

  throw new Error(
    `No ${file} for "${slug || "default"}". Looked in: ${candidates.join(", ")}`,
  );
}

export const APPLICANT_REPLY_TO = (
  process.env.REG_REPLY_TO || "enquiry@excelr.com"
).trim();

/**
 * Every `{{ … }}` expression in a template, however it is written.
 *
 * Two syntaxes are accepted so a body exported from WebEngage can be pasted in
 * unchanged:
 *
 *   {{first_name}}
 *   {{user["system"]["first_name"] or "Aspirant"}}
 *
 * The key is the plain name, or the last bracketed segment. An `or "…"` suffix
 * supplies the fallback when the value is empty.
 */
const MERGE_EXPRESSION = /\{\{\s*([^}]+?)\s*\}\}/g;
const BRACKETED_KEY = /\[\s*["']([^"']+)["']\s*\]\s*$/;
const OR_DEFAULT = /\s+or\s+["']([^"']*)["']\s*$/;

function resolveMergeExpression(
  expression: string,
  values: Record<string, string>,
): string {
  let expr = expression;
  let fallback = "";

  const withDefault = OR_DEFAULT.exec(expr);
  if (withDefault) {
    fallback = withDefault[1];
    expr = expr.slice(0, withDefault.index).trim();
  }

  // "user[\"system\"][\"first_name\"]" → first_name; "first_name" stays as is.
  const bracketed = BRACKETED_KEY.exec(expr);
  const key = (bracketed ? bracketed[1] : expr).trim();

  const value = values[key];
  return (value && value.trim()) || fallback;
}

function applyEmailMergeFields(
  template: string,
  fullName: string,
  drive?: PlacementDrive,
): string {
  const firstName = firstNameFrom(fullName);
  const values: Record<string, string> = {
    // Names are escaped: they come from a public form.
    first_name: escapeHtml(firstName),
    full_name: escapeHtml(fullName.trim()),
    calendar_link: drive ? buildGoogleCalendarLink(drive) : "",
    drive_name: escapeHtml(drive?.name || ""),
    event_date: drive?.eventDayIstDate || "",
  };

  const unsubscribe = `mailto:${APPLICANT_REPLY_TO}?subject=${encodeURIComponent(
    "Unsubscribe from ExcelR placement emails",
  )}`;

  return (
    template
      .replaceAll("we_wk_unsubscribe_link", unsubscribe)
      // Unknown keys collapse to their fallback, or to nothing — a candidate
      // must never receive a raw {{ … }} in their email.
      .replace(MERGE_EXPRESSION, (_match, expression: string) =>
        resolveMergeExpression(expression, values),
      )
  );
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
  const template = await loadTemplate(TEMPLATE_FILES[key], drive?.slug);
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
