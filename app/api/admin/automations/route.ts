import { NextResponse } from "next/server";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import { getAutomationOverview } from "@/lib/automations/overview";
import { listAutomationRunDays } from "@/lib/automations/store";
import { driveWhatsAppIssues } from "@/lib/drives/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;

  try {
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const [overview, runDays] = await Promise.all([
      getAutomationOverview(ctx.drive, { fresh }),
      listAutomationRunDays(ctx.drive.id),
    ]);
    return NextResponse.json({
      ok: true,
      placementDriveId: ctx.drive.id,
      ...overview,
      runDays,
      issues: driveWhatsAppIssues(ctx.drive),
    });
  } catch (err) {
    console.error("[admin/automations] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load automations." },
      { status: 500 },
    );
  }
}
