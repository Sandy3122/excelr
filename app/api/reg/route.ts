import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { registrationSchema, type RegistrationInput } from "@/lib/reg-schema";
import { APPLICANT_EMAIL, renderApplicantEmailHtml } from "@/lib/reg-email";
import {
  consumePhoneVerification,
  isPhoneVerified,
} from "@/lib/whatsapp-otp/service";
import { sendRegistrationConfirmationWhatsApp } from "@/lib/whatsapp-otp/infobip";
import { hasInfobipConfig } from "@/lib/whatsapp-otp/config";

// Nodemailer needs the Node runtime (not Edge).
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

  // The WhatsApp number must have been verified via OTP before we accept the
  // registration. We peek here (non-destructive) and only consume the marker
  // after the emails go out, so a transient email failure lets the user retry
  // without re-verifying.
  const { verified, phone } = await isPhoneVerified(data.phone);
  if (!verified) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please verify your WhatsApp number before registering.",
      },
      { status: 403 },
    );
  }
  // Use the normalized E.164 number everywhere downstream.
  if (phone) data.phone = phone.e164;

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

  // Emails delivered — burn the one-time verification marker so it can't be
  // reused for another registration. Send the WhatsApp welcome in parallel so
  // we still await it (required on serverless — a bare `void` is killed when
  // the response returns) without stacking the latency.
  const consumePromise = consumePhoneVerification(data.phone).catch((err) => {
    console.error("[reg] Failed to consume phone verification marker:", err);
  });
  const whatsappPromise = sendWhatsAppConfirmation(data, phone);

  await Promise.all([consumePromise, whatsappPromise]);

  return NextResponse.json({ ok: true });
}

async function sendWhatsAppConfirmation(
  data: RegistrationInput,
  phone: Awaited<ReturnType<typeof isPhoneVerified>>["phone"],
) {
  if (!hasInfobipConfig()) {
    console.error(
      "[reg] WhatsApp confirmation skipped: Infobip is not configured.",
    );
    return;
  }
  if (!phone) {
    console.error(
      "[reg] WhatsApp confirmation skipped: normalized phone missing.",
    );
    return;
  }

  const firstName = data.fullName.trim().split(/\s+/)[0] || "there";
  try {
    const wa = await sendRegistrationConfirmationWhatsApp(
      phone.infobip,
      firstName,
    );
    if (!wa.ok) {
      console.error(
        "[reg] WhatsApp confirmation send failed for",
        phone.masked,
      );
      return;
    }
    console.info(
      "[reg] WhatsApp confirmation accepted by Infobip for",
      phone.masked,
      wa.providerMessageId ? `(id=${wa.providerMessageId})` : "",
    );
  } catch (err) {
    console.error("[reg] WhatsApp confirmation send failed:", err);
  }
}

/** Admin notification + applicant confirmation (HTML from public/reg/index.html). */
let cachedTransporter: nodemailer.Transporter | null = null;

function getMailTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587/2525 = STARTTLS
    requireTLS: port !== 465,
    auth: { user, pass },
    // Reuse connections across registrations in the same warm instance.
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
  return cachedTransporter;
}

async function sendEmails(data: RegistrationInput, timestamp: string) {
  const user = requireEnv("SMTP_USER");
  const from =
    process.env.SMTP_FROM || `${APPLICANT_EMAIL.fromName} <${user}>`;
  const notifyTo = process.env.REG_NOTIFY_TO || user;
  const sendApplicantConfirmation =
    (process.env.REG_SEND_APPLICANT_CONFIRMATION || "true").toLowerCase() === "true";

  const transporter = getMailTransporter();

  const adminSend = transporter.sendMail({
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
      `Page URL:      ${data.pageUrl}`,
      `Submitted:     ${timestamp}`,
    ].join("\n"),
    html: adminHtml(data, timestamp),
  });

  const applicantSend = sendApplicantConfirmation
    ? renderApplicantEmailHtml(data.fullName).then((html) =>
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
      )
    : Promise.resolve();

  await Promise.all([adminSend, applicantSend]);
}

function adminHtml(data: RegistrationInput, timestamp: string) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px;color:#62748E;font:600 13px Arial;vertical-align:top">${k}</td>` +
    `<td style="padding:6px 12px;color:#0F172B;font:14px Arial;word-break:break-all">${escapeHtml(v)}</td></tr>`;
  return `
  <div style="font-family:Arial,sans-serif;color:#0F172B">
    <h2 style="margin:0 0 12px">New Placement Drive registration</h2>
    <table style="border-collapse:collapse">
      ${row("Name", data.fullName)}
      ${row("Email", data.email)}
      ${row("Phone", data.phone)}
      ${row("College", data.college)}
      ${row("Qualification", data.qualification)}
      ${row("Page URL", data.pageUrl)}
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
