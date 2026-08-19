import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { HOLD_ADMIN_SETTINGS } from "@/lib/admin/settings-feature";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { istDateAndTimeToUtcIso } from "@/lib/registration-window";
import {
  getRegistrationWindowStatus,
  setRegistrationWindow,
} from "@/lib/registration-window-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function heldNotFound() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

export async function GET(req: Request) {
  if (HOLD_ADMIN_SETTINGS) return heldNotFound();
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
    const status = await getRegistrationWindowStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    console.error("[admin/registration-window] get failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load registration settings." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  if (HOLD_ADMIN_SETTINGS) return heldNotFound();
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const action =
    body && typeof body === "object" && "action" in body
      ? String((body as { action?: unknown }).action || "")
      : "";

  try {
    if (action === "open") {
      const status = await setRegistrationWindow(null);
      return NextResponse.json({ ok: true, ...status });
    }

    if (action === "close-now") {
      const status = await setRegistrationWindow(new Date().toISOString());
      return NextResponse.json({ ok: true, ...status });
    }

    if (action === "schedule") {
      const date =
        body && typeof body === "object" && "date" in body
          ? String((body as { date?: unknown }).date || "")
          : "";
      const time =
        body && typeof body === "object" && "time" in body
          ? String((body as { time?: unknown }).time || "")
          : "";
      if (!DATE.test(date) || !TIME.test(time)) {
        return NextResponse.json(
          { ok: false, error: "Choose a valid IST date and time." },
          { status: 400 },
        );
      }
      const closesAtIso = istDateAndTimeToUtcIso(date, time);
      const status = await setRegistrationWindow(closesAtIso);
      return NextResponse.json({ ok: true, ...status });
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
