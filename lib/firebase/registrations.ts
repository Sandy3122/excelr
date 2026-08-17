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
import { FIRESTORE_REGISTRATIONS_COLLECTION } from "./config";

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

function registrationsCol() {
  return getAdminFirestore().collection(FIRESTORE_REGISTRATIONS_COLLECTION);
}

/**
 * Upsert a registration keyed by verified phone.
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
  const phoneSnap = await phoneRef.get();

  if (phoneSnap.exists) {
    const existingEmail = String(phoneSnap.data()?.emailLower || "");
    if (existingEmail && existingEmail !== record.emailLower) {
      throw new DuplicateRegistrationError("phone");
    }
    const patch: Record<string, unknown> = {
      ...record,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!phoneSnap.data()?.messages) {
      const submittedIso = String(phoneSnap.data()?.submittedAtIso || timestamp);
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
    }
    await phoneRef.set(patch, { merge: true });
    return { id, created: false };
  }

  const emailSnap = await col
    .where("emailLower", "==", record.emailLower)
    .limit(1)
    .get();
  if (!emailSnap.empty) {
    throw new DuplicateRegistrationError("email");
  }

  const registeredAt = new Date(timestamp);
  const { messages, thingsToCarryDueAt } = buildInitialMessages(registeredAt);

  await phoneRef.set({
    ...record,
    messages,
    thingsToCarryDueAt: thingsToCarryDueAt
      ? thingsToCarryDueAt.toISOString()
      : null,
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id, created: true };
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
      limit: Math.min(100, max - all.length),
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
