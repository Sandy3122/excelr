import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  initializeFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import { getFirebaseServiceAccount } from "./config";

/**
 * Firebase Admin (server-only). Bypasses Firestore security rules.
 * Never import this from a Client Component.
 */

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const account = getFirebaseServiceAccount();
  if (!account) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or add serviceAccountKey.json.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId: account.projectId,
      clientEmail: account.clientEmail,
      privateKey: account.privateKey,
    }),
    projectId: account.projectId,
  });
}

let db: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (db) return db;
  db = initializeFirestore(getAdminApp(), { preferRest: true });
  return db;
}
