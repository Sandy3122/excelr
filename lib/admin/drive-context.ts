/**
 * Resolving the placement drive an admin request is acting on.
 *
 * Admin routes take a `driveId` and every query is scoped to it. The id is
 * validated against Firestore on each request rather than trusted, so a client
 * cannot widen its own scope by editing the parameter — it can only ever name a
 * drive that exists, and an authenticated admin is allowed to see any of them.
 */

import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { getDriveById } from "@/lib/drives/store";
import type { PlacementDrive } from "@/lib/drives/types";

export type AdminDriveContext =
  | { ok: true; drive: PlacementDrive }
  | { ok: false; response: NextResponse };

function fail(status: number, error: string): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ ok: false, error }, { status }) };
}

/** Auth + storage + drive resolution, in the order every admin route needs. */
export async function requireAdminDrive(
  req: Request,
  explicitDriveId?: string,
): Promise<AdminDriveContext> {
  if (!isAdminAuthorized(req)) return fail(401, "Unauthorized.");
  if (!hasFirebaseAdminConfig()) {
    return fail(503, "Registration storage is not configured.");
  }

  const driveId =
    explicitDriveId?.trim() ||
    new URL(req.url).searchParams.get("driveId")?.trim() ||
    "";
  if (!driveId) {
    return fail(400, "Select a placement drive.");
  }

  const drive = await getDriveById(driveId);
  if (!drive) return fail(404, "Placement drive not found.");

  return { ok: true, drive };
}

/** Auth + storage only, for routes that span drives (e.g. the drive list). */
export function requireAdmin(req: Request): { ok: true } | { ok: false; response: NextResponse } {
  if (!isAdminAuthorized(req)) return fail(401, "Unauthorized.");
  if (!hasFirebaseAdminConfig()) {
    return fail(503, "Registration storage is not configured.");
  }
  return { ok: true };
}
