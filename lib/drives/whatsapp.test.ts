import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DriveConfigurationError,
  driveAutomationTemplate,
  driveOtpTemplate,
  driveSendConfig,
  driveWhatsAppIssues,
  effectiveWhatsAppSettings,
} from "./whatsapp";
import { defaultDriveConfig } from "./types";
import type { PlacementDrive } from "./types";

const ENV = { ...process.env };

function drive(overrides: Partial<PlacementDrive> = {}): PlacementDrive {
  return {
    id: "d1",
    ...defaultDriveConfig({ name: "Test Drive", slug: "test-drive" }),
    createdAt: null,
    updatedAt: null,
    ...overrides,
  } as PlacementDrive;
}

beforeEach(() => {
  process.env.INFOBIP_API_KEY = "key";
  process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
  process.env.INFOBIP_WHATSAPP_SENDER = "918050162541";
  process.env.INFOBIP_TEMPLATE_NAME = "account_otp_template";
  process.env.INFOBIP_TEMPLATE_LANGUAGE = "en_IN";
  process.env.INFOBIP_TEMPLATE_URL_BUTTON_PARAM = "otp";
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("account defaults", () => {
  it("a blank drive field inherits the account value", () => {
    const e = effectiveWhatsAppSettings(drive());
    expect(e.sender).toBe("918050162541");
    expect(e.language).toBe("en_IN");
    expect(e.otpTemplateName).toBe("account_otp_template");
    expect(e.otpUrlButtonParam).toBe("otp");
  });

  it("a value set on the drive overrides the account", () => {
    const d = drive();
    d.whatsapp.sender = "919999999999";
    d.whatsapp.otpTemplateName = "campaign_otp";
    const e = effectiveWhatsAppSettings(d);
    expect(e.sender).toBe("919999999999");
    expect(e.otpTemplateName).toBe("campaign_otp");
    // Untouched fields still inherit.
    expect(e.language).toBe("en_IN");
  });

  it("sends with the inherited sender, language and template", () => {
    expect(driveSendConfig(drive())).toMatchObject({
      sender: "918050162541",
      language: "en_IN",
    });
    expect(driveOtpTemplate(drive())).toEqual({
      templateName: "account_otp_template",
      urlButtonParam: "otp",
    });
  });

  it("swapping the Infobip account needs no drive edit", () => {
    process.env.INFOBIP_WHATSAPP_SENDER = "918888888888";
    process.env.INFOBIP_TEMPLATE_NAME = "new_account_otp";
    expect(driveOtpTemplate(drive()).templateName).toBe("new_account_otp");
    expect(driveSendConfig(drive()).sender).toBe("918888888888");
  });

  it("fails clearly when neither the drive nor the account has a template", () => {
    delete process.env.INFOBIP_TEMPLATE_NAME;
    expect(() => driveOtpTemplate(drive())).toThrow(DriveConfigurationError);
  });

  it("reports no issues when the account supplies the defaults", () => {
    const d = drive();
    // A new drive is seeded with automation templates at creation; simulate that.
    for (const kind of Object.keys(d.automations) as (keyof typeof d.automations)[]) {
      d.automations[kind].whatsappTemplateName = "tpl";
    }
    expect(driveWhatsAppIssues(d)).toEqual([]);
  });

  it("flags a missing OTP template only when the account has none either", () => {
    delete process.env.INFOBIP_TEMPLATE_NAME;
    const issues = driveWhatsAppIssues(drive());
    expect(issues.some((i) => i.includes("OTP template"))).toBe(true);
  });
});

describe("per-automation templates stay campaign-owned", () => {
  it("never silently falls back to the account template", () => {
    process.env.INFOBIP_CONFIRMATION_TEMPLATE_NAME = "account_welcome";
    // Drive created without seeding - the send must fail rather than guess.
    expect(() => driveAutomationTemplate(drive(), "welcome")).toThrow(
      DriveConfigurationError,
    );
  });

  it("is seeded from the account when a drive is created", () => {
    const seeded = defaultDriveConfig({
      name: "New",
      slug: "new-drive",
      automationTemplates: { welcome: "account_welcome" },
    });
    expect(seeded.automations.welcome.whatsappTemplateName).toBe(
      "account_welcome",
    );
  });
});
