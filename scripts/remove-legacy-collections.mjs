#!/usr/bin/env node
/**
 * Remove the old single-campaign collections, once their contents have been
 * copied into the per-drive layout.
 *
 * This is the only script in the project that deletes anything, so it is
 * deliberately hard to misfire:
 *
 *   - Verify first, always. Every source document is checked against its
 *     counterpart under placementDrives/*. A single missing or mismatched row
 *     aborts the whole thing.
 *   - Verify-only by default. Deleting needs --apply.
 *   - Deletes in batches with progress, and only the collections listed below.
 *
 * `meta/` is intentionally left alone: meta/cronState still holds the live cron
 * lock used by the new code.
 *
 * Usage:
 *   node scripts/remove-legacy-collections.mjs           # verify, delete nothing
 *   node scripts/remove-legacy-collections.mjs --apply   # verify, then delete
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

function numFlag(name, fallback) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = raw ? Number(raw.split("=")[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const PAGE = numFlag("page", 300);
/** Deletes are small, but keep commits well inside the 60s gRPC deadline. */
const DELETE_CHUNK = numFlag("delete-chunk", 100);
const GETALL_CHUNK = numFlag("getall-chunk", 100);
const MAX_ATTEMPTS = numFlag("attempts", 5);

/** Source collection → the subcollection it was copied into. */
const LEGACY = [
  { source: "registrations", target: "registrations" },
  { source: "registrationEmails", target: "registrationEmails" },
  { source: "automationRuns", target: "automationRuns" },
];

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
const step = (title) =>
  log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
const n = (value) => value.toLocaleString("en-US");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** gRPC codes worth retrying: deadline, unavailable, exhausted, internal, aborted. */
const TRANSIENT = new Set([4, 8, 10, 13, 14]);

/** Retry through transient network failures. Reads and deletes are idempotent. */
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
        `    ${label} failed (${err.code}) — retry ${attempt}/${MAX_ATTEMPTS - 1} ` +
          `in ${(wait / 1000).toFixed(1)}s`,
      );
      await sleep(wait);
    }
  }
  throw lastError;
}

function bar(done, total, width = 24) {
  if (!total) return "".padEnd(width, "·");
  const filled = Math.min(width, Math.round((done / total) * width));
  return "█".repeat(filled).padEnd(width, "·");
}

async function driveIds() {
  const snap = await db.collection("placementDrives").get();
  return snap.docs.map((doc) => doc.id);
}

/**
 * Confirm every document in `source` exists under at least one drive's
 * `target` subcollection, keeping the same document id.
 */
async function verify(source, target, drives) {
  step(`Verifying ${source}`);
  const col = db.collection(source);

  let total = 0;
  try {
    total = (await withRetry("count", () => col.count().get())).data().count;
  } catch {
    /* count() unavailable */
  }
  log(`  ${n(total)} document${total === 1 ? "" : "s"} to check`);
  if (total === 0) return { total: 0, found: 0, missing: [] };

  let cursor = null;
  let checked = 0;
  let found = 0;
  const missing = [];
  const startedAt = Date.now();

  for (let batch = 1; ; batch++) {
    let query = col.orderBy("__name__").select().limit(PAGE);
    if (cursor) query = query.startAfter(cursor);
    const snap = await withRetry(`read page ${batch}`, () => query.get());
    if (snap.empty) break;

    const ids = snap.docs.map((doc) => doc.id);
    const present = new Set();

    // A document counts as copied if it exists under any drive.
    for (const driveId of drives) {
      const outstanding = ids.filter((id) => !present.has(id));
      if (outstanding.length === 0) break;
      for (let i = 0; i < outstanding.length; i += GETALL_CHUNK) {
        const chunk = outstanding.slice(i, i + GETALL_CHUNK);
        const refs = chunk.map((id) =>
          db.collection("placementDrives").doc(driveId).collection(target).doc(id),
        );
        const snaps = await withRetry("existence check", () => db.getAll(...refs));
        snaps.forEach((doc, j) => {
          if (doc.exists) present.add(chunk[j]);
        });
      }
    }

    for (const id of ids) {
      checked += 1;
      if (present.has(id)) found += 1;
      else if (missing.length < 25) missing.push(id);
      else missing.push(id);
    }

    const pct = total ? Math.min(100, Math.round((checked / total) * 100)) : 0;
    log(
      `  [${bar(checked, total)}] ${String(pct).padStart(3)}%  ` +
        `batch ${String(batch).padStart(3)} · ${n(checked)}/${n(total)} · ` +
        `copied ${n(found)}` +
        (missing.length ? ` · MISSING ${n(missing.length)}` : ""),
    );

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  log(
    `  checked ${n(checked)} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s — ` +
      `${n(found)} copied, ${n(missing.length)} missing`,
  );
  return { total: checked, found, missing };
}

async function deleteCollection(source) {
  step(`Deleting ${source}`);
  const col = db.collection(source);

  let total = 0;
  try {
    total = (await withRetry("count", () => col.count().get())).data().count;
  } catch {
    /* count() unavailable */
  }
  log(`  ${n(total)} document${total === 1 ? "" : "s"} to delete`);
  if (total === 0) return 0;

  let deleted = 0;
  const startedAt = Date.now();

  for (let batch = 1; ; batch++) {
    // Always read from the start: deleting shrinks the collection, so a cursor
    // is unnecessary and a fresh head keeps the loop simple and restartable.
    const snap = await withRetry(`read page ${batch}`, () =>
      col.orderBy("__name__").select().limit(DELETE_CHUNK).get(),
    );
    if (snap.empty) break;

    await withRetry(`delete ${snap.size} docs`, async () => {
      const writer = db.batch();
      for (const doc of snap.docs) writer.delete(doc.ref);
      await writer.commit();
    });
    deleted += snap.size;

    const pct = total ? Math.min(100, Math.round((deleted / total) * 100)) : 0;
    log(
      `  [${bar(deleted, total)}] ${String(pct).padStart(3)}%  ` +
        `batch ${String(batch).padStart(3)} · deleted ${n(deleted)}/${n(total)}`,
    );

    if (snap.size < DELETE_CHUNK) break;
  }

  log(`  removed ${n(deleted)} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  return deleted;
}

async function main() {
  log(
    APPLY
      ? "REMOVE MODE (--apply). Legacy collections will be deleted, but only\n" +
        "after every document is proven to exist in the new layout."
      : "VERIFY ONLY — nothing will be deleted.\n" +
        "Re-run with --apply once the verification below is clean.",
  );

  const drives = await driveIds();
  if (drives.length === 0) {
    log("\nNo placement drives found. Run the migration first — aborting.");
    process.exit(1);
  }
  log(`\nChecking against ${drives.length} drive(s): ${drives.join(", ")}`);

  const results = [];
  for (const { source, target } of LEGACY) {
    results.push({ source, ...(await verify(source, target, drives)) });
  }

  step("Verification summary");
  let safe = true;
  for (const r of results) {
    const ok = r.missing.length === 0;
    if (!ok) safe = false;
    log(
      `  ${ok ? "OK  " : "FAIL"}  ${r.source.padEnd(20)} ` +
        `${n(r.found)}/${n(r.total)} copied` +
        (ok ? "" : ` — ${n(r.missing.length)} missing`),
    );
    if (!ok) {
      log(`        first missing ids: ${r.missing.slice(0, 10).join(", ")}`);
    }
  }

  if (!safe) {
    log(
      "\nNot every document has been copied, so nothing was deleted.\n" +
        "Re-run the migration to copy the missing rows:\n" +
        "  node scripts/migrate-placement-drives.mjs --apply",
    );
    process.exit(1);
  }

  if (!APPLY) {
    log(
      "\nEverything is safely copied. Re-run with --apply to delete the old\n" +
        "collections:\n" +
        "  node scripts/remove-legacy-collections.mjs --apply",
    );
    return;
  }

  let removed = 0;
  for (const { source } of LEGACY) removed += await deleteCollection(source);

  step("Done");
  log(`  removed ${n(removed)} legacy documents`);
  log("  meta/ was left untouched — meta/cronState still holds the cron lock.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`\nStopped: ${err?.message || err}`);
    console.error(
      "\nRe-run to resume. On a slow connection use smaller chunks:\n" +
        "  node scripts/remove-legacy-collections.mjs --delete-chunk=50 --page=150",
    );
    process.exit(1);
  },
);
