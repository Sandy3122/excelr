/**
 * Placement drive (campaign) configuration.
 *
 * The code knows *how* to run an automation - schedule it, respect quiet hours,
 * claim a channel, call Infobip, record the result. A placement drive document
 * decides *what* that means for one campaign: which automations are on, when
 * they fire, which template they use, and what the OTP limits are.
 *
 * Landing pages stay in code; each page declares only its drive slug. Nothing
 * else about a campaign should be hard-coded.
 */

import { z } from "zod";
import { AUTOMATION_KINDS, CHANNELS, type AutomationKind, type Channel } from "@/lib/automations/types";

/** `YYYY-MM-DD` in IST. */
const IST_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `YYYY-MM-DDTHH:mm(:ss)` IST wall clock. */
const IST_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
/** Lowercase, digit- and dash-separated. Matches the landing page's route path. */
export const DRIVE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const istDateSchema = z.string().trim().regex(IST_DATE, "Use YYYY-MM-DD");
export const istDateTimeSchema = z
  .string()
  .trim()
  .regex(IST_DATETIME, "Use YYYY-MM-DDTHH:mm");

// ─── WhatsApp / OTP ────────────────────────────────────────────────────────

export const whatsappLimitsSchema = z.object({
  /** How long a generated OTP stays valid. */
  otpExpirySeconds: z.number().int().min(30).max(3600),
  /** Minimum gap between two OTP sends to the same number. */
  resendCooldownSeconds: z.number().int().min(0).max(3600),
  /** Wrong-code attempts before the OTP is burned. */
  maxVerifyAttempts: z.number().int().min(1).max(20),
  /** OTP sends allowed per phone number per rolling hour. */
  maxSendsPerHour: z.number().int().min(1).max(100),
  /** OTP send requests allowed per client IP per rolling hour. */
  maxSendsPerIpPerHour: z.number().int().min(1).max(1000),
  /** How long a successful verification stays usable by /api/reg. */
  verifiedTtlSeconds: z.number().int().min(60).max(86400),
});

export type WhatsAppLimits = z.infer<typeof whatsappLimitsSchema>;

export const quietHoursSchema = z
  .object({
    enabled: z.boolean(),
    /** Inclusive IST hour at which sending stops. */
    startHourIst: z.number().int().min(0).max(23),
    /** Exclusive IST hour at which sending resumes. */
    endHourIst: z.number().int().min(0).max(23),
  })
  .refine((v) => !v.enabled || v.startHourIst !== v.endHourIst, {
    message: "Quiet hours start and end cannot be the same hour",
  });

export type QuietHours = z.infer<typeof quietHoursSchema>;

export const driveWhatsAppSchema = z.object({
  /**
   * Account-level fields. Blank means "inherit the Infobip account default"
   * from the environment, so swapping accounts does not require editing every
   * drive. Set a value here only to override for this campaign.
   */
  sender: z.string().trim().max(32),
  language: z.string().trim().max(10),
  otpTemplateName: z.string().trim().max(200),
  /**
   * URL-button parameter for the OTP template. "otp" sends the generated code
   * (what the approved template expects); anything else is sent literally.
   */
  otpUrlButtonParam: z.string().trim().max(200),
  limits: whatsappLimitsSchema,
  quietHours: quietHoursSchema,
});

export type DriveWhatsAppConfig = z.infer<typeof driveWhatsAppSchema>;

// ─── Automations ───────────────────────────────────────────────────────────

export const automationScheduleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("immediate") }),
  z.object({
    type: z.literal("delay_after_register"),
    delayMinutes: z.number().int().min(0).max(60 * 24 * 30),
  }),
  z.object({
    type: z.literal("at"),
    atIst: istDateTimeSchema,
    /** Applied instead when the lead registers after `atIst` has passed. */
    lateDelayMinutes: z.number().int().min(0).max(60 * 24),
  }),
]);

export type AutomationScheduleConfig = z.infer<typeof automationScheduleSchema>;

export const driveAutomationSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.enum(CHANNELS)).min(1),
  schedule: automationScheduleSchema,
  /** Human-readable summary shown in the dashboard. */
  scheduleLabel: z.string().trim().min(1).max(300),
  whatsappTemplateName: z.string().trim().min(1).max(200),
  emailSubject: z.string().trim().max(300).nullable(),
  /** Which bundled HTML email to render. Null = this automation sends no email. */
  emailTemplate: z.enum(["welcome", "reminder_day_before"]).nullable(),

  /** Hard stop - never send at or after this IST moment. */
  cutoffIst: istDateTimeSchema.nullable(),
  /** Shorter delay once inside the drive's late window (day before / event day). */
  lateWindowDelayMinutes: z.number().int().min(0).max(60 * 24).nullable(),
  /** Final, shortest delay for event-day signups racing the cutoff. */
  lastChanceDelayMinutes: z.number().int().min(0).max(60 * 24).nullable(),
  /** Skip entirely for leads who registered on or after this IST date. */
  skipOnOrAfterIstDate: istDateSchema.nullable(),
  /** Hold until this automation's WhatsApp has finished for the same lead. */
  waitForKind: z.enum(AUTOMATION_KINDS).nullable(),
});

export type DriveAutomationConfig = z.infer<typeof driveAutomationSchema>;

// ─── Drive ─────────────────────────────────────────────────────────────────

export const driveAutomationsSchema = z.object(
  Object.fromEntries(
    AUTOMATION_KINDS.map((kind) => [kind, driveAutomationSchema]),
  ) as Record<AutomationKind, typeof driveAutomationSchema>,
);

export type DriveAutomations = Record<AutomationKind, DriveAutomationConfig>;

/** Everything an admin can edit. Identity fields (id, timestamps) are separate. */
export const driveConfigSchema = z.object({
  name: z.string().trim().min(2).max(120),
  /** Route path of the landing page in code, without the leading slash. */
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(DRIVE_SLUG_RE, "Use lowercase letters, numbers and dashes"),
  enabled: z.boolean(),
  archived: z.boolean(),
  /** IST calendar day of the event. Drives cutoffs and the quiet-hours bypass. */
  eventDayIstDate: istDateSchema.nullable(),
  /** IST calendar day before the event. Drives the late-window delay. */
  dayBeforeIstDate: istDateSchema.nullable(),
  /** When registrations close. Null = open. */
  registrationClosesAtIso: z.string().trim().datetime().nullable(),
  /** `event` value sent to the n8n webhook and stored on each registration. */
  eventKey: z.string().trim().min(1).max(120),
  /**
   * Venue coordinates. Used to show how far each registrant's IP location is
   * from the venue. Null until an admin sets them; existing drives default to null.
   */
  venueLatitude: z.number().min(-90).max(90).nullable().default(null),
  venueLongitude: z.number().min(-180).max(180).nullable().default(null),
  /** Per-drive n8n webhook. Empty string disables it. */
  webhookUrl: z.string().trim().max(500),
  whatsapp: driveWhatsAppSchema,
  automations: driveAutomationsSchema,
});

export type PlacementDriveConfig = z.infer<typeof driveConfigSchema>;

export interface PlacementDrive extends PlacementDriveConfig {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Slim shape for the dashboard. Carries each automation's enabled flag and
 * channels so the UI never has to assume which kinds send email - that is the
 * drive's decision, and it differs between campaigns.
 */
export interface PlacementDriveSummary {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  archived: boolean;
  eventDayIstDate: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  automations: Record<AutomationKind, { enabled: boolean; channels: Channel[] }>;
}

export function toDriveSummary(drive: PlacementDrive): PlacementDriveSummary {
  return {
    id: drive.id,
    slug: drive.slug,
    name: drive.name,
    enabled: drive.enabled,
    archived: drive.archived,
    eventDayIstDate: drive.eventDayIstDate,
    venueLatitude: drive.venueLatitude,
    venueLongitude: drive.venueLongitude,
    automations: Object.fromEntries(
      AUTOMATION_KINDS.map((kind) => [
        kind,
        {
          enabled: drive.automations[kind].enabled,
          channels: drive.automations[kind].channels,
        },
      ]),
    ) as PlacementDriveSummary["automations"],
  };
}

// ─── Defaults ──────────────────────────────────────────────────────────────

/**
 * Baseline for a brand-new drive. Numbers match the values that were hard-coded
 * before drives became configurable, so a drive created with the defaults
 * behaves exactly like the original campaign did.
 */
export function defaultWhatsAppConfig(): DriveWhatsAppConfig {
  return {
    // Blank inherits the account default; see driveSendConfig().
    sender: "",
    language: "",
    otpTemplateName: "",
    otpUrlButtonParam: "",
    limits: {
      otpExpirySeconds: 300,
      resendCooldownSeconds: 60,
      maxVerifyAttempts: 5,
      maxSendsPerHour: 5,
      maxSendsPerIpPerHour: 20,
      verifiedTtlSeconds: 900,
    },
    quietHours: { enabled: true, startHourIst: 21, endHourIst: 8 },
  };
}

function baseAutomation(
  overrides: Partial<DriveAutomationConfig> & {
    channels: Channel[];
    schedule: AutomationScheduleConfig;
    scheduleLabel: string;
  },
): DriveAutomationConfig {
  return {
    enabled: true,
    whatsappTemplateName: "",
    emailSubject: null,
    emailTemplate: null,
    cutoffIst: null,
    lateWindowDelayMinutes: null,
    lastChanceDelayMinutes: null,
    skipOnOrAfterIstDate: null,
    waitForKind: null,
    ...overrides,
  };
}

/**
 * Default automation set for a new drive. `eventDayIstDate` seeds the schedules
 * so the admin only has to fill in templates.
 */
export function defaultAutomations(options?: {
  eventDayIstDate?: string | null;
  dayBeforeIstDate?: string | null;
}): DriveAutomations {
  const eventDay = options?.eventDayIstDate ?? null;
  const dayBefore = options?.dayBeforeIstDate ?? null;

  return {
    welcome: baseAutomation({
      channels: ["whatsapp", "email"],
      schedule: { type: "immediate" },
      scheduleLabel: "Immediately on registration",
      emailTemplate: "welcome",
    }),
    things_to_carry: baseAutomation({
      channels: ["whatsapp"],
      schedule: { type: "delay_after_register", delayMinutes: 60 },
      scheduleLabel: "1 hour after registration",
      cutoffIst: eventDay ? `${eventDay}T08:45:00` : null,
      lateWindowDelayMinutes: 10,
      lastChanceDelayMinutes: 5,
    }),
    reminder_day_before: baseAutomation({
      channels: ["whatsapp", "email"],
      schedule: dayBefore
        ? { type: "at", atIst: `${dayBefore}T12:00:00`, lateDelayMinutes: 15 }
        : { type: "delay_after_register", delayMinutes: 60 * 24 },
      scheduleLabel: "Day before the drive, 12:00 PM IST",
      emailTemplate: "reminder_day_before",
      skipOnOrAfterIstDate: eventDay,
      waitForKind: "things_to_carry",
    }),
    reminder_event_day: baseAutomation({
      channels: ["whatsapp"],
      schedule: eventDay
        ? { type: "at", atIst: `${eventDay}T08:50:00`, lateDelayMinutes: 10 }
        : { type: "delay_after_register", delayMinutes: 60 * 24 },
      scheduleLabel: "Event day, 8:50 AM IST",
    }),
  };
}

export function defaultDriveConfig(input: {
  name: string;
  slug: string;
  eventDayIstDate?: string | null;
  dayBeforeIstDate?: string | null;
  /**
   * Starting template per automation, normally the Infobip account defaults.
   * Seeding them means a new campaign arrives with real values in the admin
   * panel rather than empty boxes, while staying editable per drive.
   */
  automationTemplates?: Partial<Record<AutomationKind, string>>;
}): PlacementDriveConfig {
  const eventDayIstDate = input.eventDayIstDate ?? null;
  const dayBeforeIstDate =
    input.dayBeforeIstDate ?? (eventDayIstDate ? previousIstDate(eventDayIstDate) : null);

  return {
    name: input.name,
    slug: input.slug,
    enabled: true,
    archived: false,
    eventDayIstDate,
    dayBeforeIstDate,
    registrationClosesAtIso: null,
    eventKey: input.slug,
    venueLatitude: null,
    venueLongitude: null,
    webhookUrl: "",
    whatsapp: defaultWhatsAppConfig(),
    automations: withTemplates(
      defaultAutomations({ eventDayIstDate, dayBeforeIstDate }),
      input.automationTemplates,
    ),
  };
}

function withTemplates(
  automations: DriveAutomations,
  templates?: Partial<Record<AutomationKind, string>>,
): DriveAutomations {
  if (!templates) return automations;
  return Object.fromEntries(
    AUTOMATION_KINDS.map((kind) => [
      kind,
      {
        ...automations[kind],
        whatsappTemplateName:
          (templates[kind] || "").trim() || automations[kind].whatsappTemplateName,
      },
    ]),
  ) as DriveAutomations;
}

/** Calendar day before an IST `YYYY-MM-DD`, without pulling in a date library. */
export function previousIstDate(key: string): string | null {
  if (!IST_DATE.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(
    prev.getUTCDate(),
  )}`;
}
