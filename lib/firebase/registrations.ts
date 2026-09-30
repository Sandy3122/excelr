/**
 * Registrations, scoped to one placement drive.
 *
 * Every read and write goes through `placementDrives/{driveId}/registrations`,
 * so a query cannot reach another drive's leads without being handed a
 * different drive id. Phone and email uniqueness are enforced per drive — the
 * same person may register for two different drives.
 */

import {
  FieldValue,
  type DocumentData,
  type Timestamp,
} from "firebase-admin/firestore";
import type { RegistrationInput } from "@/lib/reg-schema";
import { firstNameFrom } from "@/lib/first-name";
import {
  buildInitialMessages,
  parseRegistrationMessages,
} from "@/lib/automations/messages";
import type { DriveScheduleContext } from "@/lib/automations/schedule";
import type { RegistrationRecord, StoredRegistration } from "./registration-types";
import { getAdminFirestore } from "./admin";
import {
  driveRegistrationEmailsCol,
  driveRegistrationsCol,
} from "@/lib/drives/store";

export type { RegistrationRecord, StoredRegistration } from "./registration-types";

export class DuplicateRegistrationError extends Error {
  constructor(public readonly field: "email" | "phone") {
    super(
      field === "phone"
        ? "This WhatsApp number is already registered."
        : "This email is already registered.",
    );
    this.name = "DuplicateRegistrationError";
  }
}

export interface ListRegistrationsResult {
  registrations: StoredRegistration[];
  nextCursor: string | null;
}

/** Document id is the verified E.164 phone without a leading +. */
export function phoneToDocId(phone: string): string {
  return phone.trim().replace(/^\+/, "");
}

/** Document id for the email uniqueness lookup (lowercase, no slashes). */
export function emailToDocId(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, "_");
}

export function toRegistrationRecord(
  data: RegistrationInput,
  timestamp: string,
  drive: { id: string; slug: string; eventKey: string },
): RegistrationRecord {
  return {
    fullName: data.fullName,
    firstName: firstNameFrom(data.fullName),
    email: data.email,
    emailLower: data.email.trim().toLowerCase(),
    phone: data.phone,
    college: data.college,
    qualification: data.qualification,
    pageUrl: data.pageUrl,
    submittedAtIso: timestamp,
    event: drive.eventKey,
    placementDriveId: drive.id,
    placementDriveSlug: drive.slug,
  };
}

export type RegistrationIdentityConflict = "phone" | "email";

/**
 * Phone is unique. Email is unique. Name / college / qualification are not.
 * Same phone + same email is a retry, not a conflict.
 */
export function registrationIdentityConflict(input: {
  phoneId: string;
  emailLower: string;
  phoneExists: boolean;
  existingEmailLower: string;
  emailLookupPhoneId: string | null;
}): RegistrationIdentityConflict | null {
  const existingEmail = input.existingEmailLower.trim().toLowerCase();
  const lookupId = input.emailLookupPhoneId;

  if (input.phoneExists) {
    if (existingEmail && existingEmail !== input.emailLower) return "phone";
    if (lookupId && lookupId !== input.phoneId) return "email";
    return null;
  }

  if (lookupId && lookupId !== input.phoneId) return "email";
  return null;
}

function emailLookupRef(driveId: string, emailLower: string) {
  return driveRegistrationEmailsCol(driveId).doc(emailToDocId(emailLower));
}

function buildRetryPatch(
  record: RegistrationRecord,
  existing: DocumentData | undefined,
  timestamp: string,
  ctx: DriveScheduleContext,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    ...record,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existing?.messages) return patch;

  const submittedIso = String(existing?.submittedAtIso || timestamp);
  const { messages, thingsToCarryDueAt } = buildInitialMessages(
    ctx,
    new Date(submittedIso),
  );
  // The lead already exists without delivery tracking, so the welcome must not
  // fire again — mark it as historical rather than pending.
  if (messages.welcome?.whatsapp) messages.welcome.whatsapp.status = "legacy";
  if (messages.welcome?.email) messages.welcome.email.status = "legacy";
  patch.messages = messages;
  patch.thingsToCarryDueAt = thingsToCarryDueAt
    ? thingsToCarryDueAt.toISOString()
    : null;
  return patch;
}

/**
 * Upsert a registration for one drive, keyed by verified phone.
 * Same phone + same email is treated as a retry (merge).
 * Same phone / different email, or same email / different phone → conflict.
 */
export async function saveRegistration(
  drive: { id: string; slug: string; eventKey: string },
  ctx: DriveScheduleContext,
  data: RegistrationInput,
  timestamp: string,
): Promise<{ id: string; created: boolean }> {
  const col = driveRegistrationsCol(drive.id);
  const id = phoneToDocId(data.phone);
  const record = toRegistrationRecord(data, timestamp, drive);
  const phoneRef = col.doc(id);
  const emailRef = emailLookupRef(drive.id, record.emailLower);

  const saved = await getAdminFirestore().runTransaction(async (tx) => {
    const phoneSnap = await tx.get(phoneRef);
    const emailSnap = await tx.get(emailRef);

    let emailLookupPhoneId = emailSnap.exists
      ? String(emailSnap.data()?.registrationId || "")
      : "";

    // Leads migrated from before the email lookup existed. Only needed when
    // this phone is new; retries already own the phone document.
    if (!emailLookupPhoneId && !phoneSnap.exists) {
      const legacy = await tx.get(
        col.where("emailLower", "==", record.emailLower).limit(1),
      );
      emailLookupPhoneId = legacy.docs[0]?.id || "";
    }

    const conflict = registrationIdentityConflict({
      phoneId: id,
      emailLower: record.emailLower,
      phoneExists: phoneSnap.exists,
      existingEmailLower: String(phoneSnap.data()?.emailLower || ""),
      emailLookupPhoneId: emailLookupPhoneId || null,
    });

    if (conflict) {
      if (conflict === "email" && emailLookupPhoneId && !emailSnap.exists) {
        tx.set(
          emailRef,
          { registrationId: emailLookupPhoneId, emailLower: record.emailLower },
          { merge: true },
        );
      }
      return { id, created: false, conflict };
    }

    tx.set(
      emailRef,
      { registrationId: id, emailLower: record.emailLower },
      { merge: true },
    );

    if (phoneSnap.exists) {
      tx.set(
        phoneRef,
        buildRetryPatch(record, phoneSnap.data(), timestamp, ctx),
        { merge: true },
      );
      return { id, created: false, conflict: null };
    }

    const { messages, thingsToCarryDueAt } = buildInitialMessages(
      ctx,
      new Date(timestamp),
    );
    tx.set(phoneRef, {
      ...record,
      messages,
      thingsToCarryDueAt: thingsToCarryDueAt
        ? thingsToCarryDueAt.toISOString()
        : null,
      submittedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id, created: true, conflict: null };
  });

  if (saved.conflict) throw new DuplicateRegistrationError(saved.conflict);
  return { id: saved.id, created: saved.created };
}

export async function getRegistrationById(
  driveId: string,
  id: string,
): Promise<StoredRegistration | null> {
  const snap = await driveRegistrationsCol(driveId).doc(id).get();
  if (!snap.exists) return null;
  return serializeRegistration(driveId, snap.id, snap.data());
}

async function page(
  driveId: string,
  direction: "asc" | "desc",
  options: { limit: number; cursor?: string },
): Promise<ListRegistrationsResult> {
  const col = driveRegistrationsCol(driveId);
  const pageSize = options.limit;
  let query = col.orderBy("submittedAt", direction).limit(pageSize + 1);

  if (options.cursor) {
    const cursorSnap = await col.doc(options.cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snap = await query.get();
  const docs = snap.docs.slice(0, pageSize);
  const hasMore = snap.docs.length > pageSize;

  return {
    registrations: docs.map((doc) =>
      serializeRegistration(driveId, doc.id, doc.data()),
    ),
    nextCursor: hasMore ? docs[docs.length - 1]?.id ?? null : null,
  };
}

export function listRegistrations(
  driveId: string,
  options: { limit: number; cursor?: string },
): Promise<ListRegistrationsResult> {
  return page(driveId, "desc", options);
}

/** Oldest-first scan used by the batch sender so late pages still get a turn. */
export function listRegistrationsAscending(
  driveId: string,
  options: { limit: number; cursor?: string },
): Promise<ListRegistrationsResult> {
  return page(driveId, "asc", options);
}

export async function listAllRegistrations(
  driveId: string,
  max = 5000,
): Promise<StoredRegistration[]> {
  const all: StoredRegistration[] = [];
  let cursor: string | undefined;
  while (all.length < max) {
    const result = await listRegistrations(driveId, {
      limit: Math.min(500, max - all.length),
      cursor,
    });
    all.push(...result.registrations);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return all;
}

export async function countRegistrations(driveId: string): Promise<number> {
  const snap = await driveRegistrationsCol(driveId).count().get();
  return snap.data().count;
}

export async function getRegistrationsByIds(
  driveId: string,
  ids: string[],
): Promise<StoredRegistration[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const db = getAdminFirestore();
  const col = driveRegistrationsCol(driveId);
  const out: StoredRegistration[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const refs = unique.slice(i, i + 100).map((id) => col.doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      out.push(serializeRegistration(driveId, snap.id, snap.data()));
    }
  }
  return out;
}

export async function updateRegistrationFields(
  driveId: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await driveRegistrationsCol(driveId).doc(id).set(fields, { merge: true });
}

function serializeRegistration(
  driveId: string,
  id: string,
  data: DocumentData | undefined,
): StoredRegistration {
  const d = data || {};
  return {
    id,
    fullName: String(d.fullName || ""),
    firstName: String(d.firstName || firstNameFrom(String(d.fullName || ""))),
    email: String(d.email || ""),
    emailLower: String(d.emailLower || ""),
    phone: String(d.phone || ""),
    college: String(d.college || ""),
    qualification: String(d.qualification || ""),
    pageUrl: String(d.pageUrl || ""),
    submittedAtIso: String(d.submittedAtIso || ""),
    event: String(d.event || ""),
    placementDriveId: String(d.placementDriveId || driveId),
    placementDriveSlug: String(d.placementDriveSlug || ""),
    submittedAt: timestampToIso(d.submittedAt) ?? (d.submittedAtIso || null),
    createdAt: timestampToIso(d.createdAt),
    updatedAt: timestampToIso(d.updatedAt),
    thingsToCarryDueAt:
      timestampToIso(d.thingsToCarryDueAt) ??
      (typeof d.thingsToCarryDueAt === "string" ? d.thingsToCarryDueAt : null),
    messages: parseRegistrationMessages(d.messages),
  };
}

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  return null;
}
