import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { CRON_AUTOMATION_KINDS } from "@/lib/automations/catalog";
import { isScheduledAutomationDue } from "@/lib/automations/schedule";
import { runAutomation } from "@/lib/automations/runner";
import { invalidateOverviewCache } from "@/lib/automations/overview";
import {
  CRON_HANDLER_BUDGET_MS,
  CRON_MAX_SEND_BATCHES,
} from "@/lib/automations/cron-limits";
import {
  acquireCronLock,
  getCronCursor,
  releaseCronLock,
} from "@/lib/automations/store";
import type { AutomationRun } from "@/lib/automations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pinged by cron-job.org every 10 minutes (30s timeout is a hard cap).
 * Each tick sends at most one WhatsApp batch (~40 leads) per due automation
 * and returns within ~18s so the job is 200 OK. Remaining due leads continue
 * on the next 10-minute tick.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: Request) {
  if (!isAdminAuthorized(req, { allowCron: true })) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  const now = new Date();
  const handlerStarted = Date.now();
  const deadline = handlerStarted + CRON_HANDLER_BUDGET_MS;
  const lockOwner = `cron-${handlerStarted}`;

  try {
    const locked = await acquireCronLock(lockOwner, 25_000);
    if (!locked) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Another cron tick is still running.",
        ran: 0,
        runs: [],
      });
    }

    const runs: AutomationRun[] = [];
    try {
      for (const kind of CRON_AUTOMATION_KINDS) {
        if (kind !== "things_to_carry" && !isScheduledAutomationDue(kind, now)) {
          continue;
        }
        const remaining = deadline - Date.now();
        if (remaining < 5_000) break;
        const run = await runAutomation({
          kind,
          triggeredBy: "cron",
          force: false,
          retryFailed: false,
          timeBudgetMs: remaining,
          startCursor: await getCronCursor(kind),
          maxSendBatches: CRON_MAX_SEND_BATCHES,
          persistCursor: true,
        });
        runs.push(run);
      }
    } finally {
      await releaseCronLock(lockOwner);
    }

    invalidateOverviewCache();
    return NextResponse.json({
      ok: true,
      ran: runs.length,
      more: runs.some((run) => Boolean(run.cursor)),
      durationMs: Date.now() - handlerStarted,
      runs,
    });
  } catch (err) {
    await releaseCronLock(lockOwner);
    console.error("[cron/automations] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Cron automation run failed." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
