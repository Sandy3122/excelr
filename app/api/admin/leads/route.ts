import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import {
  countRegistrations,
  getRegistrationById,
  listAllRegistrations,
  listRegistrations,
} from "@/lib/firebase/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
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
      limit: parsed.data.limit ?? 50,
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
