import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { CRON_AUTOMATION_KINDS } from "@/lib/automations/catalog";
import {
  driveScheduleContext,
  isScheduledAutomationDue,
} from "@/lib/automations/schedule";
import { runAutomation } from "@/lib/automations/runner";
import { invalidateOverviewCache } from "@/lib/automations/overview";
import { listRunnableDrives } from "@/lib/drives/store";
import { driveWindowStatus } from "@/lib/registration-window-store";
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
 *
 * Each tick walks every enabled placement drive and, for each of that drive's
 * due automations, sends at most one WhatsApp batch (~40 leads). Whatever is
 * left continues on the next tick from the drive's saved cursor.
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
    const drivesTicked: string[] = [];

    try {
      const drives = await listRunnableDrives();

      for (const drive of drives) {
        if (deadline - Date.now() < 5_000) break;

        const ctx = driveScheduleContext(drive);
        // A closed drive keeps running its automations - the window only stops
        // new registrations, not messages to people already signed up.
        void driveWindowStatus(drive, now);
        drivesTicked.push(drive.slug);

        for (const kind of CRON_AUTOMATION_KINDS) {
          const automation = drive.automations[kind];
          if (!automation?.enabled) continue;
          if (
            automation.schedule.type === "at" &&
            !isScheduledAutomationDue(ctx, kind, now)
          ) {
            continue;
          }

          const remaining = deadline - Date.now();
          if (remaining < 5_000) break;

          runs.push(
            await runAutomation({
              drive,
              kind,
              triggeredBy: "cron",
              force: false,
              retryFailed: false,
              timeBudgetMs: remaining,
              startCursor: await getCronCursor(drive.id, kind),
              maxSendBatches: CRON_MAX_SEND_BATCHES,
              persistCursor: true,
            }),
          );
        }
      }
    } finally {
      await releaseCronLock(lockOwner);
    }

    invalidateOverviewCache();
    return NextResponse.json({
      ok: true,
      drives: drivesTicked,
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
