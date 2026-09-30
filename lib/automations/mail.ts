import {
  getRegistrationMailTransporter,
  registrationMailFrom,
} from "@/lib/reg-admin-alert";
import {
  APPLICANT_REPLY_TO,
  renderAutomationEmailHtml,
  automationEmailText,
} from "@/lib/reg-email";
import { firstNameFrom } from "@/lib/first-name";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import type { PlacementDrive } from "@/lib/drives/types";
import type { AutomationKind } from "./types";

/**
 * Send one automation's email for a lead. Which template and subject to use is
 * the drive's decision; rendering and delivery are the code's.
 */
export async function sendAutomationEmail(
  drive: PlacementDrive,
  kind: AutomationKind,
  reg: StoredRegistration,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const automation = drive.automations[kind];
  const template = automation?.emailTemplate;
  if (!automation?.enabled || !template) return { ok: true };

  const subject = (automation.emailSubject || "").trim();
  if (!subject) {
    return {
      ok: false,
      error: `No email subject configured for the "${kind}" automation on "${drive.name}".`,
    };
  }

  const firstName = reg.firstName || firstNameFrom(reg.fullName);

  try {
    // Passing the drive resolves its own template folder and fills
    // {{calendar_link}} from the drive's event day.
    const html = await renderAutomationEmailHtml(template, reg.fullName, drive);
    await getRegistrationMailTransporter().sendMail({
      from: registrationMailFrom(),
      to: reg.email,
      replyTo: APPLICANT_REPLY_TO,
      subject,
      html,
      text: automationEmailText(template, firstName, drive),
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "EMAIL_SEND_FAILED",
    };
  }
}
