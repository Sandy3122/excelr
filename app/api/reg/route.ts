import { NextResponse } from "next/server";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import { registrationSchema, type RegistrationInput } from "@/lib/reg-schema";

// Sheets + nodemailer need the Node runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 1. Parse + validate the body with the same schema as the client.
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

  // 2 + 3. Persist to Sheets and send emails. Run both but don't let one silent
  // failure hide the other; surface a 500 only if the primary (Sheets) fails.
  const results = await Promise.allSettled([
    appendToSheet(data, timestamp),
    sendEmails(data, timestamp),
  ]);

  const sheetResult = results[0];
  const emailResult = results[1];

  if (sheetResult.status === "rejected") {
    console.error("[reg] Google Sheets append failed:", sheetResult.reason);
    return NextResponse.json(
      { ok: false, error: "We couldn't save your registration. Please try again." },
      { status: 500 },
    );
  }

  if (emailResult.status === "rejected") {
    // Registration is saved; email is best-effort. Log but still return success.
    console.error("[reg] Email notification failed:", emailResult.reason);
  }

  return NextResponse.json({ ok: true });
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

/** Admin notification + optional applicant confirmation via SMTP. */
async function sendEmails(data: RegistrationInput, timestamp: string) {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from = process.env.SMTP_FROM || user;
  const notifyTo = requireEnv("REG_NOTIFY_TO");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
  });

  // (a) Admin notification
  const adminEmail = transporter.sendMail({
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
  });

  const sends: Promise<unknown>[] = [adminEmail];

  // (b) Optional confirmation to the applicant
  if (process.env.REG_SEND_APPLICANT_CONFIRMATION === "true") {
    sends.push(
      transporter.sendMail({
        from,
        to: data.email,
        subject: "You're registered — ExcelR's Java Full Stack Placement Drive",
        text: [
          `Hi ${data.fullName},`,
          "",
          "Thanks for registering for ExcelR's Java Full Stack Placement Drive.",
          "",
          "Date:  22nd August 2026",
          "Time:  9:00 AM Onwards",
          "Venue: ExcelR Marathahalli Campus, T-2 4th Floor, Raja Ikon,",
          "       Sarjapur Outer Ring Rd, Marathahalli, Bengaluru 560037",
          "",
          "Please bring your own laptop for the technical round, copies of your",
          "resume, and a valid photo ID.",
          "",
          "See you there!",
          "— Team ExcelR",
        ].join("\n"),
        html: applicantHtml(data),
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

function applicantHtml(data: RegistrationInput) {
  return `
  <div style="font-family:Arial,sans-serif;color:#0F172B;line-height:1.6">
    <h2 style="margin:0 0 8px">You're registered! 🎉</h2>
    <p>Hi ${escapeHtml(data.fullName)}, thanks for registering for ExcelR's
    Java Full Stack Placement Drive.</p>
    <p style="margin:16px 0">
      <strong>Date:</strong> 22nd August 2026<br/>
      <strong>Time:</strong> 9:00 AM Onwards<br/>
      <strong>Venue:</strong> ExcelR Marathahalli Campus, T-2 4th Floor, Raja Ikon,
      Sarjapur Outer Ring Rd, Marathahalli, Bengaluru 560037
    </p>
    <p>Please bring your own laptop for the technical round, copies of your resume,
    and a valid photo ID.</p>
    <p>See you there!<br/>— Team ExcelR</p>
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
