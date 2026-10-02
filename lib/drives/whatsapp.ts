/**
 * Turns a placement drive into the WhatsApp settings the send layer needs.
 *
 * Two kinds of setting, handled differently:
 *
 *  - **Account-level** (sender, template language, the OTP template) belongs to
 *    the Infobip account, so a drive that leaves it blank inherits the value
 *    from the environment. Swapping Infobip accounts is then an env change.
 *  - **Campaign-level** (each automation's template) is owned by the drive. It
 *    is seeded from the account defaults when the drive is created, and after
 *    that the drive is authoritative - no silent fallback at send time, since
 *    quietly sending another campaign's template is worse than failing.
 */

import {
  getInfobipAccount,
  whatsappAccountDefaults,
  type InfobipSendConfig,
} from "@/lib/whatsapp-otp/config";
import type { AutomationKind } from "@/lib/automations/types";
import type { PlacementDrive, WhatsAppLimits } from "./types";

export class DriveConfigurationError extends Error {
  constructor(
    public readonly driveSlug: string,
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "DriveConfigurationError";
  }
}

/** Account credentials merged with the drive's sender and language. */
export function driveSendConfig(drive: PlacementDrive): InfobipSendConfig {
  const account = getInfobipAccount();
  const defaults = whatsappAccountDefaults();
  const sender = (drive.whatsapp.sender || defaults.sender).trim();
  if (!sender) {
    throw new DriveConfigurationError(
      drive.slug,
      "whatsapp.sender",
      `No WhatsApp sender for "${drive.name}". Set one on the drive, or set INFOBIP_WHATSAPP_SENDER.`,
    );
  }
  return {
    baseUrl: account.baseUrl,
    apiKey: account.apiKey,
    sender,
    language: (drive.whatsapp.language || defaults.language).trim(),
  };
}

export function driveOtpTemplate(drive: PlacementDrive): {
  templateName: string;
  urlButtonParam: string;
} {
  const defaults = whatsappAccountDefaults();
  const templateName = (
    drive.whatsapp.otpTemplateName || defaults.otpTemplateName
  ).trim();
  if (!templateName) {
    throw new DriveConfigurationError(
      drive.slug,
      "whatsapp.otpTemplateName",
      `No OTP template for "${drive.name}". Set it under Placement Drives → ` +
        `WhatsApp, or set INFOBIP_TEMPLATE_NAME.`,
    );
  }
  return {
    templateName,
    urlButtonParam: (
      drive.whatsapp.otpUrlButtonParam || defaults.otpUrlButtonParam
    ).trim(),
  };
}

/**
 * What a drive will actually use once account defaults are applied. Shown in
 * the admin panel so a blank field reads as "inherited", not "broken".
 */
export function effectiveWhatsAppSettings(drive: PlacementDrive) {
  const defaults = whatsappAccountDefaults();
  return {
    sender: (drive.whatsapp.sender || defaults.sender).trim(),
    language: (drive.whatsapp.language || defaults.language).trim(),
    otpTemplateName: (
      drive.whatsapp.otpTemplateName || defaults.otpTemplateName
    ).trim(),
    otpUrlButtonParam: (
      drive.whatsapp.otpUrlButtonParam || defaults.otpUrlButtonParam
    ).trim(),
    accountDefaults: defaults,
  };
}

/** Template for one automation; throws when the admin has not set it. */
export function driveAutomationTemplate(
  drive: PlacementDrive,
  kind: AutomationKind,
): string {
  const name = (drive.automations[kind]?.whatsappTemplateName || "").trim();
  if (!name) {
    throw new DriveConfigurationError(
      drive.slug,
      `automations.${kind}.whatsappTemplateName`,
      `No WhatsApp template configured for the "${kind}" automation on "${drive.name}".`,
    );
  }
  return name;
}

export function driveLimits(drive: PlacementDrive): WhatsAppLimits {
  return drive.whatsapp.limits;
}

/**
 * Whether a drive is fully configured for WhatsApp sending. Used by the admin
 * UI to warn before an automation silently fails at send time.
 */
export function driveWhatsAppIssues(drive: PlacementDrive): string[] {
  const issues: string[] = [];
  const effective = effectiveWhatsAppSettings(drive);
  // Blank on the drive is fine when the account supplies a default.
  if (!effective.otpTemplateName) {
    issues.push("No OTP template - set one here or in INFOBIP_TEMPLATE_NAME.");
  }
  if (!effective.sender) {
    issues.push("No WhatsApp sender - set one here or in INFOBIP_WHATSAPP_SENDER.");
  }
  for (const [kind, automation] of Object.entries(drive.automations)) {
    if (!automation.enabled) continue;
    if (!automation.channels.includes("whatsapp")) continue;
    if (!automation.whatsappTemplateName.trim()) {
      issues.push(`"${kind}" has no WhatsApp template.`);
    }
  }
  return issues;
}
