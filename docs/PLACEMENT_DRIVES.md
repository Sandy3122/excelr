Written for: developers and the admin who configures campaigns.

# Placement drives

A **placement drive** is one campaign. The code knows *how* to run a drive —
save a registration, send an OTP, schedule an automation, call Infobip. A drive
document in Firestore decides *what* that means for a given campaign: which
automations are on, when they fire, which template they use, and what the limits
are.

Landing pages stay in code, because every drive has different hero art, copy and
layout. A page declares only which drive it belongs to.

## Adding a new drive

1. **Build the landing page** as usual under `app/<slug>/page.tsx` with a config
   in `lib/events/`. Set `driveSlug` to the route path without the leading
   slash:

   ```ts
   export const BANGALORE_JAVA_NOV_2026: RegEventConfig = {
     driveSlug: "bangalore-java-nov-2026",
     href: "/bangalore-java-nov-2026",
     …
   };
   ```

2. **Create the drive** in Admin → Placement Drives → New drive. The path must
   match `driveSlug` exactly. Give it the event day so the reminder schedules
   and the things-to-carry cutoff are seeded.

3. **Configure it** on the drive page: WhatsApp templates, OTP limits, quiet
   hours, and each automation's schedule, channels and template.

That is the whole process. No constants, switch statements or template ids in
code.

## What a drive owns

```
placementDrives/{driveId}
  ├── registrations/{phoneDigits}
  ├── registrationEmails/{emailDocId}
  ├── automationRuns/{runId}
  └── meta/{cronState|automationOverview}
placementDriveSlugs/{slug} → { driveId }
```

Everything a drive owns lives underneath it, so a query can only reach another
campaign's data by explicitly naming a different drive id. Phone and email
uniqueness are per drive — the same person can register for two drives.

`placementDriveSlugs` is a uniqueness index: claiming a slug is a transactional
document write, so two admins cannot save the same path.

## Renaming a slug

A drive is matched by slug, so renaming a page in code would point it at a
drive that does not exist — and a page with no drive fails safe to
"registrations closed". Renaming would therefore take the live page down.

To avoid that, list the old slug in `DRIVE_SLUG_ALIASES` in `lib/site.ts`:

```ts
export const DRIVE_SLUG_ALIASES = {
  "fsd-oct-2026": ["marathahalli-fsd-oct-2026"],
};
```

The page keeps resolving to the same drive, and the server logs a warning
naming the rename to make in the dashboard. Once the drive is renamed there,
the alias is never consulted and can be deleted.

## When a drive closes

Registrations stop when **either** is true:

- an admin scheduled a close time (`registrationClosesAtIso`), or
- the drive's **event day has passed** — the end of `eventDayIstDate` in IST.

The second rule means a finished campaign stops collecting leads even if nobody
remembered to close it. Same-day signups still work, since the cutoff is the
end of the event day. A drive that needs to stay open longer (a two-day event
taking signups on day two, say) sets an explicit close time, which always wins.

`closedReason` on the window status says which rule fired.

## Scoping rules

- **Public requests** name a drive by slug. `resolvePublicDrive()` rejects an
  unknown slug rather than defaulting, and refuses disabled or archived drives.
- **Admin requests** name a drive by id. `requireAdminDrive()` validates it
  against Firestore on every request; an authenticated admin may select any
  drive, but the id is never trusted as-is.
- **OTP store keys** are namespaced `d:{driveId}:…`, so a verification obtained
  on one campaign cannot satisfy another, and rate-limit budgets are separate.
- **Cron** walks every enabled drive and runs each of that drive's due
  automations, keeping a separate scan cursor per drive per automation.

## Automations

The four kinds (`welcome`, `things_to_carry`, `reminder_day_before`,
`reminder_event_day`) are fixed in code — this is configuration-driven
automation, not a workflow builder. Per drive, each one carries:

| Field | Meaning |
| --- | --- |
| `enabled` | Off means nothing sends, however it is triggered |
| `channels` | WhatsApp, email, or both |
| `schedule` | `immediate`, `delay_after_register`, or `at` a fixed IST time |
| `whatsappTemplateName` | Approved Infobip template |
| `emailSubject` / `emailTemplate` | Only when the email channel is on |
| `cutoffIst` | Hard stop — never send at or after this moment |
| `lateWindowDelayMinutes` | Shorter delay on the day before / day of the event |
| `lastChanceDelayMinutes` | Shortest delay for event-day signups racing the cutoff |
| `skipOnOrAfterIstDate` | Skip leads who registered on or after this date |
| `waitForKind` | Hold until another automation has finished for that lead |

Quiet hours are drive-level: messages due inside the window wait for it to
reopen, except on the event day itself.

## No silent fallbacks

A drive with no template configured is a **configuration error**, not a reason
to reach for another campaign's template. `driveAutomationTemplate()` throws, the
run records the failure, and the admin sees the drive flagged in the selector and
on the drives list. Only account-level values (Infobip API key, base URL, the
default sender) still come from the environment.

## Account settings vs campaign settings

Two layers, on purpose:

**Account-level — environment.** Belongs to the Infobip account, not to any one
campaign, so swapping accounts is an env change and nothing else:

```
INFOBIP_API_KEY                    credentials
INFOBIP_BASE_URL
INFOBIP_WHATSAPP_SENDER            sender (WABA number)
INFOBIP_TEMPLATE_LANGUAGE          template language, default en_IN
INFOBIP_TEMPLATE_NAME              OTP template
INFOBIP_TEMPLATE_URL_BUTTON_PARAM  OTP URL button, default "otp"
```

A drive that leaves the matching field blank **inherits** these. The drive page
shows what each blank field is inheriting and a "What this drive will actually
send with" read-out, plus a **Clear overrides** button to drop back to the
account values.

**Campaign-level — admin panel.** Owned by the drive: which automations run,
when each fires, the template and email subject each uses, expiry, cooldowns,
attempt caps, rate limits and quiet hours.

Per-automation templates are **seeded** from the account defaults
(`INFOBIP_CONFIRMATION_TEMPLATE_NAME`, `INFOBIP_THINGS_TO_CARRY_TEMPLATE_NAME`,
`INFOBIP_REMINDER_DAY_BEFORE_TEMPLATE_NAME`,
`INFOBIP_REMINDER_EVENT_DAY_TEMPLATE_NAME`) when a drive is created, so a new
campaign starts with real values. After that the drive is authoritative and
there is no fallback at send time — quietly sending another campaign's template
is worse than failing loudly.

## Environment variables no longer read

These moved into the drive document and can be removed once the migration is
verified:

The OTP and sender variables above are still read as account defaults. These
are the ones that moved entirely onto the drive:

```
WHATSAPP_OTP_EXPIRY_SECONDS           → drive.whatsapp.limits.otpExpirySeconds
WHATSAPP_OTP_RESEND_COOLDOWN_SECONDS  → drive.whatsapp.limits.resendCooldownSeconds
WHATSAPP_OTP_MAX_ATTEMPTS             → drive.whatsapp.limits.maxVerifyAttempts
WHATSAPP_OTP_MAX_SENDS_PER_HOUR       → drive.whatsapp.limits.maxSendsPerHour
WHATSAPP_OTP_MAX_SENDS_PER_IP_PER_HOUR→ drive.whatsapp.limits.maxSendsPerIpPerHour
WHATSAPP_OTP_VERIFIED_TTL_SECONDS     → drive.whatsapp.limits.verifiedTtlSeconds
REGISTRATION_N8N_WEBHOOK_URL          → drive.webhookUrl
```

Still used: `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_WHATSAPP_SENDER`
(fallback when a drive leaves its sender blank), `WHATSAPP_OTP_HASH_SECRET`,
`WHATSAPP_OTP_DEFAULT_COUNTRY`, the SMTP and Firebase keys, `CRON_SECRET`,
`REG_ADMIN_API_KEY`.

## Migration

`scripts/migrate-placement-drives.mjs` moves the old single-campaign layout into
per-drive subcollections. It is a dry run by default:

```bash
node scripts/migrate-placement-drives.mjs            # print the plan
node scripts/migrate-placement-drives.mjs --apply    # perform it
```

It is non-destructive (source collections are only read) and idempotent
(existing targets are skipped), so an interrupted run can simply be repeated —
batches commit as they go, and progress is printed per batch. Registrations are
routed by `pageUrl`: anything under `/marathahalli-fsd-oct-2026` goes to the
October drive, everything else to the August drive.

### Removing the old collections

Copying never deletes. When you are satisfied the new dashboard is correct, a
separate script verifies and then removes the legacy copies:

```bash
node scripts/remove-legacy-collections.mjs           # verify only
node scripts/remove-legacy-collections.mjs --apply   # verify, then delete
```

It checks every source document against its counterpart under
`placementDrives/*` and **aborts without deleting anything** if a single row is
missing. `meta/` is left alone — `meta/cronState` still holds the live cron
lock.
