import { describe, expect, it } from "vitest";
import { channelsForAutomationRun, automationSupportsEmail } from "./catalog";
import { REG_AUG_2026_SEED } from "@/lib/drives/seed-configs";

const AUTOMATIONS = REG_AUG_2026_SEED.automations;

describe("automationSupportsEmail", () => {
  it("is true for welcome and day-before reminder", () => {
    expect(automationSupportsEmail(AUTOMATIONS, "welcome")).toBe(true);
    expect(automationSupportsEmail(AUTOMATIONS, "reminder_day_before")).toBe(true);
  });

  it("is false for WhatsApp-only automations", () => {
    expect(automationSupportsEmail(AUTOMATIONS, "things_to_carry")).toBe(false);
    expect(automationSupportsEmail(AUTOMATIONS, "reminder_event_day")).toBe(false);
  });

  it("follows the drive, not the automation kind", () => {
    const waOnly = {
      ...AUTOMATIONS,
      welcome: { ...AUTOMATIONS.welcome, channels: ["whatsapp" as const] },
    };
    expect(automationSupportsEmail(waOnly, "welcome")).toBe(false);
  });
});

describe("channelsForAutomationRun", () => {
  it("sends the drive's channels on cron", () => {
    expect(
      channelsForAutomationRun(AUTOMATIONS, "welcome", { triggeredBy: "cron" }),
    ).toEqual(["whatsapp", "email"]);
  });

  it("defaults admin sends to WhatsApp only", () => {
    expect(
      channelsForAutomationRun(AUTOMATIONS, "welcome", { triggeredBy: "admin" }),
    ).toEqual(["whatsapp"]);
    expect(
      channelsForAutomationRun(AUTOMATIONS, "welcome", {
        triggeredBy: "admin",
        includeEmail: false,
      }),
    ).toEqual(["whatsapp"]);
  });

  it("includes email for admin when opted in", () => {
    expect(
      channelsForAutomationRun(AUTOMATIONS, "welcome", {
        triggeredBy: "admin",
        includeEmail: true,
      }),
    ).toEqual(["whatsapp", "email"]);
  });

  it("does not add email for WhatsApp-only kinds", () => {
    expect(
      channelsForAutomationRun(AUTOMATIONS, "things_to_carry", {
        triggeredBy: "admin",
        includeEmail: true,
      }),
    ).toEqual(["whatsapp"]);
  });
});
