/**
 * Dashboard statistics for one placement drive.
 *
 * Counts are computed by scanning that drive's registration subcollection only,
 * and cached per drive so one campaign's numbers can never be served for
 * another.
 */

import { AUTOMATION_KINDS } from "./types";
import {
  emptyCounts,
  type AutomationOverview,
  type Channel,
  type ChannelCounts,
  type MessageStatus,
} from "./types";
import { automationMeta } from "./catalog";
import {
  driveScheduleContext,
  isScheduledAutomationDue,
  scheduledSendAt,
} from "./schedule";
import { driveMetaDoc, driveRegistrationsCol } from "@/lib/drives/store";
import type { PlacementDrive } from "@/lib/drives/types";
import { formatIst } from "./ist";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

const STATS_TTL_MS = 60_000;
const SCAN_PAGE_SIZE = 500;
const CACHE_DOC = "automationOverview";
const CACHE_WRITE_MS = 4_000;

type CountsMap = Record<
  (typeof AUTOMATION_KINDS)[number],
  Record<Channel, ChannelCounts>
>;

interface CachedPayload {
  totalLeads: number;
  counts: CountsMap;
  computedAt: number;
}

export interface DriveOverview {
  totalLeads: number;
  automations: AutomationOverview[];
}

const memoryCache = new Map<string, CachedPayload>();
const inFlight = new Map<string, Promise<DriveOverview>>();

function emptyTotals(): CountsMap {
  return Object.fromEntries(
    AUTOMATION_KINDS.map((kind) => [
      kind,
      { whatsapp: emptyCounts(), email: emptyCounts() } as Record<
        Channel,
        ChannelCounts
      >,
    ]),
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

function toOverview(drive: PlacementDrive, payload: CachedPayload): DriveOverview {
  const ctx = driveScheduleContext(drive);
  const now = new Date();

  const automations: AutomationOverview[] = AUTOMATION_KINDS.map((kind) => {
    const config = drive.automations[kind];
    const meta = automationMeta(kind);
    const sendAt = scheduledSendAt(ctx, kind);
    const counts = Object.fromEntries(
      (["whatsapp", "email"] as Channel[]).map((ch) => [
        ch,
        config.channels.includes(ch) ? payload.counts[kind][ch] : null,
      ]),
    ) as Record<Channel, ChannelCounts | null>;

    return {
      kind,
      title: meta.title,
      description: meta.description,
      enabled: config.enabled,
      channels: config.channels,
      scheduleLabel: config.scheduleLabel,
      whatsappTemplateName: config.whatsappTemplateName,
      sendAtIso: sendAt ? sendAt.toISOString() : null,
      isDue: isScheduledAutomationDue(ctx, kind, now),
      counts,
    };
  });

  return { totalLeads: payload.totalLeads, automations };
}

function cacheRef(driveId: string) {
  return driveMetaDoc(driveId, CACHE_DOC);
}

function isFresh(computedAt: number): boolean {
  return Date.now() - computedAt < STATS_TTL_MS;
}

async function readFirestoreCache(driveId: string): Promise<CachedPayload | null> {
  try {
    const snap = await cacheRef(driveId).get();
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

async function writeFirestoreCache(
  driveId: string,
  payload: CachedPayload,
): Promise<void> {
  try {
    await Promise.race([
      cacheRef(driveId).set(payload),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("cache_write_timeout")), CACHE_WRITE_MS);
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    // Cache is optional. A hung gRPC commit can burn ~80s of retries and is not
    // a billing/quota failure — skip it rather than blocking the dashboard.
    console.warn("[overview] Stats cache not persisted:", message);
  }
}

/** Scan only the `messages` field in large pages — used when the cache is cold. */
async function scanCounts(drive: PlacementDrive): Promise<CachedPayload> {
  const totals = emptyTotals();
  const col = driveRegistrationsCol(drive.id);
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
        for (const channel of drive.automations[kind].channels) {
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

  return { totalLeads: scanned, counts: totals, computedAt: Date.now() };
}

export async function getAutomationOverview(
  drive: PlacementDrive,
  options?: { fresh?: boolean },
): Promise<DriveOverview> {
  const driveId = drive.id;

  if (!options?.fresh) {
    const cached = memoryCache.get(driveId);
    if (cached && isFresh(cached.computedAt)) return toOverview(drive, cached);
    const pending = inFlight.get(driveId);
    if (pending) return pending;
  }

  const run = (async () => {
    if (!options?.fresh) {
      const stored = await readFirestoreCache(driveId);
      if (stored && isFresh(stored.computedAt)) {
        memoryCache.set(driveId, stored);
        return toOverview(drive, stored);
      }
    }

    const payload = await scanCounts(drive);
    memoryCache.set(driveId, payload);
    await writeFirestoreCache(driveId, payload);
    return toOverview(drive, payload);
  })();

  inFlight.set(driveId, run);
  try {
    return await run;
  } finally {
    if (inFlight.get(driveId) === run) inFlight.delete(driveId);
  }
}

/** Drop cached stats so the next dashboard load recomputes (e.g. after a send). */
export function invalidateOverviewCache(driveId?: string): void {
  if (driveId) memoryCache.delete(driveId);
  else memoryCache.clear();
}

export async function invalidateOverviewCachePersisted(
  driveId: string,
): Promise<void> {
  memoryCache.delete(driveId);
  try {
    await cacheRef(driveId).delete();
  } catch {
    /* ignore */
  }
}

export function formatScheduleForUi(iso: string | null, label: string): string {
  if (!iso) return label;
  return `${label} (${formatIst(new Date(iso))})`;
}
