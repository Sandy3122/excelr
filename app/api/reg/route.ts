import { NextResponse } from "next/server";
import { z } from "zod";
import { registrationSchema, type RegistrationInput } from "@/lib/reg-schema";
import { renderAutomationEmailHtml, automationEmailText, APPLICANT_REPLY_TO } from "@/lib/reg-email";
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
import { sendNamedWhatsAppTemplate } from "@/lib/whatsapp-otp/infobip";
import { hasInfobipConfig } from "@/lib/whatsapp-otp/config";
import {
  DriveConfigurationError,
  driveAutomationTemplate,
  driveSendConfig,
} from "@/lib/drives/whatsapp";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import {
  DuplicateRegistrationError,
  getRegistrationById,
  listRegistrations,
  saveRegistration,
} from "@/lib/firebase/registrations";
import { persistChannelDelivery } from "@/lib/automations/store";
import { emptyChannelDelivery } from "@/lib/automations/types";
import { driveScheduleContext } from "@/lib/automations/schedule";
import { firstNameFrom } from "@/lib/first-name";
import { REGISTRATION_CLOSED_MESSAGE } from "@/lib/registration-window";
import { driveWindowStatus } from "@/lib/registration-window-store";
import { notifyRegistrationWebhook } from "@/lib/reg-webhook";
import { resolvePublicDrive } from "@/lib/drives/request";
import { getDriveById, getDriveBySlug } from "@/lib/drives/store";
import type { PlacementDrive } from "@/lib/drives/types";

// Nodemailer + Firestore Admin need the Node runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).max(256).optional(),
  id: z.string().trim().min(1).max(256).optional(),
  driveId: z.string().trim().min(1).max(256).optional(),
  driveSlug: z.string().trim().min(1).max(80).optional(),
});

/**
 * Admin-only listing/read of stored registrations for one drive.
 * Header: `Authorization: Bearer <REG_ADMIN_API_KEY>` or `x-admin-key`.
 */
export async function GET(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
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
    driveId: url.searchParams.get("driveId") ?? undefined,
    driveSlug: url.searchParams.get("driveSlug") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid query parameters." },
      { status: 400 },
    );
  }

  // Reads are always scoped to one drive — there is no cross-campaign listing.
  const drive = parsed.data.driveId
    ? await getDriveById(parsed.data.driveId)
    : parsed.data.driveSlug
      ? await getDriveBySlug(parsed.data.driveSlug)
      : null;
  if (!drive) {
    return NextResponse.json(
      { ok: false, error: "Specify a known driveId or driveSlug." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.id) {
      const registration = await getRegistrationById(drive.id, parsed.data.id);
      if (!registration) {
        return NextResponse.json(
          { ok: false, error: "Registration not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, registration });
    }

    const result = await listRegistrations(drive.id, {
      limit: parsed.data.limit ?? 50,
      cursor: parsed.data.cursor,
    });
    return NextResponse.json({ ok: true, placementDriveId: drive.id, ...result });
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

  const resolved = await resolvePublicDrive(data.driveSlug);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }
  const drive = resolved.drive;

  if (driveWindowStatus(drive).closed) {
    return NextResponse.json(
      { ok: false, error: REGISTRATION_CLOSED_MESSAGE, code: "REGISTRATIONS_CLOSED" },
      { status: 403 },
    );
  }

  // The WhatsApp number must have been verified via OTP *for this drive* before
  // we accept the registration. We peek here (non-destructive) and only consume
  // the marker after the emails go out, so a transient email failure lets the
  // user retry without re-verifying.
  const { verified, phone } = await isPhoneVerified(drive, data.phone);
  if (!verified) {
    return NextResponse.json(
      { ok: false, error: "Please verify your WhatsApp number before registering." },
      { status: 403 },
    );
  }
  // Use the normalized E.164 number everywhere downstream.
  if (phone) data.phone = phone.e164;

  const ctx = driveScheduleContext(drive);
  const alertDetails = {
    Drive: drive.slug,
    Name: data.fullName,
    Email: data.email,
    Phone: data.phone,
    "Page URL": data.pageUrl,
  };

  let savedId = "";
  let created = false;
  try {
    const saved = await saveRegistration(drive, ctx, data, timestamp);
    savedId = saved.id;
    created = saved.created;
  } catch (err) {
    if (err instanceof DuplicateRegistrationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error("[reg] Firestore save failed:", err);
    await notifyAdminOfFailure({
      step: "firestore_save",
      reason:
        err instanceof Error
          ? err.message
          : "Failed to save registration to Firestore.",
      details: alertDetails,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't save your registration. Please try again in a moment.",
      },
      { status: 500 },
    );
  }

  if (created) {
    await notifyRegistrationWebhook({
      drive,
      id: savedId,
      data,
      submittedAt: timestamp,
    });
  }

  const welcome = drive.automations.welcome;
  const existing = savedId
    ? await getRegistrationById(drive.id, savedId).catch(() => null)
    : null;
  const welcomeEmailStatus = existing?.messages?.welcome?.email?.status;
  const welcomeWaStatus = existing?.messages?.welcome?.whatsapp?.status;
  const sendWelcomeEmail =
    welcome.enabled &&
    welcome.channels.includes("email") &&
    welcomeEmailStatus !== "sent" &&
    welcomeEmailStatus !== "legacy";
  const sendWelcomeWhatsApp =
    welcome.enabled &&
    welcome.channels.includes("whatsapp") &&
    welcomeWaStatus !== "sent" &&
    welcomeWaStatus !== "legacy";

  // Email is required on every successful registration.
  try {
    await sendEmails(drive, data, timestamp, { sendApplicant: sendWelcomeEmail });
    if (savedId && sendWelcomeEmail) {
      await persistChannelDelivery(drive.id, savedId, "welcome", "email", {
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
      details: alertDetails,
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
      await consumePhoneVerification(drive, data.phone);
    } catch (err) {
      console.error("[reg] Failed to consume phone verification marker:", err);
      await notifyAdminOfFailure({
        step: "consume_phone_verification",
        reason:
          err instanceof Error
            ? err.message
            : "Failed to consume WhatsApp verification marker.",
        details: alertDetails,
      });
    }
  })();
  const whatsappPromise = sendWelcomeWhatsApp
    ? sendWhatsAppConfirmation(drive, data, phone, savedId)
    : Promise.resolve();

  await Promise.all([consumePromise, whatsappPromise]);

  return NextResponse.json({ ok: true });
}

async function sendWhatsAppConfirmation(
  drive: PlacementDrive,
  data: RegistrationInput,
  phone: Awaited<ReturnType<typeof isPhoneVerified>>["phone"],
  registrationId?: string,
) {
  const alertDetails = {
    Drive: drive.slug,
    Name: data.fullName,
    Email: data.email,
    Phone: phone?.masked || data.phone,
    "Page URL": data.pageUrl,
  };

  const fail = async (reason: string) => {
    console.error("[reg] WhatsApp confirmation skipped:", reason);
    if (registrationId) {
      await persistChannelDelivery(drive.id, registrationId, "welcome", "whatsapp", {
        ...emptyChannelDelivery("failed"),
        error: reason,
      });
    }
    await notifyAdminOfFailure({
      step: "whatsapp_confirmation",
      reason,
      details: alertDetails,
    });
  };

  if (!hasInfobipConfig()) {
    await fail("Infobip is not configured (missing API key or base URL).");
    return;
  }
  if (!phone) {
    await fail("Normalized phone was missing after verification.");
    return;
  }

  let sendConfig;
  let templateName: string;
  try {
    sendConfig = driveSendConfig(drive);
    templateName = driveAutomationTemplate(drive, "welcome");
  } catch (err) {
    await fail(
      err instanceof DriveConfigurationError
        ? err.message
        : "Could not resolve the welcome WhatsApp template.",
    );
    return;
  }

  const firstName = firstNameFrom(data.fullName);
  try {
    const wa = await sendNamedWhatsAppTemplate(
      sendConfig,
      phone.infobip,
      firstName,
      templateName,
    );
    if (!wa.ok) {
      await fail("Infobip rejected or failed the welcome WhatsApp template send.");
      return;
    }
    if (registrationId) {
      await persistChannelDelivery(drive.id, registrationId, "welcome", "whatsapp", {
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
    await fail(
      err instanceof Error
        ? err.message
        : "Unexpected error sending welcome WhatsApp message.",
    );
  }
}

async function sendEmails(
  drive: PlacementDrive,
  data: RegistrationInput,
  timestamp: string,
  opts: { sendApplicant: boolean },
) {
  const from = registrationMailFrom();
  const notifyTo = registrationNotifyTo();
  const applicantEnabled =
    (process.env.REG_SEND_APPLICANT_CONFIRMATION || "true").toLowerCase() === "true";

  const transporter = getRegistrationMailTransporter();
  const welcome = drive.automations.welcome;

  const adminSend = transporter.sendMail({
    from,
    to: notifyTo,
    replyTo: data.email,
    subject: `New registration — ${drive.name} — ${data.fullName}`,
    text: [
      `New registration for ${drive.name}:`,
      "",
      `Drive:         ${drive.name} (/${drive.slug})`,
      `Name:          ${data.fullName}`,
      `Email:         ${data.email}`,
      `Phone:         ${data.phone}`,
      `College:       ${data.college}`,
      `Qualification: ${data.qualification}`,
      `Page URL:      ${data.pageUrl}`,
      `Submitted:     ${timestamp}`,
    ].join("\n"),
    html: adminHtml(drive, data, timestamp),
  });

  const applicantSend =
    applicantEnabled && opts.sendApplicant && welcome.emailTemplate
      ? renderAutomationEmailHtml(welcome.emailTemplate, data.fullName, drive).then(
          (html) =>
            transporter.sendMail({
              from,
              to: data.email,
              replyTo: APPLICANT_REPLY_TO,
              subject:
                welcome.emailSubject?.trim() || `You're confirmed: ${drive.name}`,
              text: automationEmailText(
                welcome.emailTemplate!,
                data.fullName.split(/\s+/)[0] || "there",
                drive,
              ),
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
        Drive: drive.slug,
        Name: data.fullName,
        Email: data.email,
        Phone: data.phone,
        "Page URL": data.pageUrl,
      },
    });
    throw new Error(reason);
  }
}

function adminHtml(
  drive: PlacementDrive,
  data: RegistrationInput,
  timestamp: string,
) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px;color:#62748E;font:600 13px Arial;vertical-align:top">${k}</td>` +
    `<td style="padding:6px 12px;color:#0F172B;font:14px Arial;word-break:break-all">${escapeHtml(v)}</td></tr>`;
  return `
  <div style="font-family:Arial,sans-serif;color:#0F172B">
    <h2 style="margin:0 0 12px">New registration — ${escapeHtml(drive.name)}</h2>
    <table style="border-collapse:collapse">
      ${row("Drive", `${drive.name} (/${drive.slug})`)}
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
