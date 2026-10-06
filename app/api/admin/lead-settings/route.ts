import { NextResponse } from "next/server";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import { isAdminSectionEnabled } from "@/lib/admin/sections";
import { setDriveLeadSettings } from "@/lib/drives/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_MIN = 25;
const FETCH_MAX = 1000;

function heldNotFound() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

/** Lead-related settings for one drive: deletion switch and batch size. */
export async function GET(req: Request) {
  if (!isAdminSectionEnabled("settings")) return heldNotFound();
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({
    ok: true,
    allowLeadDeletion: ctx.drive.allowLeadDeletion,
    leadFetchSize: ctx.drive.leadFetchSize,
  });
}

export async function PUT(req: Request) {
  if (!isAdminSectionEnabled("settings")) return heldNotFound();
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;

  let body: { allowLeadDeletion?: unknown; leadFetchSize?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const patch: { allowLeadDeletion?: boolean; leadFetchSize?: number } = {};
  if (body.allowLeadDeletion !== undefined) {
    if (typeof body.allowLeadDeletion !== "boolean") {
      return NextResponse.json({ ok: false, error: "allowLeadDeletion must be true or false." }, { status: 400 });
    }
    patch.allowLeadDeletion = body.allowLeadDeletion;
  }
  if (body.leadFetchSize !== undefined) {
    const n = body.leadFetchSize;
    if (typeof n !== "number" || !Number.isInteger(n) || n < FETCH_MIN || n > FETCH_MAX) {
      return NextResponse.json(
        { ok: false, error: `Leads per batch must be a whole number from ${FETCH_MIN} to ${FETCH_MAX}.` },
        { status: 400 },
      );
    }
    patch.leadFetchSize = n;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  try {
    await setDriveLeadSettings(ctx.drive.id, patch);
    return NextResponse.json({
      ok: true,
      allowLeadDeletion: patch.allowLeadDeletion ?? ctx.drive.allowLeadDeletion,
      leadFetchSize: patch.leadFetchSize ?? ctx.drive.leadFetchSize,
    });
  } catch (err) {
    console.error("[admin/lead-settings] save failed:", err);
    return NextResponse.json({ ok: false, error: "Could not save the setting." }, { status: 500 });
  }
}
