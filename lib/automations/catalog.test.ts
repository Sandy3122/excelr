import { describe, expect, it } from "vitest";
import { channelsForAutomationRun, automationSupportsEmail } from "./catalog";

describe("automationSupportsEmail", () => {
  it("is true for welcome and day-before reminder", () => {
    expect(automationSupportsEmail("welcome")).toBe(true);
    expect(automationSupportsEmail("reminder_day_before")).toBe(true);
  });

  it("is false for WhatsApp-only automations", () => {
    expect(automationSupportsEmail("things_to_carry")).toBe(false);
    expect(automationSupportsEmail("reminder_event_day")).toBe(false);
  });
});

describe("channelsForAutomationRun", () => {
  it("sends catalog channels on cron", () => {
    expect(channelsForAutomationRun("welcome", { triggeredBy: "cron" })).toEqual([
      "whatsapp",
      "email",
    ]);
  });

  it("defaults admin sends to WhatsApp only", () => {
    expect(
      channelsForAutomationRun("welcome", { triggeredBy: "admin" }),
    ).toEqual(["whatsapp"]);
    expect(
      channelsForAutomationRun("welcome", {
        triggeredBy: "admin",
        includeEmail: false,
      }),
    ).toEqual(["whatsapp"]);
  });

  it("includes email for admin when opted in", () => {
    expect(
      channelsForAutomationRun("welcome", {
        triggeredBy: "admin",
        includeEmail: true,
      }),
    ).toEqual(["whatsapp", "email"]);
  });

  it("does not add email for WhatsApp-only kinds", () => {
    expect(
      channelsForAutomationRun("things_to_carry", {
        triggeredBy: "admin",
        includeEmail: true,
      }),
    ).toEqual(["whatsapp"]);
  });
});
