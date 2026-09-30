import { NextResponse } from "next/server";
import { requireAdmin, requireAdminDrive } from "@/lib/admin/drive-context";
import {
  DriveSlugTakenError,
  archiveDrive,
  updateDrive,
} from "@/lib/drives/store";
import { driveConfigSchema } from "@/lib/drives/types";
import {
  driveWhatsAppIssues,
  effectiveWhatsAppSettings,
} from "@/lib/drives/whatsapp";
import { invalidateOverviewCache } from "@/lib/automations/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { driveId: string } },
) {
  const ctx = await requireAdminDrive(req, params.driveId);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({
    ok: true,
    drive: ctx.drive,
    issues: driveWhatsAppIssues(ctx.drive),
    // What the drive resolves to once account defaults are applied, so the
    // admin can see that a blank field is inherited rather than missing.
    effective: effectiveWhatsAppSettings(ctx.drive),
  });
}

/**
 * Replace a drive's configuration.
 *
 * The whole document is re-validated server-side; the client's copy of the
 * schema is a convenience, never the authority.
 */
export async function PUT(
  req: Request,
  { params }: { params: { driveId: string } },
) {
  const ctx = await requireAdminDrive(req, params.driveId);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = driveConfigSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: issue
          ? `${issue.path.join(".") || "config"}: ${issue.message}`
          : "Check the configuration and try again.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const drive = await updateDrive(params.driveId, parsed.data);
    // Channel and enabled changes alter which counters the dashboard shows.
    invalidateOverviewCache(params.driveId);
    return NextResponse.json({
      ok: true,
      drive,
      issues: driveWhatsAppIssues(drive),
      effective: effectiveWhatsAppSettings(drive),
    });
  } catch (err) {
    if (err instanceof DriveSlugTakenError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error("[admin/drives] update failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not save the placement drive." },
      { status: 500 },
    );
  }
}

/**
 * Archive (not delete). A drive owns live registrations and delivery history;
 * removing the document would orphan every subcollection underneath it.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { driveId: string } },
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const restore = new URL(req.url).searchParams.get("restore") === "1";
  try {
    await archiveDrive(params.driveId, !restore);
    return NextResponse.json({ ok: true, archived: !restore });
  } catch (err) {
    console.error("[admin/drives] archive failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not archive the placement drive." },
      { status: 500 },
    );
  }
}
