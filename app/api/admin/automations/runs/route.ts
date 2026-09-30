import { NextResponse } from "next/server";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import { listAutomationRunDays, listRunsOnIstDay } from "@/lib/automations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;

  const date = new URL(req.url).searchParams.get("date");

  try {
    if (!date) {
      const days = await listAutomationRunDays(ctx.drive.id);
      return NextResponse.json({ ok: true, days });
    }
    if (!DATE_KEY.test(date)) {
      return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 });
    }
    const runs = await listRunsOnIstDay(ctx.drive.id, date);
    return NextResponse.json({ ok: true, date, runs });
  } catch (err) {
    console.error("[admin/automations/runs] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load automation runs." },
      { status: 500 },
    );
  }
}
