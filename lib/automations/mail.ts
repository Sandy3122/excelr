import {
  getRegistrationMailTransporter,
  registrationMailFrom,
} from "@/lib/reg-admin-alert";
import {
  APPLICANT_EMAIL,
  REMINDER_DAY_BEFORE_EMAIL,
  renderApplicantEmailHtml,
  renderReminderDayBeforeEmailHtml,
} from "@/lib/reg-email";
import { firstNameFrom } from "@/lib/first-name";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import type { AutomationKind } from "./types";

export async function sendAutomationEmail(
  kind: AutomationKind,
  reg: StoredRegistration,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (kind !== "welcome" && kind !== "reminder_day_before") {
    return { ok: true };
  }

  const firstName = reg.firstName || firstNameFrom(reg.fullName);
  const from = registrationMailFrom();
  const transporter = getRegistrationMailTransporter();

  try {
    if (kind === "welcome") {
      const html = await renderApplicantEmailHtml(reg.fullName);
      await transporter.sendMail({
        from,
        to: reg.email,
        replyTo: APPLICANT_EMAIL.replyTo,
        subject: APPLICANT_EMAIL.subject,
        html,
        text: [
          `Hi ${firstName},`,
          "",
          "Your seat is confirmed for the Java Full Stack Placement Drive.",
          "",
          "Date:  Saturday, 22nd August 2026",
          "Time:  9:00 AM onwards (registration 8:45 – 9:00 AM)",
          "Venue: ExcelR — Marathahalli Campus, Bengaluru 560037",
          "",
          "— Team ExcelR, Placement & Career Services",
        ].join("\n"),
      });
      return { ok: true };
    }

    const html = await renderReminderDayBeforeEmailHtml(reg.fullName);
    await transporter.sendMail({
      from,
      to: reg.email,
      replyTo: REMINDER_DAY_BEFORE_EMAIL.replyTo,
      subject: REMINDER_DAY_BEFORE_EMAIL.subject,
      html,
      text: [
        `Hi ${firstName},`,
        "",
        "This is a reminder: your Java Full Stack Placement Drive is tomorrow, Saturday 22 August, 9:00 AM onwards at ExcelR Marathahalli Campus.",
        "",
        "Please bring your laptop, resume copies, and a valid photo ID. Arrive by 8:45 AM for registration.",
        "",
        "— Team ExcelR, Placement & Career Services",
      ].join("\n"),
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "EMAIL_SEND_FAILED",
    };
  }
}
