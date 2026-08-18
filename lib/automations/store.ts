import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  FIRESTORE_AUTOMATION_RUNS_COLLECTION,
  FIRESTORE_REGISTRATIONS_COLLECTION,
} from "@/lib/firebase/config";
import { getRegistrationById } from "@/lib/firebase/registrations";
import {
  emptyChannelDelivery,
  emptyRunStats,
  type AutomationKind,
  type AutomationRun,
  type AutomationRunStats,
  type Channel,
  type ChannelDelivery,
  type MessageStatus,
} from "./types";
import { istDateKey, istDayUtcRange } from "./ist";

function runsCol() {
  return getAdminFirestore().collection(FIRESTORE_AUTOMATION_RUNS_COLLECTION);
}

function regsCol() {
  return getAdminFirestore().collection(FIRESTORE_REGISTRATIONS_COLLECTION);
}

function serializeRun(id: string, d: DocumentData): AutomationRun {
  return {
    id,
    kind: d.kind,
    status: d.status,
    triggeredBy: d.triggeredBy,
    force: Boolean(d.force),
    retryFailed: Boolean(d.retryFailed),
    cursor: d.cursor ?? null,
    stats: { ...emptyRunStats(), ...(d.stats || {}) },
    error: d.error ?? null,
    startedAt: d.startedAt ?? null,
    updatedAt: d.updatedAt ?? null,
    completedAt: d.completedAt ?? null,
  };
}

export async function createAutomationRun(input: {
  kind: AutomationKind;
  triggeredBy: "cron" | "admin";
  force: boolean;
  retryFailed: boolean;
}): Promise<AutomationRun> {
  const ref = runsCol().doc();
  const now = new Date().toISOString();
  const data = {
    kind: input.kind,
    status: "running" as const,
    triggeredBy: input.triggeredBy,
    force: input.force,
    retryFailed: input.retryFailed,
    cursor: null as string | null,
    stats: emptyRunStats(),
    error: null as string | null,
    startedAt: now,
    updatedAt: now,
    completedAt: null as string | null,
  };
  await ref.set(data);
  return { id: ref.id, ...data };
}

export async function patchAutomationRun(
  id: string,
  patch: Partial<{
    status: AutomationRun["status"];
    cursor: string | null;
    stats: AutomationRunStats;
    error: string | null;
    completedAt: string | null;
  }>,
): Promise<void> {
  await runsCol()
    .doc(id)
    .set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function getAutomationRun(
  id: string,
): Promise<AutomationRun | null> {
  const snap = await runsCol().doc(id).get();
  if (!snap.exists) return null;
  return serializeRun(snap.id, snap.data() || {});
}

export async function listRecentRuns(
  kind?: AutomationKind,
  limit = 8,
): Promise<AutomationRun[]> {
  const fetchLimit = kind ? Math.max(limit * 3, 24) : limit;
  const snap = await runsCol().orderBy("startedAt", "desc").limit(fetchLimit).get();
  const runs = snap.docs.map((doc) => serializeRun(doc.id, doc.data() || {}));
  const filtered = kind ? runs.filter((r) => r.kind === kind) : runs;
  return filtered.slice(0, limit);
}

/** Distinct IST calendar days that have automation runs (newest first). */
export async function listAutomationRunDays(
  scanLimit = 2500,
): Promise<string[]> {
  const snap = await runsCol()
    .orderBy("startedAt", "desc")
    .select("startedAt")
    .limit(scanLimit)
    .get();
  const seen = new Set<string>();
  const days: string[] = [];
  for (const doc of snap.docs) {
    const startedAt = doc.data()?.startedAt as string | undefined;
    if (!startedAt) continue;
    const parsed = Date.parse(startedAt);
    if (!Number.isFinite(parsed)) continue;
    const key = istDateKey(new Date(parsed));
    if (seen.has(key)) continue;
    seen.add(key);
    days.push(key);
  }
  return days;
}

/** All runs that started during the given IST calendar day (`YYYY-MM-DD`). */
export async function listRunsOnIstDay(
  dateKey: string,
  limit = 500,
): Promise<AutomationRun[]> {
  const { startIso, endIso } = istDayUtcRange(dateKey);
  const snap = await runsCol()
    .where("startedAt", ">=", startIso)
    .where("startedAt", "<", endIso)
    .orderBy("startedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => serializeRun(doc.id, doc.data() || {}));
}

export async function completeStaleAutomationRuns(
  maxAgeMs = 2 * 60 * 1000,
): Promise<number> {
  const snap = await runsCol().orderBy("startedAt", "desc").limit(30).get();
  const now = Date.now();
  let n = 0;
  for (const doc of snap.docs) {
    const run = serializeRun(doc.id, doc.data() || {});
    if (run.status !== "running") continue;
    const started = run.startedAt ? Date.parse(run.startedAt) : 0;
    if (!Number.isFinite(started) || now - started < maxAgeMs) continue;
    await patchAutomationRun(run.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      error: run.error || "Timed out; the next cron tick continues remaining leads.",
    });
    n += 1;
  }
  return n;
}

function cronStateRef() {
  return getAdminFirestore().collection("meta").doc("cronState");
}

export async function acquireCronLock(
  owner: string,
  ttlMs: number,
): Promise<boolean> {
  try {
    return await getAdminFirestore().runTransaction(async (tx) => {
      const ref = cronStateRef();
      const snap = await tx.get(ref);
      const now = Date.now();
      const lockUntil = Number(snap.data()?.lockUntil || 0);
      if (lockUntil > now) return false;
      tx.set(
        ref,
        { lockUntil: now + ttlMs, lockOwner: owner },
        { merge: true },
      );
      return true;
    });
  } catch (err) {
    console.warn(
      "[cron] Could not acquire lock:",
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}

export async function releaseCronLock(owner: string): Promise<void> {
  try {
    await getAdminFirestore().runTransaction(async (tx) => {
      const ref = cronStateRef();
      const snap = await tx.get(ref);
      if (String(snap.data()?.lockOwner || "") !== owner) return;
      tx.set(ref, { lockUntil: 0, lockOwner: null }, { merge: true });
    });
  } catch (err) {
    console.warn(
      "[cron] Could not release lock:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getCronCursor(
  kind: AutomationKind,
): Promise<string | undefined> {
  try {
    const snap = await cronStateRef().get();
    const cursor = snap.data()?.cursors?.[kind];
    return typeof cursor === "string" && cursor ? cursor : undefined;
  } catch {
    return undefined;
  }
}

export async function setCronCursor(
  kind: AutomationKind,
  cursor: string | null,
): Promise<void> {
  await cronStateRef().set(
    { cursors: { [kind]: cursor } },
    { merge: true },
  );
}

export async function setChannelDelivery(
  registrationId: string,
  kind: AutomationKind,
  channel: Channel,
  delivery: ChannelDelivery,
): Promise<void> {
  await regsCol()
    .doc(registrationId)
    .set(
      {
        messages: {
          [kind]: {
            [channel]: delivery,
          },
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Write delivery status with retries so a blip does not leave a lock that later resends. */
export async function persistChannelDelivery(
  registrationId: string,
  kind: AutomationKind,
  channel: Channel,
  delivery: ChannelDelivery,
): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await setChannelDelivery(registrationId, kind, channel, delivery);
      return;
    } catch (err) {
      last = err;
      await wait(150 * 2 ** attempt);
    }
  }
  throw last instanceof Error ? last : new Error("Could not save delivery status.");
}

/** Keep an in-flight lock alive if the message went out but status could not be saved. */
export async function extendChannelClaim(
  registrationId: string,
  kind: AutomationKind,
  channel: Channel,
): Promise<void> {
  try {
    await regsCol()
      .doc(registrationId)
      .set(
        {
          messages: {
            [kind]: {
              [channel]: {
                claimedAt: new Date().toISOString(),
              },
            },
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (err) {
    console.error("[delivery] Could not extend send lock:", err);
  }
}

export async function claimChannel(
  registrationId: string,
  kind: AutomationKind,
  channel: Channel,
  nowIso: string,
  opts?: { resend?: boolean; retryFailed?: boolean },
): Promise<boolean> {
  const ref = regsCol().doc(registrationId);
  return getAdminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const current = snap.data()?.messages?.[kind]?.[channel]?.status as
      | MessageStatus
      | undefined;
    if (!opts?.resend) {
      if (current === "sent" || current === "skipped" || current === "legacy") {
        return false;
      }
      if (current === "failed" && !opts?.retryFailed) {
        return false;
      }
    }
    if (current === "sending") {
      const claimedAt = String(
        snap.data()?.messages?.[kind]?.[channel]?.claimedAt || "",
      );
      const age = claimedAt ? Date.now() - Date.parse(claimedAt) : Infinity;
      if (Number.isFinite(age) && age < 5 * 60 * 1000) return false;
    }
    tx.set(
      ref,
      {
        messages: {
          [kind]: {
            [channel]: {
              ...emptyChannelDelivery("sending"),
              claimedAt: nowIso,
            },
          },
        },
      },
      { merge: true },
    );
    return true;
  });
}

export async function readChannelStatus(
  registrationId: string,
  kind: AutomationKind,
  channel: Channel,
): Promise<ChannelDelivery | undefined> {
  const reg = await getRegistrationById(registrationId);
  return reg?.messages?.[kind]?.[channel];
}
