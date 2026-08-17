import { AUTOMATION_KINDS } from "./types";
import {
  emptyCounts,
  type AutomationOverview,
  type Channel,
  type ChannelCounts,
  type MessageStatus,
} from "./types";
import { getAutomation, scheduledSendAt } from "./catalog";
import { isScheduledAutomationDue } from "./schedule";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { FIRESTORE_REGISTRATIONS_COLLECTION } from "@/lib/firebase/config";
import { formatIst } from "./ist";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

const STATS_TTL_MS = 60_000;
const SCAN_PAGE_SIZE = 500;
const CACHE_COLLECTION = "meta";
const CACHE_DOC = "automationOverview";

type CountsMap = Record<
  (typeof AUTOMATION_KINDS)[number],
  Record<Channel, ChannelCounts>
>;

interface CachedPayload {
  totalLeads: number;
  counts: CountsMap;
  computedAt: number;
}

let memoryCache: CachedPayload | null = null;
let inFlight: Promise<{
  totalLeads: number;
  automations: AutomationOverview[];
}> | null = null;

function emptyTotals(): CountsMap {
  return Object.fromEntries(
    AUTOMATION_KINDS.map((kind) => {
      const def = getAutomation(kind);
      const counts = Object.fromEntries(
        def.channels.map((ch) => [ch, emptyCounts()]),
      ) as Record<Channel, ChannelCounts>;
      return [kind, counts] as const;
    }),
  ) as CountsMap;
}

function bumpStatus(counts: ChannelCounts, status: MessageStatus | undefined) {
  switch (status) {
    case "sent":
    case "legacy":
      counts.sent += 1;
      break;
    case "failed":
      counts.failed += 1;
      break;
    case "skipped":
      counts.skipped += 1;
      break;
    case "sending":
      counts.sending += 1;
      break;
    default:
      counts.pending += 1;
  }
}

function toOverview(payload: CachedPayload): {
  totalLeads: number;
  automations: AutomationOverview[];
} {
  const now = new Date();
  const automations: AutomationOverview[] = AUTOMATION_KINDS.map((kind) => {
    const def = getAutomation(kind);
    const sendAt = scheduledSendAt(kind);
    const counts = Object.fromEntries(
      (["whatsapp", "email"] as Channel[]).map((ch) => [
        ch,
        def.channels.includes(ch) ? payload.counts[kind][ch] : null,
      ]),
    ) as Record<Channel, ChannelCounts | null>;

    return {
      kind,
      title: def.title,
      description: def.description,
      channels: def.channels,
      scheduleLabel: def.scheduleLabel,
      sendAtIso: sendAt ? sendAt.toISOString() : null,
      isDue: isScheduledAutomationDue(kind, now),
      counts,
    };
  });

  return { totalLeads: payload.totalLeads, automations };
}

function cacheRef() {
  return getAdminFirestore().collection(CACHE_COLLECTION).doc(CACHE_DOC);
}

function isFresh(computedAt: number): boolean {
  return Date.now() - computedAt < STATS_TTL_MS;
}

async function readFirestoreCache(): Promise<CachedPayload | null> {
  try {
    const snap = await cacheRef().get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    if (!d.counts || typeof d.computedAt !== "number") return null;
    return {
      totalLeads: Number(d.totalLeads || 0),
      counts: d.counts as CountsMap,
      computedAt: d.computedAt,
    };
  } catch {
    return null;
  }
}

async function writeFirestoreCache(payload: CachedPayload): Promise<void> {
  try {
    await cacheRef().set(payload);
  } catch (err) {
    console.error("[overview] Failed to persist stats cache:", err);
  }
}

/** Scan only the `messages` field in large pages — used when the cache is cold. */
async function scanCounts(): Promise<CachedPayload> {
  const totals = emptyTotals();
  const col = getAdminFirestore().collection(FIRESTORE_REGISTRATIONS_COLLECTION);
  let last: QueryDocumentSnapshot | undefined;
  let scanned = 0;

  for (;;) {
    let query = col
      .orderBy("submittedAt", "desc")
      .select("messages", "submittedAt")
      .limit(SCAN_PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      const messages = doc.data()?.messages as
        | Record<string, Record<string, { status?: MessageStatus }>>
        | undefined;
      for (const kind of AUTOMATION_KINDS) {
        const def = getAutomation(kind);
        for (const channel of def.channels) {
          const status = messages?.[kind]?.[channel]?.status;
          const effective: MessageStatus | undefined =
            status ?? (kind === "welcome" ? "legacy" : "pending");
          bumpStatus(totals[kind][channel], effective);
        }
      }
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < SCAN_PAGE_SIZE) break;
  }

  return {
    totalLeads: scanned,
    counts: totals,
    computedAt: Date.now(),
  };
}

export async function getAutomationOverview(options?: {
  fresh?: boolean;
}): Promise<{
  totalLeads: number;
  automations: AutomationOverview[];
}> {
  if (!options?.fresh) {
    if (memoryCache && isFresh(memoryCache.computedAt)) {
      return toOverview(memoryCache);
    }
  }

  if (inFlight && !options?.fresh) return inFlight;

  const run = (async () => {
    if (!options?.fresh) {
      const stored = await readFirestoreCache();
      if (stored && isFresh(stored.computedAt)) {
        memoryCache = stored;
        return toOverview(stored);
      }
    }

    const payload = await scanCounts();
    memoryCache = payload;
    void writeFirestoreCache(payload);
    return toOverview(payload);
  })();

  inFlight = run;
  try {
    return await run;
  } finally {
    if (inFlight === run) inFlight = null;
  }
}

/** Drop cached stats so the next dashboard load recomputes (e.g. after a send). */
export function invalidateOverviewCache(): void {
  memoryCache = null;
}

export async function invalidateOverviewCachePersisted(): Promise<void> {
  memoryCache = null;
  try {
    await cacheRef().delete();
  } catch {
    /* ignore */
  }
}

export function formatScheduleForUi(iso: string | null, label: string): string {
  if (!iso) return label;
  return `${label} (${formatIst(new Date(iso))})`;
}
