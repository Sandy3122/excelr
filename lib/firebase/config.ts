import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Firebase configuration for this project.
 *
 * Server writes/reads go through the Admin SDK (service account). The public
 * `firebaseConfig` values (NEXT_PUBLIC_*) are optional and never grant data
 * access — Firestore rules deny all client traffic.
 *
 * This module is server-only. Do not import it from a "use client" file.
 */

export const FIRESTORE_REGISTRATIONS_COLLECTION =
  process.env.FIRESTORE_REGISTRATIONS_COLLECTION || "registrations";

export interface FirebaseServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function fromEnv(): FirebaseServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw?.trim()) return null;
  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
  };
}

function fromServiceAccountFile(): FirebaseServiceAccount | null {
  const path = join(process.cwd(), "serviceAccountKey.json");
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!raw.project_id || !raw.client_email || !raw.private_key) return null;
    return {
      projectId: raw.project_id,
      clientEmail: raw.client_email,
      privateKey: raw.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

/** Admin credentials from env, falling back to local `serviceAccountKey.json`. */
export function getFirebaseServiceAccount(): FirebaseServiceAccount | null {
  return fromEnv() ?? fromServiceAccountFile();
}

export function hasFirebaseAdminConfig(): boolean {
  return getFirebaseServiceAccount() !== null;
}
