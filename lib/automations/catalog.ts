/**
 * The four automations the code knows how to run.
 *
 * Only presentation labels live here. Whether an automation is enabled, when it
 * fires, which channels it uses and which template it sends are all read from
 * the placement drive document.
 */

import { AUTOMATION_KINDS, type AutomationKind, type Channel } from "./types";
import type { DriveAutomationConfig, DriveAutomations } from "@/lib/drives/types";

export interface AutomationMeta {
  kind: AutomationKind;
  title: string;
  description: string;
}

export const AUTOMATION_META: Record<AutomationKind, AutomationMeta> = {
  welcome: {
    kind: "welcome",
    title: "Welcome",
    description: "As soon as the form is submitted",
  },
  things_to_carry: {
    kind: "things_to_carry",
    title: "Things to carry",
    description: "A while after registering, before the drive starts",
  },
  reminder_day_before: {
    kind: "reminder_day_before",
    title: "Reminder - day before",
    description: "The day before the drive",
  },
  reminder_event_day: {
    kind: "reminder_event_day",
    title: "Reminder - event day",
    description: "On the morning of the drive",
  },
};

/** Automations the cron ticks. `welcome` is sent inline by /api/reg. */
export const CRON_AUTOMATION_KINDS: AutomationKind[] = [
  "things_to_carry",
  "reminder_day_before",
  "reminder_event_day",
];

export function isAutomationKind(value: string): value is AutomationKind {
  return (AUTOMATION_KINDS as readonly string[]).includes(value);
}

export function automationMeta(kind: AutomationKind): AutomationMeta {
  return AUTOMATION_META[kind];
}

export function getDriveAutomation(
  automations: DriveAutomations,
  kind: AutomationKind,
): DriveAutomationConfig {
  return automations[kind];
}

export function automationSupportsEmail(
  automations: DriveAutomations,
  kind: AutomationKind,
): boolean {
  return automations[kind]?.channels.includes("email") ?? false;
}

/**
 * Cron uses every channel the drive enables. Admin sends WhatsApp by default and
 * only adds email when explicitly asked.
 */
export function channelsForAutomationRun(
  automations: DriveAutomations,
  kind: AutomationKind,
  options: { triggeredBy: "cron" | "admin"; includeEmail?: boolean },
): Channel[] {
  const allowed = automations[kind]?.channels ?? [];
  if (options.triggeredBy === "cron" || options.includeEmail === true) {
    return [...allowed];
  }
  return allowed.filter((channel) => channel === "whatsapp");
}

/**
 * Template a drive will send for one automation. Empty means the drive has not
 * been configured - callers must fail loudly rather than guess a template.
 */
export function whatsappTemplateFor(
  automations: DriveAutomations,
  kind: AutomationKind,
): string {
  return (automations[kind]?.whatsappTemplateName || "").trim();
}
