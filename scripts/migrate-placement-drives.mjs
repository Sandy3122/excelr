#!/usr/bin/env node
/**
 * Migrate the single-campaign Firestore layout into per-drive subcollections.
 *
 *   registrations/{phone}            →  placementDrives/{driveId}/registrations/{phone}
 *   registrationEmails/{email}       →  placementDrives/{driveId}/registrationEmails/{email}
 *   automationRuns/{id}              →  placementDrives/{driveId}/automationRuns/{id}
 *   meta/cronState.cursors           →  placementDrives/{driveId}/meta/cronState
 *
 * Registrations are assigned by `pageUrl`: anything whose path starts with
 * /fsd-oct-2026 goes to the October drive, everything else
 * (including rows with no pageUrl) goes to the August drive.
 *
 * Properties:
 *   - Non-destructive. Source collections are only read; nothing is deleted.
 *   - Idempotent. Re-running copies the same documents to the same ids and
 *     skips any target that already exists, so an interrupted run resumes.
 *   - Dry by default. Pass --apply to write.
 *
 * Usage:
 *   node scripts/migrate-placement-drives.mjs                # dry run, prints a plan
 *   node scripts/migrate-placement-drives.mjs --apply        # perform the migration
 *   node scripts/migrate-placement-drives.mjs --apply --force-overwrite
 *
 * Credentials come from the same place the app uses: FIREBASE_* env vars, or
 * ./serviceAccountKey.json.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force-overwrite");

function numFlag(name, fallback) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = raw ? Number(raw.split("=")[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Documents read per page. Reads are cheap; this mostly controls memory. */
const PAGE = numFlag("page", 300);
/**
 * Documents per commit. Firestore allows 500, but a large batch of registration
 * documents is a big payload and a slow link will hit the 60s gRPC deadline
 * before it finishes. Small commits are barely slower and far more reliable.
 * Override with --write-chunk=25 on a flaky connection.
 */
const WRITE_CHUNK = numFlag("write-chunk", 50);
/** Firestore getAll() takes many refs in one round-trip; keep chunks modest. */
const GETALL_CHUNK = numFlag("getall-chunk", 100);
/** Attempts per Firestore call before giving up. */
const MAX_ATTEMPTS = numFlag("attempts", 5);

// ── Seed configurations ─────────────────────────────────────────────────────
// Kept in step with lib/drives/seed-configs.ts. That module is TypeScript and
// this script runs under plain node, so the two are intentionally separate;
// `npm test` asserts the scheduling behaviour of the TS copy.

const DEFAULT_LIMITS = {
  otpExpirySeconds: 300,
  resendCooldownSeconds: 60,
  maxVerifyAttempts: 5,
  maxSendsPerHour: 5,
  maxSendsPerIpPerHour: 20,
  verifiedTtlSeconds: 900,
};

const QUIET_HOURS = { enabled: true, startHourIst: 21, endHourIst: 8 };

const T = {
  otp: "fsd_website_otp_11082026",
  confirmation: "fsd_placement_drive_confirmation_message_a",
  thingsToCarry: "fsd_placement_drive_things_2_carry_a",
  reminderDayBefore: "fsd_placement_drive_reminder_message_21aug_a",
  reminderEventDay: "fsd_placement_drive_reminder_message_22aug_a",
};

const blank = {
  emailSubject: null,
  emailTemplate: null,
  cutoffIst: null,
  lateWindowDelayMinutes: null,
  lastChanceDelayMinutes: null,
  skipOnOrAfterIstDate: null,
  waitForKind: null,
};

const AUG = {
  name: "Java Full Stack Placement Drive — BTM, Aug 2026",
  slug: "reg",
  enabled: true,
  archived: false,
  eventDayIstDate: "2026-08-22",
  dayBeforeIstDate: "2026-08-21",
  registrationClosesAtIso: null,
  eventKey: "java-fullstack-placement-drive",
  webhookUrl: "https://excelr.app.n8n.cloud/webhook/java-fsd-registration",
  whatsapp: {
    sender: "",
    language: "en_IN",
    otpTemplateName: T.otp,
    otpUrlButtonParam: "otp",
    limits: DEFAULT_LIMITS,
    quietHours: QUIET_HOURS,
  },
  automations: {
    welcome: {
      ...blank,
      enabled: true,
      channels: ["whatsapp", "email"],
      schedule: { type: "immediate" },
      scheduleLabel: "Immediately on registration",
      whatsappTemplateName: T.confirmation,
      emailSubject:
        "You're confirmed: Java Full Stack Placement Drive — 22 Aug, BTM",
      emailTemplate: "welcome",
    },
    things_to_carry: {
      ...blank,
      enabled: true,
      channels: ["whatsapp"],
      schedule: { type: "delay_after_register", delayMinutes: 60 },
      scheduleLabel: "1 hour after registration; 10 min if late on 21/22 Aug",
      whatsappTemplateName: T.thingsToCarry,
      cutoffIst: "2026-08-22T08:45:00",
      lateWindowDelayMinutes: 10,
      lastChanceDelayMinutes: 5,
    },
    reminder_day_before: {
      ...blank,
      enabled: true,
      channels: ["whatsapp", "email"],
      schedule: { type: "at", atIst: "2026-08-21T12:00:00", lateDelayMinutes: 15 },
      scheduleLabel:
        "Friday, 21 August 2026 · 12:00 PM IST (15 min later if they register after noon)",
      whatsappTemplateName: T.reminderDayBefore,
      emailSubject: "Tomorrow, 9:00 AM — your Java Full Stack Placement Drive",
      emailTemplate: "reminder_day_before",
      skipOnOrAfterIstDate: "2026-08-22",
      waitForKind: "things_to_carry",
    },
    reminder_event_day: {
      ...blank,
      enabled: true,
      channels: ["whatsapp"],
      schedule: { type: "at", atIst: "2026-08-22T08:50:00", lateDelayMinutes: 10 },
      scheduleLabel:
        "Saturday, 22 August 2026 · 8:50 AM IST (10 min later if they register after 8:50)",
      whatsappTemplateName: T.reminderEventDay,
    },
  },
};

const OCT = {
  name: "Full Stack Placement Drive — BTM, Oct 2026",
  slug: "fsd-oct-2026",
  enabled: true,
  archived: false,
  eventDayIstDate: "2026-10-09",
  dayBeforeIstDate: "2026-10-08",
  registrationClosesAtIso: null,
  eventKey: "fsd-oct-2026",
  webhookUrl: "https://excelr.app.n8n.cloud/webhook/java-fsd-registration",
  whatsapp: {
    sender: "",
    language: "en_IN",
    otpTemplateName: T.otp,
    otpUrlButtonParam: "otp",
    limits: DEFAULT_LIMITS,
    quietHours: QUIET_HOURS,
  },
  automations: {
    welcome: {
      ...blank,
      enabled: true,
      channels: ["whatsapp", "email"],
      schedule: { type: "immediate" },
      scheduleLabel: "Immediately on registration",
      whatsappTemplateName: T.confirmation,
      emailSubject: "Registration Confirmed: ExcelR Placement Drive",
      emailTemplate: "welcome",
    },
    // Reminders start off: the approved Infobip content still says August.
    things_to_carry: {
      ...blank,
      enabled: false,
      channels: ["whatsapp"],
      schedule: { type: "delay_after_register", delayMinutes: 60 },
      scheduleLabel: "1 hour after registration; 10 min if late on 8/9 Oct",
      whatsappTemplateName: T.thingsToCarry,
      cutoffIst: "2026-10-09T08:45:00",
      lateWindowDelayMinutes: 10,
      lastChanceDelayMinutes: 5,
    },
    reminder_day_before: {
      ...blank,
      enabled: false,
      channels: ["whatsapp", "email"],
      schedule: { type: "at", atIst: "2026-10-08T12:00:00", lateDelayMinutes: 15 },
      scheduleLabel: "Thursday, 8 October 2026 · 12:00 PM IST",
      whatsappTemplateName: T.reminderDayBefore,
      emailSubject: "Tomorrow — your Full Stack Placement Drive",
      emailTemplate: "reminder_day_before",
      skipOnOrAfterIstDate: "2026-10-09",
      waitForKind: "things_to_carry",
    },
    reminder_event_day: {
      ...blank,
      enabled: false,
      channels: ["whatsapp"],
      schedule: { type: "at", atIst: "2026-10-09T08:50:00", lateDelayMinutes: 10 },
      scheduleLabel: "Friday, 9 October 2026 · 8:50 AM IST",
      whatsappTemplateName: T.reminderEventDay,
    },
  },
};

// ── Firestore ───────────────────────────────────────────────────────────────

function credentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey?.trim()) {
    return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
  }
  const path = join(process.cwd(), "serviceAccountKey.json");
  if (!existsSync(path)) {
    throw new Error(
      "No Firebase credentials. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, or add serviceAccountKey.json.",
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return {
    projectId: raw.project_id,
    clientEmail: raw.client_email,
    privateKey: String(raw.private_key).replace(/\\n/g, "\n"),
  };
}

initializeApp({ credential: cert(credentials()) });
const db = getFirestore();

const log = (...args) => console.log(...args);
const step = (title) => log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** gRPC codes worth retrying: deadline, unavailable, exhausted, internal, aborted. */
const TRANSIENT = new Set([4, 8, 10, 13, 14]);

/**
 * Retry a Firestore call through transient network failures.
 *
 * Every operation here is idempotent — queries and getAll() are reads, and the
 * writes are `set(..., { merge: true })` to a fixed document id — so repeating
 * one can never duplicate or corrupt data.
 */
async function withRetry(label, fn) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!TRANSIENT.has(err?.code) || attempt === MAX_ATTEMPTS) throw err;
      const wait = Math.min(15000, 500 * 2 ** (attempt - 1));
      log(
        `    ${label} failed (${err.code} ${err.details?.split(",")[0] || ""}) — ` +
          `retry ${attempt}/${MAX_ATTEMPTS - 1} in ${(wait / 1000).toFixed(1)}s`,
      );
      await sleep(wait);
    }
  }
  throw lastError;
}

/** Which drive a registration belongs to, from its page URL. */
function driveSlugForPageUrl(pageUrl) {
  let path = String(pageUrl || "");
  try {
    path = new URL(path).pathname;
  } catch {
    /* not an absolute URL — treat the raw value as a path */
  }
  return path.startsWith("/fsd-oct-2026") ? OCT.slug : AUG.slug;
}

/** Create or update a drive document plus its slug index entry. */
async function ensureDrive(config) {
  const slugRef = db.collection("placementDriveSlugs").doc(config.slug);
  const existingSlug = await slugRef.get();

  if (existingSlug.exists) {
    const driveId = String(existingSlug.data()?.driveId || "");
    log(`  drive "${config.slug}" already exists → ${driveId}`);
    return driveId;
  }

  const ref = db.collection("placementDrives").doc();
  log(`  ${APPLY ? "creating" : "would create"} drive "${config.slug}" → ${ref.id}`);
  if (APPLY) {
    const now = new Date().toISOString();
    await db.runTransaction(async (tx) => {
      tx.set(ref, { ...config, createdAt: now, updatedAt: now });
      tx.set(slugRef, { driveId: ref.id, slug: config.slug });
    });
  }
  return ref.id;
}

/** 1,234 rather than 1234, so big collections stay readable in the log. */
const n = (value) => value.toLocaleString("en-US");

function bar(done, total, width = 24) {
  if (!total) return "".padEnd(width, "·");
  const filled = Math.min(width, Math.round((done / total) * width));
  return "█".repeat(filled).padEnd(width, "·");
}

/**
 * Copy documents from a top-level collection into per-drive subcollections.
 * `route` maps a source document to a target drive id (null = skip).
 *
 * Copy only — the source collection is never written to or deleted from.
 * Progress is reported after every committed batch so a long run is visible.
 */
async function copyCollection(sourceName, targetName, route, decorate) {
  step(`${sourceName} → placementDrives/*/${targetName}`);
  const source = db.collection(sourceName);

  let total = 0;
  try {
    total = (await withRetry("count", () => source.count().get())).data().count;
  } catch {
    /* count() unavailable — progress falls back to a running tally */
  }
  log(`  ${n(total)} document${total === 1 ? "" : "s"} to process`);
  if (total === 0) {
    return { scanned: 0, copied: 0, skipped: 0, existing: 0, byDrive: {} };
  }

  const startedAt = Date.now();
  let cursor = null;
  const stats = { scanned: 0, copied: 0, skipped: 0, existing: 0, byDrive: {} };

  for (let batch = 1; ; batch++) {
    const batchStarted = Date.now();

    let query = source.orderBy("__name__").limit(PAGE);
    if (cursor) query = query.startAfter(cursor);
    const snap = await withRetry(`read page ${batch}`, () => query.get());
    if (snap.empty) break;

    // Resolve each document's destination first, then answer "does the target
    // already exist?" for the whole batch in a couple of getAll() calls.
    // Checking row by row costs a round-trip each and turns a few thousand
    // registrations into several silent minutes.
    const planned = [];
    for (const doc of snap.docs) {
      stats.scanned += 1;
      const data = doc.data();
      const driveId = route(doc, data);
      if (!driveId) {
        stats.skipped += 1;
        continue;
      }
      planned.push({
        data,
        driveId,
        target: db
          .collection("placementDrives")
          .doc(driveId)
          .collection(targetName)
          .doc(doc.id),
      });
    }

    const existing = new Set();
    if (!FORCE && planned.length > 0) {
      for (let i = 0; i < planned.length; i += GETALL_CHUNK) {
        const chunk = planned.slice(i, i + GETALL_CHUNK);
        const snaps = await withRetry("existence check", () =>
          db.getAll(...chunk.map((item) => item.target)),
        );
        snaps.forEach((found, j) => {
          if (found.exists) existing.add(chunk[j].target.path);
        });
      }
    }

    const pending = [];
    for (const item of planned) {
      if (existing.has(item.target.path)) {
        stats.existing += 1;
        continue;
      }
      pending.push(item);
    }

    // Commit in small chunks. One big batch of registration documents is a
    // heavy payload, and a slow link hits the 60s gRPC deadline before it
    // lands — which fails the whole page rather than a slice of it.
    for (let i = 0; i < pending.length; i += WRITE_CHUNK) {
      const chunk = pending.slice(i, i + WRITE_CHUNK);
      if (APPLY) {
        await withRetry(`commit ${chunk.length} docs`, async () => {
          const writer = db.batch();
          for (const item of chunk) {
            const payload = decorate
              ? decorate(item.data, item.driveId)
              : item.data;
            writer.set(item.target, payload, { merge: true });
          }
          await writer.commit();
        });
      }
      for (const item of chunk) {
        stats.copied += 1;
        stats.byDrive[item.driveId] = (stats.byDrive[item.driveId] || 0) + 1;
      }
    }

    const pct = total ? Math.min(100, Math.round((stats.scanned / total) * 100)) : 0;
    const perSec = stats.scanned / Math.max(0.001, (Date.now() - startedAt) / 1000);
    const remaining = total > stats.scanned ? (total - stats.scanned) / perSec : 0;
    log(
      `  [${bar(stats.scanned, total)}] ${String(pct).padStart(3)}%  ` +
        `batch ${String(batch).padStart(3)} · ` +
        `${n(stats.scanned)}/${n(total)} · ` +
        `${APPLY ? "copied" : "would copy"} ${n(stats.copied)}` +
        (stats.existing ? ` · already there ${n(stats.existing)}` : "") +
        ` · ${((Date.now() - batchStarted) / 1000).toFixed(1)}s` +
        (remaining > 1 ? ` · ~${Math.ceil(remaining)}s left` : ""),
    );

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(
    `  done in ${elapsed}s — scanned ${n(stats.scanned)}, ` +
      `${APPLY ? "copied" : "would copy"} ${n(stats.copied)}, ` +
      `already present ${n(stats.existing)}, skipped ${n(stats.skipped)}`,
  );
  for (const [driveId, count] of Object.entries(stats.byDrive)) {
    log(`    → ${driveId}: ${n(count)}`);
  }
  return stats;
}

async function main() {
  log(
    APPLY
      ? "COPY MODE (--apply). Documents are copied into the new layout.\n" +
        "Nothing is deleted — the original collections stay exactly as they are.\n" +
        "Safe to interrupt: batches commit as they go and a re-run resumes."
      : "DRY RUN — no writes. Re-run with --apply to perform the copy.",
  );

  step("Placement drives");
  const augId = await ensureDrive(AUG);
  const octId = await ensureDrive(OCT);
  const idBySlug = { [AUG.slug]: augId, [OCT.slug]: octId };

  // Registrations, routed by the page they came from.
  const regStats = await copyCollection(
    "registrations",
    "registrations",
    (_doc, data) => idBySlug[driveSlugForPageUrl(data.pageUrl)],
    (data, driveId) => ({
      ...data,
      placementDriveId: driveId,
      placementDriveSlug: driveId === octId ? OCT.slug : AUG.slug,
      event: driveId === octId ? OCT.eventKey : AUG.eventKey,
    }),
  );

  // Email uniqueness index: follow whichever drive owns the registration it
  // points at, so the lookup stays consistent with the copied lead.
  const ownerByRegistrationId = new Map();
  {
    log("  resolving registration owners…");
    const snap = await withRetry("owner map", () =>
      db.collection("registrations").select("pageUrl").get(),
    );
    for (const doc of snap.docs) {
      ownerByRegistrationId.set(
        doc.id,
        idBySlug[driveSlugForPageUrl(doc.data()?.pageUrl)],
      );
    }
  }
  await copyCollection("registrationEmails", "registrationEmails", (_doc, data) => {
    const registrationId = String(data.registrationId || "");
    return ownerByRegistrationId.get(registrationId) || augId;
  });

  // Run history predates per-drive runs; it all belongs to the August drive.
  await copyCollection(
    "automationRuns",
    "automationRuns",
    () => augId,
    (data) => ({ ...data, placementDriveId: augId }),
  );

  step("Cron cursors");
  const cronSnap = await db.collection("meta").doc("cronState").get();
  const cursors = cronSnap.exists ? cronSnap.data()?.cursors || {} : {};
  if (Object.keys(cursors).length === 0) {
    log("  no cursors to move");
  } else {
    log(`  ${APPLY ? "writing" : "would write"} cursors to the August drive:`, cursors);
    if (APPLY) {
      await db
        .collection("placementDrives")
        .doc(augId)
        .collection("meta")
        .doc("cronState")
        .set({ cursors }, { merge: true });
    }
  }

  step("Summary");
  log(`  August drive : ${augId}  (/${AUG.slug})`);
  log(`  October drive: ${octId}  (/${OCT.slug})`);
  log(
    `  registrations ${APPLY ? "copied" : "to copy"}: ${n(regStats.copied)}` +
      (regStats.existing ? ` (${n(regStats.existing)} already present)` : ""),
  );

  if (!APPLY) {
    log("\nNothing was written. Re-run with --apply when the plan looks right.");
    return;
  }

  log(
    "\nCopy complete. The original collections are untouched and still hold\n" +
      "every document.\n\n" +
      "Next:\n" +
      "  1. Deploy, then re-run this script to sweep up anything registered\n" +
      "     during the cutover.\n" +
      "  2. Check the dashboard against the counts above.\n" +
      "  3. Only when you are satisfied, verify and remove the old copies:\n" +
      "       node scripts/remove-legacy-collections.mjs           # verify only\n" +
      "       node scripts/remove-legacy-collections.mjs --apply   # delete",
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`\nMigration stopped: ${err?.message || err}`);
    console.error(
      "\nNothing was lost — every committed batch is already copied and the\n" +
        "source collections are untouched. Re-run to resume from where it got to:\n" +
        "  node scripts/migrate-placement-drives.mjs --apply\n\n" +
        "On a slow or flaky connection, use smaller commits:\n" +
        "  node scripts/migrate-placement-drives.mjs --apply --write-chunk=25 --page=150",
    );
    process.exit(1);
  },
);
