import { NextResponse } from "next/server";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import { isAdminSectionEnabled } from "@/lib/admin/sections";
import { setDriveLeadDeletion } from "@/lib/drives/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function heldNotFound() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

/** Whether lead deletion is switched on for one drive. */
export async function GET(req: Request) {
  if (!isAdminSectionEnabled("settings")) return heldNotFound();
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ ok: true, allowLeadDeletion: ctx.drive.allowLeadDeletion });
}

export async function PUT(req: Request) {
  if (!isAdminSectionEnabled("settings")) return heldNotFound();
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;

  let body: { allow?: unknown };
  try {
    body = (await req.json()) as { allow?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.allow !== "boolean") {
    return NextResponse.json({ ok: false, error: "Specify allow as true or false." }, { status: 400 });
  }

  try {
    await setDriveLeadDeletion(ctx.drive.id, body.allow);
    return NextResponse.json({ ok: true, allowLeadDeletion: body.allow });
  } catch (err) {
    console.error("[admin/lead-deletion] save failed:", err);
    return NextResponse.json({ ok: false, error: "Could not save the setting." }, { status: 500 });
  }
}
