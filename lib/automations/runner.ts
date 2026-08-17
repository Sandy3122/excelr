import { hasInfobipConfig } from "@/lib/whatsapp-otp/config";
import { sendNamedWhatsAppTemplateBatch } from "@/lib/whatsapp-otp/infobip";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import {
  listRegistrationsAscending,
  getRegistrationById,
  phoneToDocId,
} from "@/lib/firebase/registrations";
import { getAutomation } from "./catalog";
import { evaluateEligibility } from "./schedule";
import { greetingName } from "./messages";
import { sendAutomationEmail } from "./mail";
import {
  claimChannel,
  createAutomationRun,
  patchAutomationRun,
  setChannelDelivery,
} from "./store";
import {
  emptyChannelDelivery,
  emptyRunStats,
  type AutomationKind,
  type AutomationRun,
  type AutomationRunStats,
  type Channel,
} from "./types";

const PAGE_SIZE = 80;
const WHATSAPP_BATCH = 40;
const EMAIL_CONCURRENCY = 6;
const TIME_BUDGET_MS = 45_000;

export interface RunAutomationOptions {
  kind: AutomationKind;
  triggeredBy: "cron" | "admin";
  force?: boolean;
  retryFailed?: boolean;
  /** Send only this registration (admin per-row send). */
  registrationId?: string;
  timeBudgetMs?: number;
}

function infobipTo(phone: string): string {
  return phoneToDocId(phone);
}

function channelSnapshot(reg: StoredRegistration, kind: AutomationKind, channel: Channel) {
  return {
    status: reg.messages?.[kind]?.[channel]?.status,
    claimedAt: reg.messages?.[kind]?.[channel]?.claimedAt,
  };
}

function dueAtFor(reg: StoredRegistration): Date | null {
  const raw = reg.thingsToCarryDueAt || reg.messages?.things_to_carry?.dueAt;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

function registeredAtFor(reg: StoredRegistration): Date | null {
  const raw = reg.submittedAt || reg.submittedAtIso;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

function bump(
  stats: AutomationRunStats,
  field: keyof AutomationRunStats,
  n = 1,
) {
  stats[field] += n;
}

export async function runAutomation(
  options: RunAutomationOptions,
): Promise<AutomationRun> {
  const kind = options.kind;
  const def = getAutomation(kind);
  const force = Boolean(options.force);
  const retryFailed = Boolean(options.retryFailed);
  const budget = options.timeBudgetMs ?? TIME_BUDGET_MS;
  const started = Date.now();
  const now = () => new Date();

  const run = await createAutomationRun({
    kind,
    triggeredBy: options.triggeredBy,
    force,
    retryFailed,
  });
  const stats = emptyRunStats();

  try {
    if (options.registrationId) {
      const reg = await getRegistrationById(options.registrationId);
      if (reg) {
        stats.scanned = 1;
        await processBatch(kind, [reg], force, retryFailed, stats, now());
      }
      await patchAutomationRun(run.id, {
        status: "completed",
        stats,
        completedAt: new Date().toISOString(),
        cursor: null,
      });
      return { ...run, status: "completed", stats, completedAt: new Date().toISOString() };
    }

    let cursor: string | undefined;
    let finishedScan = false;

    while (Date.now() - started < budget) {
      const page = await listRegistrationsAscending({
        limit: PAGE_SIZE,
        cursor,
      });
      stats.scanned += page.registrations.length;

      const eligible = page.registrations.filter((reg) =>
        def.channels.some((channel) => {
          const result = evaluateEligibility({
            kind,
            channel,
            now: now(),
            force,
            retryFailed,
            dueAt: dueAtFor(reg),
            registeredAt: registeredAtFor(reg),
            snapshot: channelSnapshot(reg, kind, channel),
          });
          return result.ok || result.reason === "cutoff";
        }),
      );

      if (eligible.length > 0) {
        await processBatch(
          kind,
          eligible.slice(0, WHATSAPP_BATCH),
          force,
          retryFailed,
          stats,
          now(),
        );
      }

      if (eligible.length > WHATSAPP_BATCH) {
        await patchAutomationRun(run.id, { cursor: cursor || null, stats });
        continue;
      }

      if (!page.nextCursor) {
        finishedScan = true;
        break;
      }
      cursor = page.nextCursor;
      await patchAutomationRun(run.id, { cursor, stats });
    }

    const status = finishedScan ? "completed" : "running";
    await patchAutomationRun(run.id, {
      status,
      stats,
      cursor: finishedScan ? null : cursor || null,
      completedAt: finishedScan ? new Date().toISOString() : null,
    });
    return {
      ...run,
      status,
      stats,
      cursor: finishedScan ? null : cursor || null,
      completedAt: finishedScan ? new Date().toISOString() : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    await patchAutomationRun(run.id, {
      status: "completed",
      stats,
      error: message,
      completedAt: new Date().toISOString(),
    });
    return {
      ...run,
      status: "completed",
      stats,
      error: message,
      completedAt: new Date().toISOString(),
    };
  }
}

async function processBatch(
  kind: AutomationKind,
  regs: StoredRegistration[],
  force: boolean,
  retryFailed: boolean,
  stats: AutomationRunStats,
  now: Date,
): Promise<void> {
  const def = getAutomation(kind);
  const nowIso = now.toISOString();

  type Claimed = {
    reg: StoredRegistration;
    channels: Channel[];
  };
  const claimed: Claimed[] = [];

  for (const reg of regs) {
    const channels: Channel[] = [];
    for (const channel of def.channels) {
      const elig = evaluateEligibility({
        kind,
        channel,
        now,
        force,
        retryFailed,
        dueAt: dueAtFor(reg),
        registeredAt: registeredAtFor(reg),
        snapshot: channelSnapshot(reg, kind, channel),
      });
      if (!elig.ok) {
        if (elig.reason === "cutoff") {
          await setChannelDelivery(reg.id, kind, channel, {
            ...emptyChannelDelivery("skipped"),
            skippedReason: "Past the 8:45 AM IST cutoff on event day.",
          });
          bump(stats, "skipped");
        }
        continue;
      }
      const ok = await claimChannel(reg.id, kind, channel, nowIso);
      if (ok) channels.push(channel);
    }
    if (channels.length) {
      claimed.push({ reg, channels });
      bump(stats, "claimed", channels.length);
    }
  }

  const waTargets = claimed.filter((c) => c.channels.includes("whatsapp"));
  const waResults = new Map<string, { ok: boolean; id?: string; error?: string }>();

  if (waTargets.length) {
    if (!hasInfobipConfig()) {
      for (const item of waTargets) {
        waResults.set(item.reg.id, { ok: false, error: "Infobip is not configured." });
      }
    } else {
      const batch = await sendNamedWhatsAppTemplateBatch(
        waTargets.map((item) => ({
          to: infobipTo(item.reg.phone),
          firstName: greetingName(item.reg.firstName, item.reg.fullName),
        })),
        def.whatsappTemplateName,
      );
      waTargets.forEach((item, i) => {
        const result = batch[i]?.result;
        if (result?.ok) {
          waResults.set(item.reg.id, {
            ok: true,
            id: result.providerMessageId,
          });
        } else {
          waResults.set(item.reg.id, {
            ok: false,
            error: result && !result.ok ? result.error : "WHATSAPP_SEND_FAILED",
          });
        }
      });
    }
  }

  for (const item of waTargets) {
    const result = waResults.get(item.reg.id);
    if (result?.ok) {
      await setChannelDelivery(item.reg.id, kind, "whatsapp", {
        ...emptyChannelDelivery("sent"),
        sentAt: new Date().toISOString(),
        providerMessageId: result.id || null,
      });
      bump(stats, "sent");
    } else {
      await setChannelDelivery(item.reg.id, kind, "whatsapp", {
        ...emptyChannelDelivery("failed"),
        error: result?.error || "WHATSAPP_SEND_FAILED",
      });
      bump(stats, "failed");
    }
  }

  const emailTargets = claimed.filter((c) => c.channels.includes("email"));
  await mapPool(emailTargets, EMAIL_CONCURRENCY, async (item) => {
    const result = await sendAutomationEmail(kind, item.reg);
    if (result.ok) {
      await setChannelDelivery(item.reg.id, kind, "email", {
        ...emptyChannelDelivery("sent"),
        sentAt: new Date().toISOString(),
      });
      bump(stats, "sent");
    } else {
      await setChannelDelivery(item.reg.id, kind, "email", {
        ...emptyChannelDelivery("failed"),
        error: result.error,
      });
      bump(stats, "failed");
    }
  });
}
