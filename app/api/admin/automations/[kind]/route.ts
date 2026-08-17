import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { isAutomationKind, getAutomation } from "@/lib/automations/catalog";
import { getAutomationOverview, invalidateOverviewCache } from "@/lib/automations/overview";
import { listRecentRuns } from "@/lib/automations/store";
import { runAutomation } from "@/lib/automations/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const postSchema = z.object({
  action: z.enum(["run", "retry_failed", "resend"]).default("run"),
  force: z.boolean().optional(),
  registrationId: z.string().trim().min(1).max(256).optional(),
  registrationIds: z.array(z.string().trim().min(1).max(256)).max(50).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { kind: string } },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!isAutomationKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown automation." }, { status: 404 });
  }
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const [overview, recentRuns] = await Promise.all([
      getAutomationOverview({ fresh }),
      listRecentRuns(params.kind, 8),
    ]);
    const automation = overview.automations.find((a) => a.kind === params.kind);
    const def = getAutomation(params.kind);
    return NextResponse.json({
      ok: true,
      automation,
      templateName: def.whatsappTemplateName,
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
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!isAutomationKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown automation." }, { status: 404 });
  }
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
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
      kind: params.kind,
      triggeredBy: "admin",
      force: parsed.data.force ?? true,
      retryFailed:
        parsed.data.action === "retry_failed" ||
        parsed.data.action === "resend" ||
        Boolean(parsed.data.force),
      resend: parsed.data.action === "resend",
      registrationId: parsed.data.registrationId,
      registrationIds: parsed.data.registrationIds,
    });
    invalidateOverviewCache();
    return NextResponse.json({ ok: true, run });
  } catch (err) {
    console.error("[admin/automations/kind] POST failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not start the send." },
      { status: 500 },
    );
  }
}
