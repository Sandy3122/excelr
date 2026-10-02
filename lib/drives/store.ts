/**
 * Firestore access for placement drives.
 *
 * Layout - everything a drive owns lives underneath it, so a query can only
 * reach another drive's data by explicitly changing the drive id:
 *
 *   placementDrives/{driveId}
 *     ├── registrations/{phoneDigits}
 *     ├── registrationEmails/{emailDocId}
 *     ├── automationRuns/{runId}
 *     └── meta/{cronState|automationOverview}
 *   placementDriveSlugs/{slug} → { driveId }      (uniqueness + fast resolve)
 *
 * The slug index mirrors the `registrationEmails` pattern already used for
 * email uniqueness: a transactional document get() rather than a query.
 *
 * Server-only. Never import from a "use client" module.
 */

import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { driveSlugAliases } from "@/lib/site";
import {
  driveConfigSchema,
  type PlacementDrive,
  type PlacementDriveConfig,
} from "./types";

export const DRIVES_COLLECTION = "placementDrives";
export const DRIVE_SLUGS_COLLECTION = "placementDriveSlugs";

export const DRIVE_REGISTRATIONS = "registrations";
export const DRIVE_REGISTRATION_EMAILS = "registrationEmails";
export const DRIVE_AUTOMATION_RUNS = "automationRuns";
export const DRIVE_META = "meta";

export class DriveNotFoundError extends Error {
  constructor(ref: string) {
    super(`Placement drive not found: ${ref}`);
    this.name = "DriveNotFoundError";
  }
}

export class DriveSlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Another placement drive already uses the path /${slug}.`);
    this.name = "DriveSlugTakenError";
  }
}

// ─── Refs ──────────────────────────────────────────────────────────────────

export function drivesCol() {
  return getAdminFirestore().collection(DRIVES_COLLECTION);
}

export function driveRef(driveId: string) {
  return drivesCol().doc(driveId);
}

function slugRef(slug: string) {
  return getAdminFirestore().collection(DRIVE_SLUGS_COLLECTION).doc(slug);
}

export function driveRegistrationsCol(driveId: string) {
  return driveRef(driveId).collection(DRIVE_REGISTRATIONS);
}

export function driveRegistrationEmailsCol(driveId: string) {
  return driveRef(driveId).collection(DRIVE_REGISTRATION_EMAILS);
}

export function driveAutomationRunsCol(driveId: string) {
  return driveRef(driveId).collection(DRIVE_AUTOMATION_RUNS);
}

export function driveMetaDoc(driveId: string, doc: string) {
  return driveRef(driveId).collection(DRIVE_META).doc(doc);
}

// ─── Serialisation ─────────────────────────────────────────────────────────

function serializeDrive(id: string, data: DocumentData | undefined): PlacementDrive | null {
  if (!data) return null;
  // Stored documents are written through `driveConfigSchema`, but a partially
  // migrated or hand-edited document must not take the dashboard down.
  const parsed = driveConfigSchema.safeParse(data);
  if (!parsed.success) {
    console.warn(
      `[drives] Drive ${id} failed validation and was skipped:`,
      parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "),
    );
    return null;
  }
  return {
    id,
    ...parsed.data,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
  };
}

// ─── Request-scoped cache ──────────────────────────────────────────────────

const CACHE_TTL_MS = 10_000;
type CacheEntry = { at: number; drive: PlacementDrive | null };
const byId = new Map<string, CacheEntry>();
const bySlug = new Map<string, CacheEntry>();

function fresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return Boolean(entry && Date.now() - entry.at < CACHE_TTL_MS);
}

function cache(drive: PlacementDrive | null, slug?: string) {
  const at = Date.now();
  if (drive) {
    byId.set(drive.id, { at, drive });
    bySlug.set(drive.slug, { at, drive });
  } else if (slug) {
    bySlug.set(slug, { at, drive: null });
  }
  return drive;
}

/** Drop cached drives so the next read sees a just-saved change. */
export function invalidateDriveCache(): void {
  byId.clear();
  bySlug.clear();
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function getDriveById(driveId: string): Promise<PlacementDrive | null> {
  const cached = byId.get(driveId);
  if (fresh(cached)) return cached.drive;
  const snap = await driveRef(driveId).get();
  return cache(snap.exists ? serializeDrive(snap.id, snap.data()) : null);
}

/** Look one slug up through the index. No alias handling. */
async function findBySlugExact(slug: string): Promise<PlacementDrive | null> {
  const indexSnap = await slugRef(slug).get();
  const driveId = indexSnap.exists ? String(indexSnap.data()?.driveId || "") : "";
  if (!driveId) return null;
  const snap = await driveRef(driveId).get();
  if (!snap.exists) return null;
  return serializeDrive(snap.id, snap.data());
}

const warnedAliases = new Set<string>();

export async function getDriveBySlug(slug: string): Promise<PlacementDrive | null> {
  const key = slug.trim().toLowerCase();
  const cached = bySlug.get(key);
  if (fresh(cached)) return cached.drive;

  const direct = await findBySlugExact(key);
  if (direct) return cache(direct, key);

  // Fall back to the slugs this page used to be published under, so a rename
  // in code keeps working until the drive is renamed in the dashboard.
  for (const alias of driveSlugAliases(key)) {
    const drive = await findBySlugExact(alias);
    if (!drive) continue;
    if (!warnedAliases.has(key)) {
      warnedAliases.add(key);
      console.warn(
        `[drives] /${key} resolved through its former slug "${alias}". ` +
          `Rename the drive to "${key}" in Admin → Placement Drives, then drop ` +
          `the alias from lib/site.ts.`,
      );
    }
    return cache(drive, key);
  }

  console.error(
    `[drives] No placement drive is configured for "/${key}". That page will ` +
      `refuse registrations until a drive with this path exists.`,
  );
  return cache(null, key);
}

/** Throws rather than returning null - use where a missing drive is a bug. */
export async function requireDriveById(driveId: string): Promise<PlacementDrive> {
  const drive = await getDriveById(driveId);
  if (!drive) throw new DriveNotFoundError(driveId);
  return drive;
}

export async function requireDriveBySlug(slug: string): Promise<PlacementDrive> {
  const drive = await getDriveBySlug(slug);
  if (!drive) throw new DriveNotFoundError(`/${slug}`);
  return drive;
}

export async function listDrives(options?: {
  includeArchived?: boolean;
}): Promise<PlacementDrive[]> {
  const snap = await drivesCol().orderBy("createdAt", "desc").limit(200).get();
  const drives = snap.docs
    .map((doc) => serializeDrive(doc.id, doc.data()))
    .filter((d): d is PlacementDrive => d !== null);
  return options?.includeArchived ? drives : drives.filter((d) => !d.archived);
}

/** Drives the cron should tick. */
export async function listRunnableDrives(): Promise<PlacementDrive[]> {
  const drives = await listDrives();
  return drives.filter((d) => d.enabled);
}

// ─── Writes ────────────────────────────────────────────────────────────────

/**
 * Create a drive and claim its slug in one transaction, so two admins saving
 * the same path cannot both succeed.
 */
export async function createDrive(
  config: PlacementDriveConfig,
): Promise<PlacementDrive> {
  const db = getAdminFirestore();
  const ref = drivesCol().doc();
  const now = new Date().toISOString();
  const slug = config.slug.trim().toLowerCase();

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(slugRef(slug));
    if (existing.exists) throw new DriveSlugTakenError(slug);
    tx.set(ref, { ...config, slug, createdAt: now, updatedAt: now });
    tx.set(slugRef(slug), { driveId: ref.id, slug });
  });

  invalidateDriveCache();
  return { id: ref.id, ...config, slug, createdAt: now, updatedAt: now };
}

/**
 * Replace a drive's configuration. Moving the slug re-points the index and
 * releases the old one, still transactionally.
 */
export async function updateDrive(
  driveId: string,
  config: PlacementDriveConfig,
): Promise<PlacementDrive> {
  const db = getAdminFirestore();
  const ref = driveRef(driveId);
  const now = new Date().toISOString();
  const slug = config.slug.trim().toLowerCase();

  const createdAt = await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) throw new DriveNotFoundError(driveId);
    const previousSlug = String(current.data()?.slug || "");

    if (previousSlug !== slug) {
      const claimed = await tx.get(slugRef(slug));
      if (claimed.exists && String(claimed.data()?.driveId || "") !== driveId) {
        throw new DriveSlugTakenError(slug);
      }
      tx.set(slugRef(slug), { driveId, slug });
      if (previousSlug) tx.delete(slugRef(previousSlug));
    }

    tx.set(ref, { ...config, slug, updatedAt: now }, { merge: true });
    return typeof current.data()?.createdAt === "string"
      ? (current.data()?.createdAt as string)
      : null;
  });

  invalidateDriveCache();
  return { id: driveId, ...config, slug, createdAt, updatedAt: now };
}

/**
 * Archive rather than delete. A drive owns live registrations and delivery
 * history; removing the document would orphan every subcollection.
 */
export async function archiveDrive(driveId: string, archived: boolean): Promise<void> {
  await driveRef(driveId).set(
    { archived, enabled: archived ? false : true, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  invalidateDriveCache();
}

export async function setDriveRegistrationWindow(
  driveId: string,
  closesAtIso: string | null,
): Promise<void> {
  await driveRef(driveId).set(
    { registrationClosesAtIso: closesAtIso, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  invalidateDriveCache();
}

/** Used by the migration script to seed a drive at a known id. */
export async function upsertDriveAtId(
  driveId: string,
  config: PlacementDriveConfig,
): Promise<void> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const slug = config.slug.trim().toLowerCase();

  await db.runTransaction(async (tx) => {
    const ref = driveRef(driveId);
    const current = await tx.get(ref);
    const claimed = await tx.get(slugRef(slug));
    if (claimed.exists && String(claimed.data()?.driveId || "") !== driveId) {
      throw new DriveSlugTakenError(slug);
    }
    tx.set(
      ref,
      {
        ...config,
        slug,
        createdAt: current.exists ? current.data()?.createdAt || now : now,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(slugRef(slug), { driveId, slug });
  });

  invalidateDriveCache();
}

/** Server timestamp helper shared by the drive-scoped stores. */
export const driveServerTimestamp = () => FieldValue.serverTimestamp();
