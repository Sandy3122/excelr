/**
 * Resolving the placement drive a public request belongs to.
 *
 * Public callers identify a drive by slug (the landing page's own path). The
 * drive must exist, be enabled and not archived before anything else happens —
 * an unknown slug is rejected rather than defaulted, so a typo can never send
 * traffic into another campaign.
 */

import { z } from "zod";
import { DRIVE_SLUG_RE, type PlacementDrive } from "./types";
import { getDriveBySlug } from "./store";

export const driveSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(DRIVE_SLUG_RE, "Invalid placement drive");

export type DriveResolution =
  | { ok: true; drive: PlacementDrive }
  | { ok: false; status: 404 | 403; error: string; code: string };

export async function resolvePublicDrive(
  rawSlug: unknown,
): Promise<DriveResolution> {
  const parsed = driveSlugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return {
      ok: false,
      status: 404,
      code: "UNKNOWN_DRIVE",
      error: "This registration page is not available.",
    };
  }

  const drive = await getDriveBySlug(parsed.data);
  if (!drive) {
    return {
      ok: false,
      status: 404,
      code: "UNKNOWN_DRIVE",
      error:
        "This placement drive has not been set up yet. Please contact the team.",
    };
  }

  if (drive.archived || !drive.enabled) {
    return {
      ok: false,
      status: 403,
      code: "DRIVE_DISABLED",
      error: "Registrations for this placement drive are closed.",
    };
  }

  return { ok: true, drive };
}
