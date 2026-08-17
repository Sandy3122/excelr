import type { AutomationKind, Channel } from "./types";
import { AUTOMATION_KINDS } from "./types";
import { istWallClockToUtc } from "./ist";

export type ScheduleSpec =
  | { type: "immediate" }
  | { type: "delay_after_register"; delayMs: number }
  | { type: "at"; atIst: string };

export interface AutomationDef {
  kind: AutomationKind;
  title: string;
  description: string;
  channels: Channel[];
  schedule: ScheduleSpec;
  scheduleLabel: string;
  whatsappTemplateName: string;
  emailSubject?: string;
  emailTemplate?: "welcome" | "reminder_day_before";
}

export const THINGS_TO_CARRY_CUTOFF_IST = "2026-08-22T08:45:00";
export const REMINDER_DAY_BEFORE_IST = "2026-08-21T12:00:00";
export const REMINDER_EVENT_DAY_IST = "2026-08-22T08:50:00";

export const AUTOMATIONS: Record<AutomationKind, AutomationDef> = {
  welcome: {
    kind: "welcome",
    title: "Welcome",
    description: "As soon as the form is submitted",
    channels: ["whatsapp", "email"],
    schedule: { type: "immediate" },
    scheduleLabel: "Immediately on registration",
    whatsappTemplateName:
      process.env.INFOBIP_CONFIRMATION_TEMPLATE_NAME ||
      "fsd_placement_drive_confirmation_message_a",
    emailSubject:
      "You're confirmed: Java Full Stack Placement Drive — 22 Aug, Marathahalli",
    emailTemplate: "welcome",
  },
  things_to_carry: {
    kind: "things_to_carry",
    title: "Things to carry",
    description: "1 hour after the person registers",
    channels: ["whatsapp"],
    schedule: { type: "delay_after_register", delayMs: 60 * 60 * 1000 },
    scheduleLabel: "1 hour after registration (held overnight if needed)",
    whatsappTemplateName:
      process.env.INFOBIP_THINGS_TO_CARRY_TEMPLATE_NAME ||
      "fsd_placement_drive_things_2_carry_a",
  },
  reminder_day_before: {
    kind: "reminder_day_before",
    title: "Reminder — day before",
    description: "Friday 21 August, 12:00 PM IST",
    channels: ["whatsapp", "email"],
    schedule: { type: "at", atIst: REMINDER_DAY_BEFORE_IST },
    scheduleLabel: "Friday, 21 August 2026 · 12:00 PM IST",
    whatsappTemplateName:
      process.env.INFOBIP_REMINDER_21AUG_TEMPLATE_NAME ||
      "fsd_placement_drive_reminder_message_21aug_a",
    emailSubject: "Tomorrow, 9:00 AM — your Java Full Stack Placement Drive",
    emailTemplate: "reminder_day_before",
  },
  reminder_event_day: {
    kind: "reminder_event_day",
    title: "Reminder — event day",
    description: "Saturday 22 August, 8:50 AM IST",
    channels: ["whatsapp"],
    schedule: { type: "at", atIst: REMINDER_EVENT_DAY_IST },
    scheduleLabel: "Saturday, 22 August 2026 · 8:50 AM IST",
    whatsappTemplateName:
      process.env.INFOBIP_REMINDER_22AUG_TEMPLATE_NAME ||
      "fsd_placement_drive_reminder_message_22aug_a",
  },
};

export const CRON_AUTOMATION_KINDS: AutomationKind[] = [
  "things_to_carry",
  "reminder_day_before",
  "reminder_event_day",
];

export function isAutomationKind(value: string): value is AutomationKind {
  return (AUTOMATION_KINDS as readonly string[]).includes(value);
}

export function getAutomation(kind: AutomationKind): AutomationDef {
  return AUTOMATIONS[kind];
}

export function scheduledSendAt(kind: AutomationKind): Date | null {
  const spec = AUTOMATIONS[kind].schedule;
  if (spec.type !== "at") return null;
  return istWallClockToUtc(spec.atIst);
}

export function thingsToCarryCutoff(): Date {
  return istWallClockToUtc(THINGS_TO_CARRY_CUTOFF_IST);
}
