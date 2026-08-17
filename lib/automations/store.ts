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
  const snap = await runsCol().orderBy("startedAt", "desc").limit(40).get();
  const runs = snap.docs.map((doc) => serializeRun(doc.id, doc.data() || {}));
  const filtered = kind ? runs.filter((r) => r.kind === kind) : runs;
  return filtered.slice(0, limit);
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

export async function claimChannel(
  registrationId: string,
  kind: AutomationKind,
  channel: Channel,
  nowIso: string,
): Promise<boolean> {
  const ref = regsCol().doc(registrationId);
  return getAdminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const current = snap.data()?.messages?.[kind]?.[channel]?.status as
      | MessageStatus
      | undefined;
    if (current === "sent" || current === "skipped" || current === "legacy") {
      return false;
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
