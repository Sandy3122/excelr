import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import { isAutomationKind } from "@/lib/automations/catalog";
import { getAutomationOverview, invalidateOverviewCache } from "@/lib/automations/overview";
import { listRecentRuns } from "@/lib/automations/store";
import { runAutomation } from "@/lib/automations/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const postSchema = z.object({
  action: z.enum(["run", "retry_failed", "resend"]).default("run"),
  force: z.boolean().optional(),
  includeEmail: z.boolean().optional(),
  registrationId: z.string().trim().min(1).max(256).optional(),
  registrationIds: z.array(z.string().trim().min(1).max(256)).max(50).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { kind: string } },
) {
  if (!isAutomationKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown automation." }, { status: 404 });
  }

  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  const drive = ctx.drive;

  try {
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const [overview, recentRuns] = await Promise.all([
      getAutomationOverview(drive, { fresh }),
      listRecentRuns(drive.id, params.kind, 8),
    ]);
    const automation = overview.automations.find((a) => a.kind === params.kind);
    return NextResponse.json({
      ok: true,
      placementDriveId: drive.id,
      automation,
      config: drive.automations[params.kind],
      templateName: drive.automations[params.kind].whatsappTemplateName,
      recentRuns,
      totalLeads: overview.totalLeads,
    });
  } catch (err) {
    console.error("[admin/automations/kind] GET failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load automation." },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { kind: string } },
) {
  if (!isAutomationKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown automation." }, { status: 404 });
  }

  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  const drive = ctx.drive;

  if (!drive.automations[params.kind].enabled) {
    return NextResponse.json(
      { ok: false, error: "This automation is turned off for the selected drive." },
      { status: 409 },
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = postSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  try {
    const run = await runAutomation({
      drive,
      kind: params.kind,
      triggeredBy: "admin",
      force: parsed.data.force ?? true,
      retryFailed:
        parsed.data.action === "retry_failed" ||
        parsed.data.action === "resend",
      resend: parsed.data.action === "resend",
      registrationId: parsed.data.registrationId,
      registrationIds: parsed.data.registrationIds,
      includeEmail: parsed.data.includeEmail,
    });
    invalidateOverviewCache(drive.id);
    return NextResponse.json({ ok: true, run });
  } catch (err) {
    console.error("[admin/automations/kind] POST failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not start the send." },
      { status: 500 },
    );
  }
}
