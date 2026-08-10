import { NextResponse } from "next/server";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import { registrationSchema, type RegistrationInput } from "@/lib/reg-schema";
import { APPLICANT_EMAIL, renderApplicantEmailHtml } from "@/lib/reg-email";

// Sheets + nodemailer need the Node runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const timestamp = new Date().toISOString();

  // Email is required on every successful registration.
  try {
    await sendEmails(data, timestamp);
  } catch (err) {
    console.error("[reg] Nodemailer send failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "We couldn't send the confirmation email. Please try again in a moment.",
      },
      { status: 500 },
    );
  }

  // Sheets is optional — skip quietly when credentials aren't configured.
  if (hasSheetsConfig()) {
    try {
      await appendToSheet(data, timestamp);
    } catch (err) {
      console.error("[reg] Google Sheets append failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

function hasSheetsConfig() {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes("..."),
  );
}

/** Append a row: [timestamp, fullName, email, phone, college, qualification]. */
async function appendToSheet(data: RegistrationInput, timestamp: string) {
  const spreadsheetId = requireEnv("GOOGLE_SHEETS_SPREADSHEET_ID");
  const clientEmail = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "Registrations";

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [timestamp, data.fullName, data.email, data.phone, data.college, data.qualification],
      ],
    },
  });
}

/** Admin notification + applicant confirmation (HTML from public/reg/index.html). */
async function sendEmails(data: RegistrationInput, timestamp: string) {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from =
    process.env.SMTP_FROM || `${APPLICANT_EMAIL.fromName} <${user}>`;
  const notifyTo = process.env.REG_NOTIFY_TO || user;
  const sendApplicantConfirmation =
    (process.env.REG_SEND_APPLICANT_CONFIRMATION || "true").toLowerCase() === "true";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  // (a) Admin notification (plain operational email)
  const sends: Promise<unknown>[] = [
    transporter.sendMail({
      from,
      to: notifyTo,
      replyTo: data.email,
      subject: `New Placement Drive registration — ${data.fullName}`,
      text: [
        "New registration for ExcelR's Java Full Stack Placement Drive:",
        "",
        `Name:          ${data.fullName}`,
        `Email:         ${data.email}`,
        `Phone:         ${data.phone}`,
        `College:       ${data.college}`,
        `Qualification: ${data.qualification}`,
        `Submitted:     ${timestamp}`,
      ].join("\n"),
      html: adminHtml(data, timestamp),
    }),
  ];

  // (b) Applicant confirmation — exact HTML template from public/reg/index.html
  if (sendApplicantConfirmation) {
    const html = await renderApplicantEmailHtml(data.fullName);
    sends.push(
      transporter.sendMail({
        from,
        to: data.email,
        replyTo: APPLICANT_EMAIL.replyTo,
        subject: APPLICANT_EMAIL.subject,
        text: [
          `Hi ${data.fullName.split(/\s+/)[0] || "there"},`,
          "",
          "Your seat is confirmed for the Java Full Stack Placement Drive.",
          "",
          "Date:  Saturday, 22nd August 2026",
          "Time:  9:00 AM onwards (registration 8:45 – 9:00 AM)",
          "Venue: ExcelR — Marathahalli Campus, Bengaluru 560037",
          "",
          "Please bring your resume copies, photo ID, and laptop (mandatory).",
          "",
          "— Team ExcelR, Placement & Career Services",
        ].join("\n"),
        html,
      }),
    );
  }

  await Promise.all(sends);
}

function adminHtml(data: RegistrationInput, timestamp: string) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px;color:#62748E;font:600 13px Arial">${k}</td>` +
    `<td style="padding:6px 12px;color:#0F172B;font:14px Arial">${escapeHtml(v)}</td></tr>`;
  return `
  <div style="font-family:Arial,sans-serif;color:#0F172B">
    <h2 style="margin:0 0 12px">New Placement Drive registration</h2>
    <table style="border-collapse:collapse">
      ${row("Name", data.fullName)}
      ${row("Email", data.email)}
      ${row("Phone", data.phone)}
      ${row("College", data.college)}
      ${row("Qualification", data.qualification)}
      ${row("Submitted", timestamp)}
    </table>
  </div>`;
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

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
