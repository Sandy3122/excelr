import {
  FieldValue,
  type DocumentData,
  type Timestamp,
} from "firebase-admin/firestore";
import type { RegistrationInput } from "@/lib/reg-schema";
import { firstNameFrom } from "@/lib/first-name";
import { buildInitialMessages, parseRegistrationMessages } from "@/lib/automations/messages";
import type { RegistrationRecord, StoredRegistration } from "./registration-types";
import { getAdminFirestore } from "./admin";
import {
  FIRESTORE_REGISTRATION_EMAILS_COLLECTION,
  FIRESTORE_REGISTRATIONS_COLLECTION,
} from "./config";

export const REGISTRATION_EVENT = "java-fullstack-placement-drive";
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

export function toRegistrationRecord(
  data: RegistrationInput,
  timestamp: string,
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
    event: REGISTRATION_EVENT,
  };
}

/** Document id for the email uniqueness lookup (lowercase, no slashes). */
export function emailToDocId(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, "_");
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

function registrationsCol() {
  return getAdminFirestore().collection(FIRESTORE_REGISTRATIONS_COLLECTION);
}

function registrationEmailsCol() {
  return getAdminFirestore().collection(FIRESTORE_REGISTRATION_EMAILS_COLLECTION);
}

function emailLookupRef(emailLower: string) {
  return registrationEmailsCol().doc(emailToDocId(emailLower));
}

function buildRetryPatch(
  record: RegistrationRecord,
  existing: DocumentData | undefined,
  timestamp: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    ...record,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existing?.messages) return patch;

  const submittedIso = String(existing?.submittedAtIso || timestamp);
  const { messages, thingsToCarryDueAt } = buildInitialMessages(
    new Date(submittedIso),
  );
  if (messages.welcome?.whatsapp) {
    messages.welcome.whatsapp.status = "legacy";
  }
  if (messages.welcome?.email) {
    messages.welcome.email.status = "legacy";
  }
  patch.messages = messages;
  patch.thingsToCarryDueAt = thingsToCarryDueAt
    ? thingsToCarryDueAt.toISOString()
    : null;
  return patch;
}

/**
 * Upsert a registration keyed by verified phone (get by document id).
 * Email uniqueness uses a get() on registrationEmails/{email}.
 * Same phone + same email is treated as a retry (merge).
 * Same phone / different email, or same email / different phone → 409.
 */
export async function saveRegistration(
  data: RegistrationInput,
  timestamp: string,
): Promise<{ id: string; created: boolean }> {
  const col = registrationsCol();
  const id = phoneToDocId(data.phone);
  const record = toRegistrationRecord(data, timestamp);
  const phoneRef = col.doc(id);
  const emailRef = emailLookupRef(record.emailLower);

  const saved = await getAdminFirestore().runTransaction(async (tx) => {
    const phoneSnap = await tx.get(phoneRef);
    const emailSnap = await tx.get(emailRef);

    let emailLookupPhoneId = emailSnap.exists
      ? String(emailSnap.data()?.registrationId || "")
      : "";

    // Legacy leads created before the email lookup collection. Only needed
    // when this phone is new; retries already own the phone document.
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
          {
            registrationId: emailLookupPhoneId,
            emailLower: record.emailLower,
          },
          { merge: true },
        );
      }
      return { id, created: false, conflict };
    }

    tx.set(
      emailRef,
      {
        registrationId: id,
        emailLower: record.emailLower,
      },
      { merge: true },
    );

    if (phoneSnap.exists) {
      tx.set(phoneRef, buildRetryPatch(record, phoneSnap.data(), timestamp), {
        merge: true,
      });
      return { id, created: false, conflict: null };
    }

    const registeredAt = new Date(timestamp);
    const { messages, thingsToCarryDueAt } = buildInitialMessages(registeredAt);
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
  id: string,
): Promise<StoredRegistration | null> {
  const snap = await registrationsCol().doc(id).get();
  if (!snap.exists) return null;
  return serializeRegistration(snap.id, snap.data());
}

export async function listRegistrations(options: {
  limit: number;
  cursor?: string;
}): Promise<ListRegistrationsResult> {
  const col = registrationsCol();
  const pageSize = options.limit;
  let query = col.orderBy("submittedAt", "desc").limit(pageSize + 1);

  if (options.cursor) {
    const cursorSnap = await col.doc(options.cursor).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const docs = snap.docs.slice(0, pageSize);
  const hasMore = snap.docs.length > pageSize;

  return {
    registrations: docs.map((doc) => serializeRegistration(doc.id, doc.data())),
    nextCursor: hasMore ? docs[docs.length - 1]?.id ?? null : null,
  };
}

/** Oldest-first scan used by the batch sender so late pages still get a turn. */
export async function listRegistrationsAscending(options: {
  limit: number;
  cursor?: string;
}): Promise<ListRegistrationsResult> {
  const col = registrationsCol();
  const pageSize = options.limit;
  let query = col.orderBy("submittedAt", "asc").limit(pageSize + 1);

  if (options.cursor) {
    const cursorSnap = await col.doc(options.cursor).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const docs = snap.docs.slice(0, pageSize);
  const hasMore = snap.docs.length > pageSize;

  return {
    registrations: docs.map((doc) => serializeRegistration(doc.id, doc.data())),
    nextCursor: hasMore ? docs[docs.length - 1]?.id ?? null : null,
  };
}

export async function listAllRegistrations(max = 5000): Promise<StoredRegistration[]> {
  const all: StoredRegistration[] = [];
  let cursor: string | undefined;
  while (all.length < max) {
    const page = await listRegistrations({
      limit: Math.min(500, max - all.length),
      cursor,
    });
    all.push(...page.registrations);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all;
}

export async function countRegistrations(): Promise<number> {
  const snap = await registrationsCol().count().get();
  return snap.data().count;
}

export async function getRegistrationsByIds(
  ids: string[],
): Promise<StoredRegistration[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const db = getAdminFirestore();
  const out: StoredRegistration[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const refs = chunk.map((id) => registrationsCol().doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      out.push(serializeRegistration(snap.id, snap.data()));
    }
  }
  return out;
}

export async function updateRegistrationFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await registrationsCol().doc(id).set(fields, { merge: true });
}

function serializeRegistration(
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
    event: String(d.event || REGISTRATION_EVENT),
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
