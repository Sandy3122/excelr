/**
 * Registration window, per placement drive.
 *
 * The close time is stored on the drive document itself, so closing one
 * campaign has no effect on any other.
 */

import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { getDriveBySlug, setDriveRegistrationWindow } from "@/lib/drives/store";
import type { PlacementDrive } from "@/lib/drives/types";
import {
  toWindowStatus,
  type RegistrationWindowStatus,
} from "@/lib/registration-window";

const OPEN: RegistrationWindowStatus = {
  closesAtIso: null,
  updatedAt: null,
  closed: false,
  closesAtLabel: null,
  closedReason: null,
};

export function driveWindowStatus(
  drive: PlacementDrive,
  now: Date = new Date(),
): RegistrationWindowStatus {
  return toWindowStatus(
    {
      closesAtIso: drive.registrationClosesAtIso,
      updatedAt: drive.updatedAt,
      eventDayIstDate: drive.eventDayIstDate,
    },
    now,
  );
}

/**
 * Window for the drive a landing page belongs to. An unknown or disabled drive
 * reads as closed — a page whose campaign is not configured must not take
 * registrations.
 */
export async function getRegistrationWindowStatusForSlug(
  slug: string,
  now: Date = new Date(),
): Promise<RegistrationWindowStatus> {
  if (!hasFirebaseAdminConfig()) return OPEN;
  try {
    const drive = await getDriveBySlug(slug);
    if (!drive) return { ...OPEN, closed: true, closedReason: "scheduled" };
    if (!drive.enabled || drive.archived) {
      return { ...OPEN, closed: true, closedReason: "scheduled" };
    }
    return driveWindowStatus(drive, now);
  } catch (err) {
    console.warn(
      "[registration-window] Could not load drive:",
      err instanceof Error ? err.message : err,
    );
    return OPEN;
  }
}

export async function setRegistrationWindow(
  driveId: string,
  closesAtIso: string | null,
): Promise<void> {
  await setDriveRegistrationWindow(driveId, closesAtIso);
}
