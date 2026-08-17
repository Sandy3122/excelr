import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { computeAutomationOverview } from "@/lib/automations/overview";
import { listRecentRuns } from "@/lib/automations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const overview = await computeAutomationOverview();
    const recentRuns = await listRecentRuns(undefined, 12);
    return NextResponse.json({ ok: true, ...overview, recentRuns });
  } catch (err) {
    console.error("[admin/automations] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load automations." },
      { status: 500 },
    );
  }
}
