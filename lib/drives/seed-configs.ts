/**
 * The two drives that existed before campaigns were configurable.
 *
 * These objects encode exactly what used to be hard-coded in
 * `lib/automations/catalog.ts`, `lib/whatsapp-otp/config.ts` and
 * `lib/reg-webhook.ts`. The migration seeds Firestore from them and the
 * scheduling tests assert against them, so "the August drive still behaves the
 * way it did" is a property the suite actually checks.
 *
 * Nothing at runtime reads this file — once migrated, Firestore is the source
 * of truth. It exists for seeding and for tests.
 */

import type { PlacementDriveConfig } from "./types";
import { defaultWhatsAppConfig } from "./types";

/** Infobip templates already approved on the account. */
const TEMPLATES = {
  otp: "fsd_website_otp_11082026",
  confirmation: "fsd_placement_drive_confirmation_message_a",
  thingsToCarry: "fsd_placement_drive_things_2_carry_a",
  reminderDayBefore: "fsd_placement_drive_reminder_message_21aug_a",
  reminderEventDay: "fsd_placement_drive_reminder_message_22aug_a",
} as const;

/**
 * `/reg` — Java Full Stack Placement Drive, 22 August 2026.
 *
 * Reproduces the previous hard-coded behaviour one for one: the 1-hour
 * things-to-carry delay with its 10/5 minute late windows and 08:45 cutoff, the
 * 12:00 day-before reminder with a 15-minute late delay that skips event-day
 * signups and waits on things-to-carry, and the 08:50 event-day reminder.
 */
export const REG_AUG_2026_SEED: PlacementDriveConfig = {
  name: "Java Full Stack Placement Drive — Marathahalli, Aug 2026",
  slug: "reg",
  enabled: true,
  archived: false,
  eventDayIstDate: "2026-08-22",
  dayBeforeIstDate: "2026-08-21",
  registrationClosesAtIso: null,
  eventKey: "java-fullstack-placement-drive",
  webhookUrl: "https://excelr.app.n8n.cloud/webhook/java-fsd-registration",
  whatsapp: {
    ...defaultWhatsAppConfig(),
    otpTemplateName: TEMPLATES.otp,
  },
  automations: {
    welcome: {
      enabled: true,
      channels: ["whatsapp", "email"],
      schedule: { type: "immediate" },
      scheduleLabel: "Immediately on registration",
      whatsappTemplateName: TEMPLATES.confirmation,
      emailSubject:
        "You're confirmed: Java Full Stack Placement Drive — 22 Aug, Marathahalli",
      emailTemplate: "welcome",
      cutoffIst: null,
      lateWindowDelayMinutes: null,
      lastChanceDelayMinutes: null,
      skipOnOrAfterIstDate: null,
      waitForKind: null,
    },
    things_to_carry: {
      enabled: true,
      channels: ["whatsapp"],
      schedule: { type: "delay_after_register", delayMinutes: 60 },
      scheduleLabel: "1 hour after registration; 10 min if late on 21/22 Aug",
      whatsappTemplateName: TEMPLATES.thingsToCarry,
      emailSubject: null,
      emailTemplate: null,
      cutoffIst: "2026-08-22T08:45:00",
      lateWindowDelayMinutes: 10,
      lastChanceDelayMinutes: 5,
      skipOnOrAfterIstDate: null,
      waitForKind: null,
    },
    reminder_day_before: {
      enabled: true,
      channels: ["whatsapp", "email"],
      schedule: {
        type: "at",
        atIst: "2026-08-21T12:00:00",
        lateDelayMinutes: 15,
      },
      scheduleLabel:
        "Friday, 21 August 2026 · 12:00 PM IST (15 min later if they register after noon)",
      whatsappTemplateName: TEMPLATES.reminderDayBefore,
      emailSubject: "Tomorrow, 9:00 AM — your Java Full Stack Placement Drive",
      emailTemplate: "reminder_day_before",
      cutoffIst: null,
      lateWindowDelayMinutes: null,
      lastChanceDelayMinutes: null,
      skipOnOrAfterIstDate: "2026-08-22",
      waitForKind: "things_to_carry",
    },
    reminder_event_day: {
      enabled: true,
      channels: ["whatsapp"],
      schedule: {
        type: "at",
        atIst: "2026-08-22T08:50:00",
        lateDelayMinutes: 10,
      },
      scheduleLabel:
        "Saturday, 22 August 2026 · 8:50 AM IST (10 min later if they register after 8:50)",
      whatsappTemplateName: TEMPLATES.reminderEventDay,
      emailSubject: null,
      emailTemplate: null,
      cutoffIst: null,
      lateWindowDelayMinutes: null,
      lastChanceDelayMinutes: null,
      skipOnOrAfterIstDate: null,
      waitForKind: null,
    },
  },
};

/**
 * `/marathahalli-fsd-oct-2026` — Full Stack (Java & Python), 9–10 October 2026.
 *
 * Two deliberate differences from a pure copy of the old behaviour:
 *
 *  - Dates are the drive's own. Previously this page shared the August
 *    schedule, which meant its things-to-carry and day-before reminders were
 *    permanently skipped (their cutoffs had passed) while the event-day
 *    reminder would have fired the "22 Aug" template at October leads.
 *  - The three reminder automations start **disabled**. Their template names
 *    are seeded so the wiring is visible, but the approved Infobip content
 *    still says August. Enable each one after its October template is live.
 */
export const MARATHAHALLI_OCT_2026_SEED: PlacementDriveConfig = {
  name: "Full Stack Placement Drive — Marathahalli, Oct 2026",
  slug: "marathahalli-fsd-oct-2026",
  enabled: true,
  archived: false,
  eventDayIstDate: "2026-10-09",
  dayBeforeIstDate: "2026-10-08",
  registrationClosesAtIso: null,
  eventKey: "marathahalli-fsd-oct-2026",
  webhookUrl: "https://excelr.app.n8n.cloud/webhook/java-fsd-registration",
  whatsapp: {
    ...defaultWhatsAppConfig(),
    otpTemplateName: TEMPLATES.otp,
  },
  automations: {
    welcome: {
      enabled: true,
      channels: ["whatsapp", "email"],
      schedule: { type: "immediate" },
      scheduleLabel: "Immediately on registration",
      whatsappTemplateName: TEMPLATES.confirmation,
      emailSubject: "You're confirmed: Full Stack Placement Drive — Marathahalli",
      emailTemplate: "welcome",
      cutoffIst: null,
      lateWindowDelayMinutes: null,
      lastChanceDelayMinutes: null,
      skipOnOrAfterIstDate: null,
      waitForKind: null,
    },
    things_to_carry: {
      enabled: false,
      channels: ["whatsapp"],
      schedule: { type: "delay_after_register", delayMinutes: 60 },
      scheduleLabel: "1 hour after registration; 10 min if late on 8/9 Oct",
      whatsappTemplateName: TEMPLATES.thingsToCarry,
      emailSubject: null,
      emailTemplate: null,
      cutoffIst: "2026-10-09T08:45:00",
      lateWindowDelayMinutes: 10,
      lastChanceDelayMinutes: 5,
      skipOnOrAfterIstDate: null,
      waitForKind: null,
    },
    reminder_day_before: {
      enabled: false,
      channels: ["whatsapp", "email"],
      schedule: {
        type: "at",
        atIst: "2026-10-08T12:00:00",
        lateDelayMinutes: 15,
      },
      scheduleLabel: "Thursday, 8 October 2026 · 12:00 PM IST",
      whatsappTemplateName: TEMPLATES.reminderDayBefore,
      emailSubject: "Tomorrow — your Full Stack Placement Drive",
      emailTemplate: "reminder_day_before",
      cutoffIst: null,
      lateWindowDelayMinutes: null,
      lastChanceDelayMinutes: null,
      skipOnOrAfterIstDate: "2026-10-09",
      waitForKind: "things_to_carry",
    },
    reminder_event_day: {
      enabled: false,
      channels: ["whatsapp"],
      schedule: {
        type: "at",
        atIst: "2026-10-09T08:50:00",
        lateDelayMinutes: 10,
      },
      scheduleLabel: "Friday, 9 October 2026 · 8:50 AM IST",
      whatsappTemplateName: TEMPLATES.reminderEventDay,
      emailSubject: null,
      emailTemplate: null,
      cutoffIst: null,
      lateWindowDelayMinutes: null,
      lastChanceDelayMinutes: null,
      skipOnOrAfterIstDate: null,
      waitForKind: null,
    },
  },
};

export const SEED_DRIVES = [REG_AUG_2026_SEED, MARATHAHALLI_OCT_2026_SEED];
