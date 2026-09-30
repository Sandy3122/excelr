import { NextResponse } from "next/server";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import { isAdminSectionEnabled } from "@/lib/admin/sections";
import { istDateAndTimeToUtcIso } from "@/lib/registration-window";
import {
  driveWindowStatus,
  setRegistrationWindow,
} from "@/lib/registration-window-store";
import { getDriveById } from "@/lib/drives/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** Middleware already blocks this when Settings is off; belt and braces. */
function heldNotFound() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

/** Registration window for one drive. Closing one drive never affects another. */
export async function GET(req: Request) {
  if (!isAdminSectionEnabled("settings")) return heldNotFound();
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ ok: true, ...driveWindowStatus(ctx.drive) });
}

export async function PUT(req: Request) {
  if (!isAdminSectionEnabled("settings")) return heldNotFound();
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  const driveId = ctx.drive.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    action?: unknown;
    date?: unknown;
    time?: unknown;
  };
  const action = String(payload.action || "");

  const respond = async (closesAtIso: string | null) => {
    await setRegistrationWindow(driveId, closesAtIso);
    const updated = await getDriveById(driveId);
    return NextResponse.json({
      ok: true,
      ...(updated ? driveWindowStatus(updated) : {}),
    });
  };

  try {
    if (action === "open") return await respond(null);
    if (action === "close-now") return await respond(new Date().toISOString());

    if (action === "schedule") {
      const date = String(payload.date || "");
      const time = String(payload.time || "");
      if (!DATE.test(date) || !TIME.test(time)) {
        return NextResponse.json(
          { ok: false, error: "Choose a valid IST date and time." },
          { status: 400 },
        );
      }
      return await respond(istDateAndTimeToUtcIso(date, time));
    }

    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[admin/registration-window] save failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not save registration settings." },
      { status: 500 },
    );
  }
}
