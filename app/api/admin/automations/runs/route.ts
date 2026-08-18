import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { listAutomationRunDays, listRunsOnIstDay } from "@/lib/automations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

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

  const date = new URL(req.url).searchParams.get("date");

  try {
    if (!date) {
      const days = await listAutomationRunDays();
      return NextResponse.json({ ok: true, days });
    }
    if (!DATE_KEY.test(date)) {
      return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 });
    }
    const runs = await listRunsOnIstDay(date);
    return NextResponse.json({ ok: true, date, runs });
  } catch (err) {
    console.error("[admin/automations/runs] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load automation runs." },
      { status: 500 },
    );
  }
}
