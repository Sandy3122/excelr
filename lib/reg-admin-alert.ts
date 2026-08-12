import nodemailer from "nodemailer";
import { APPLICANT_EMAIL } from "./reg-email";

/**
 * Lightweight admin alert mailer for registration-pipeline failures.
 * Uses the same SMTP config as successful registration emails.
 */

let cachedTransporter: nodemailer.Transporter | null = null;

function getMailTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured for admin alerts.");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
  return cachedTransporter;
}

function adminInbox(): string {
  return process.env.REG_NOTIFY_TO || process.env.SMTP_USER || "";
}

function fromAddress(): string {
  const user = process.env.SMTP_USER || "";
  return process.env.SMTP_FROM || `${APPLICANT_EMAIL.fromName} <${user}>`;
}

export type AdminFailureAlert = {
  /** Short machine-ish step id, e.g. whatsapp_confirmation */
  step: string;
  /** Human-readable reason */
  reason: string;
  /** Optional context shown in the email body */
  details?: Record<string, string | null | undefined>;
};

/**
 * Notify the admin inbox that a registration-pipeline step failed.
 * Never throws — failures are logged so the main request path stays stable.
 */
export async function notifyAdminOfFailure(
  alert: AdminFailureAlert,
): Promise<void> {
  const to = adminInbox();
  if (!to) {
    console.error(
      "[admin-alert] Skipped — REG_NOTIFY_TO / SMTP_USER not configured.",
      alert,
    );
    return;
  }

  const timestamp = new Date().toISOString();
  const detailLines = Object.entries(alert.details || {})
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`);

  const text = [
    "Placement Drive — registration pipeline failure",
    "",
    `Step:      ${alert.step}`,
    `Reason:    ${alert.reason}`,
    `When:      ${timestamp}`,
    ...(detailLines.length ? ["", "Details:", ...detailLines] : []),
    "",
    "The user-facing flow may have continued or shown an error.",
    "Please investigate Infobip / SMTP / Redis as needed.",
  ].join("\n");

  const rows = [
    ["Step", alert.step],
    ["Reason", alert.reason],
    ["When", timestamp],
    ...detailLines.map((line) => {
      const idx = line.indexOf(": ");
      return idx === -1
        ? ["Info", line]
        : [line.slice(0, idx), line.slice(idx + 2)];
    }),
  ];

  const html = `
  <div style="font-family:Arial,sans-serif;color:#0F172B">
    <h2 style="margin:0 0 12px;color:#B42318">Registration pipeline failure</h2>
    <p style="margin:0 0 16px;color:#62748E;font:14px Arial">
      A step failed during Placement Drive registration. Email usually works —
      please check the failed step below.
    </p>
    <table style="border-collapse:collapse">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px;color:#62748E;font:600 13px Arial;vertical-align:top">${escapeHtml(
              k,
            )}</td>` +
            `<td style="padding:6px 12px;color:#0F172B;font:14px Arial;word-break:break-all">${escapeHtml(
              v,
            )}</td></tr>`,
        )
        .join("")}
    </table>
  </div>`;

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `[Alert] Placement Drive failure — ${alert.step}`,
      text,
      html,
    });
  } catch (err) {
    console.error("[admin-alert] Failed to email admin:", err, alert);
  }
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

/** Shared transporter for registration success emails (same pool as alerts). */
export function getRegistrationMailTransporter() {
  return getMailTransporter();
}

export function registrationMailFrom() {
  return fromAddress();
}

export function registrationNotifyTo() {
  const to = adminInbox();
  if (!to) throw new Error("Missing REG_NOTIFY_TO / SMTP_USER");
  return to;
}
