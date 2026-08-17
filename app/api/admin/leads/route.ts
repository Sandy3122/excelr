import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import {
  countRegistrations,
  getRegistrationById,
  listRegistrations,
} from "@/lib/firebase/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().trim().min(1).max(256).optional(),
  id: z.string().trim().min(1).max(256).optional(),
});

export async function GET(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    id: url.searchParams.get("id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.id) {
      const registration = await getRegistrationById(parsed.data.id);
      if (!registration) {
        return NextResponse.json(
          { ok: false, error: "Registration not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, registration });
    }

    const result = await listRegistrations({
      limit: parsed.data.limit ?? 50,
      cursor: parsed.data.cursor,
    });
    const total = parsed.data.cursor ? undefined : await countRegistrations();
    return NextResponse.json({
      ok: true,
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
