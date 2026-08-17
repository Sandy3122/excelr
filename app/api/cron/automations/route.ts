import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { CRON_AUTOMATION_KINDS } from "@/lib/automations/catalog";
import { isScheduledAutomationDue } from "@/lib/automations/schedule";
import { runAutomation } from "@/lib/automations/runner";
import { invalidateOverviewCache } from "@/lib/automations/overview";
import type { AutomationRun } from "@/lib/automations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Automation tick. Vercel Hobby cannot run this every 5 minutes, so
 * vercel.json has no Vercel Cron. Call this URL from an external scheduler
 * (or send from /admin) with Authorization: Bearer $CRON_SECRET.
 *
 * - Sends due "things to carry" WhatsApps
 * - After the IST send-at time, batches the day-before and event-day reminders
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
  const runs: AutomationRun[] = [];
  const deadline = Date.now() + 50_000;

  try {
    for (const kind of CRON_AUTOMATION_KINDS) {
      if (kind !== "things_to_carry" && !isScheduledAutomationDue(kind, now)) {
        continue;
      }
      const remaining = deadline - Date.now();
      if (remaining < 4000) break;
      const run = await runAutomation({
        kind,
        triggeredBy: "cron",
        force: false,
        retryFailed: false,
        timeBudgetMs: remaining,
      });
      runs.push(run);
    }
    invalidateOverviewCache();
    return NextResponse.json({ ok: true, ran: runs.length, runs });
  } catch (err) {
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
