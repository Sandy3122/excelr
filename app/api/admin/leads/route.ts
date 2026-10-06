import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateOverviewCachePersisted } from "@/lib/automations/overview";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import {
  countRegistrations,
  deleteRegistration,
  getRegistrationById,
  listAllRegistrations,
  listRegistrations,
} from "@/lib/firebase/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().trim().min(1).max(256).optional(),
  id: z.string().trim().min(1).max(256).optional(),
  all: z.enum(["0", "1"]).optional(),
});

export async function GET(req: Request) {
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  const driveId = ctx.drive.id;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    id: url.searchParams.get("id") ?? undefined,
    all: url.searchParams.get("all") === "1" ? "1" : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.id) {
      const registration = await getRegistrationById(driveId, parsed.data.id);
      if (!registration) {
        return NextResponse.json(
          { ok: false, error: "Registration not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, registration });
    }

    if (parsed.data.all === "1") {
      const registrations = await listAllRegistrations(driveId);
      return NextResponse.json({
        ok: true,
        placementDriveId: driveId,
        registrations,
        nextCursor: null,
        total: registrations.length,
      });
    }

    const result = await listRegistrations(driveId, {
      limit: parsed.data.limit ?? ctx.drive.leadFetchSize,
      cursor: parsed.data.cursor,
    });
    const total = parsed.data.cursor
      ? undefined
      : await countRegistrations(driveId);
    return NextResponse.json({
      ok: true,
      placementDriveId: driveId,
      ...result,
      ...(typeof total === "number" ? { total } : {}),
    });
  } catch (err) {
    console.error("[admin/leads] read failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load registrations." },
      { status: 500 },
    );
  }
}

/** Permanently delete one lead. Rejected unless the drive has deletion switched on. */
export async function DELETE(req: Request) {
  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  if (!ctx.drive.allowLeadDeletion) {
    return NextResponse.json(
      { ok: false, error: "Lead deletion is turned off for this drive. Enable it in Settings." },
      { status: 403 },
    );
  }

  const id = new URL(req.url).searchParams.get("id")?.trim() || "";
  if (!id || id.length > 256 || id.includes("/")) {
    return NextResponse.json({ ok: false, error: "Specify a lead." }, { status: 400 });
  }

  try {
    const deleted = await deleteRegistration(ctx.drive.id, id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
    }
    // Also drops the Firestore-stored copy, which other server instances read.
    await invalidateOverviewCachePersisted(ctx.drive.id);
    console.info(`[admin/leads] deleted lead ${id} from drive ${ctx.drive.id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/leads] delete failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not delete the lead." },
      { status: 500 },
    );
  }
}
