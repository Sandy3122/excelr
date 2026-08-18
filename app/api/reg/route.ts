import { NextResponse } from "next/server";
import { z } from "zod";
import { registrationSchema, type RegistrationInput } from "@/lib/reg-schema";
import { APPLICANT_EMAIL, renderApplicantEmailHtml } from "@/lib/reg-email";
import {
  getRegistrationMailTransporter,
  notifyAdminOfFailure,
  registrationMailFrom,
  registrationNotifyTo,
} from "@/lib/reg-admin-alert";
import {
  consumePhoneVerification,
  isPhoneVerified,
} from "@/lib/whatsapp-otp/service";
import { sendRegistrationConfirmationWhatsApp } from "@/lib/whatsapp-otp/infobip";
import { hasInfobipConfig } from "@/lib/whatsapp-otp/config";
import { isRegAdminAuthorized } from "@/lib/firebase/admin-auth";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import {
  DuplicateRegistrationError,
  getRegistrationById,
  listRegistrations,
  saveRegistration,
} from "@/lib/firebase/registrations";
import { persistChannelDelivery } from "@/lib/automations/store";
import { emptyChannelDelivery } from "@/lib/automations/types";
import { firstNameFrom } from "@/lib/first-name";

// Nodemailer + Firestore Admin need the Node runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).max(256).optional(),
  id: z.string().trim().min(1).max(256).optional(),
});

/**
 * Admin-only listing/read of stored registrations.
 * Header: `Authorization: Bearer <REG_ADMIN_API_KEY>` or `x-admin-key`.
 */
export async function GET(req: Request) {
  if (!isRegAdminAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    id: url.searchParams.get("id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.id) {
      const registration = await getRegistrationById(parsed.data.id);
      if (!registration) {
        return NextResponse.json(
          { ok: false, error: "Registration not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, registration });
    }

    const result = await listRegistrations({
      limit: parsed.data.limit ?? 50,
      cursor: parsed.data.cursor,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[reg] Firestore read failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load registrations." },
      { status: 500 },
    );
  }
}

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

  let savedId = "";
  try {
    const saved = await saveRegistration(data, timestamp);
    savedId = saved.id;
  } catch (err) {
    if (err instanceof DuplicateRegistrationError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 409 },
      );
    }
    console.error("[reg] Firestore save failed:", err);
    await notifyAdminOfFailure({
      step: "firestore_save",
      reason:
        err instanceof Error
          ? err.message
          : "Failed to save registration to Firestore.",
      details: {
        Name: data.fullName,
        Email: data.email,
        Phone: data.phone,
        "Page URL": data.pageUrl,
      },
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "We couldn't save your registration. Please try again in a moment.",
      },
      { status: 500 },
    );
  }

  const existing = savedId ? await getRegistrationById(savedId).catch(() => null) : null;
  const welcomeEmailStatus = existing?.messages?.welcome?.email?.status;
  const welcomeWaStatus = existing?.messages?.welcome?.whatsapp?.status;
  const shouldSendWelcomeEmail =
    welcomeEmailStatus !== "sent" && welcomeEmailStatus !== "legacy";
  const shouldSendWelcomeWhatsApp =
    welcomeWaStatus !== "sent" && welcomeWaStatus !== "legacy";

  // Email is required on every successful registration.
  try {
    await sendEmails(data, timestamp, { skipApplicant: !shouldSendWelcomeEmail });
    if (savedId && shouldSendWelcomeEmail) {
      await persistChannelDelivery(savedId, "welcome", "email", {
        ...emptyChannelDelivery("sent"),
        sentAt: timestamp,
      });
    }
  } catch (err) {
    console.error("[reg] Nodemailer send failed:", err);
    await notifyAdminOfFailure({
      step: "registration_email",
      reason:
        err instanceof Error
          ? err.message
          : "Nodemailer failed while sending registration emails.",
      details: {
        Name: data.fullName,
        Email: data.email,
        Phone: data.phone,
        "Page URL": data.pageUrl,
      },
    });
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
  const consumePromise = (async () => {
    try {
      await consumePhoneVerification(data.phone);
    } catch (err) {
      console.error("[reg] Failed to consume phone verification marker:", err);
      await notifyAdminOfFailure({
        step: "consume_phone_verification",
        reason:
          err instanceof Error
            ? err.message
            : "Failed to consume WhatsApp verification marker.",
        details: {
          Name: data.fullName,
          Email: data.email,
          Phone: data.phone,
        },
      });
    }
  })();
  const whatsappPromise = shouldSendWelcomeWhatsApp
    ? sendWhatsAppConfirmation(data, phone, savedId)
    : Promise.resolve();

  await Promise.all([consumePromise, whatsappPromise]);

  return NextResponse.json({ ok: true });
}

async function sendWhatsAppConfirmation(
  data: RegistrationInput,
  phone: Awaited<ReturnType<typeof isPhoneVerified>>["phone"],
  registrationId?: string,
) {
  const alertDetails = {
    Name: data.fullName,
    Email: data.email,
    Phone: phone?.masked || data.phone,
    "Page URL": data.pageUrl,
  };

  if (!hasInfobipConfig()) {
    console.error(
      "[reg] WhatsApp confirmation skipped: Infobip is not configured.",
    );
    if (registrationId) {
      await persistChannelDelivery(registrationId, "welcome", "whatsapp", {
        ...emptyChannelDelivery("failed"),
        error: "Infobip is not configured (missing API key or base URL).",
      });
    }
    await notifyAdminOfFailure({
      step: "whatsapp_confirmation",
      reason: "Infobip is not configured (missing API key or base URL).",
      details: alertDetails,
    });
    return;
  }
  if (!phone) {
    console.error(
      "[reg] WhatsApp confirmation skipped: normalized phone missing.",
    );
    if (registrationId) {
      await persistChannelDelivery(registrationId, "welcome", "whatsapp", {
        ...emptyChannelDelivery("failed"),
        error: "Normalized phone was missing after verification.",
      });
    }
    await notifyAdminOfFailure({
      step: "whatsapp_confirmation",
      reason: "Normalized phone was missing after verification.",
      details: alertDetails,
    });
    return;
  }

  const firstName = firstNameFrom(data.fullName);
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
      if (registrationId) {
        await persistChannelDelivery(registrationId, "welcome", "whatsapp", {
          ...emptyChannelDelivery("failed"),
          error: "Infobip rejected or failed the welcome WhatsApp template send.",
        });
      }
      await notifyAdminOfFailure({
        step: "whatsapp_confirmation",
        reason: "Infobip rejected or failed the welcome WhatsApp template send.",
        details: { ...alertDetails, "First name": firstName },
      });
      return;
    }
    if (registrationId) {
      await persistChannelDelivery(registrationId, "welcome", "whatsapp", {
        ...emptyChannelDelivery("sent"),
        sentAt: new Date().toISOString(),
        providerMessageId: wa.providerMessageId || null,
      });
    }
    console.info(
      "[reg] WhatsApp confirmation accepted by Infobip for",
      phone.masked,
      wa.providerMessageId ? `(id=${wa.providerMessageId})` : "",
    );
  } catch (err) {
    console.error("[reg] WhatsApp confirmation send failed:", err);
    if (registrationId) {
      await persistChannelDelivery(registrationId, "welcome", "whatsapp", {
        ...emptyChannelDelivery("failed"),
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error sending welcome WhatsApp message.",
      });
    }
    await notifyAdminOfFailure({
      step: "whatsapp_confirmation",
      reason:
        err instanceof Error
          ? err.message
          : "Unexpected error sending welcome WhatsApp message.",
      details: { ...alertDetails, "First name": firstName },
    });
  }
}

async function sendEmails(
  data: RegistrationInput,
  timestamp: string,
  opts?: { skipApplicant?: boolean },
) {
  const from = registrationMailFrom();
  const notifyTo = registrationNotifyTo();
  const sendApplicantConfirmation =
    (process.env.REG_SEND_APPLICANT_CONFIRMATION || "true").toLowerCase() ===
    "true";

  const transporter = getRegistrationMailTransporter();

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

  const applicantSend =
    sendApplicantConfirmation && !opts?.skipApplicant
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

  const results = await Promise.allSettled([adminSend, applicantSend]);
  const adminResult = results[0];
  const applicantResult = results[1];

  if (adminResult.status === "rejected") {
    throw adminResult.reason instanceof Error
      ? adminResult.reason
      : new Error("Admin notification email failed.");
  }

  if (applicantResult.status === "rejected") {
    const reason =
      applicantResult.reason instanceof Error
        ? applicantResult.reason.message
        : "Applicant confirmation email failed.";
    // Admin mail already went out — also send an explicit failure alert.
    await notifyAdminOfFailure({
      step: "applicant_confirmation_email",
      reason,
      details: {
        Name: data.fullName,
        Email: data.email,
        Phone: data.phone,
        "Page URL": data.pageUrl,
      },
    });
    throw new Error(reason);
  }
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
