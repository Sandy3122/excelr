import { getAdminFirestore } from "@/lib/firebase/admin";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import {
  toWindowStatus,
  type RegistrationWindow,
  type RegistrationWindowStatus,
} from "@/lib/registration-window";

const META_COLLECTION = "meta";
const META_DOC = "registrationWindow";
const CACHE_MS = 8_000;

let memoryCache: { at: number; window: RegistrationWindow } | null = null;

function windowRef() {
  return getAdminFirestore().collection(META_COLLECTION).doc(META_DOC);
}

export async function getRegistrationWindow(): Promise<RegistrationWindow> {
  const empty: RegistrationWindow = { closesAtIso: null, updatedAt: null };
  if (!hasFirebaseAdminConfig()) return empty;
  if (memoryCache && Date.now() - memoryCache.at < CACHE_MS) {
    return memoryCache.window;
  }
  try {
    const snap = await windowRef().get();
    const d = snap.data() || {};
    const closesAtIso =
      typeof d.closesAtIso === "string" && d.closesAtIso.trim()
        ? d.closesAtIso
        : null;
    const window: RegistrationWindow = {
      closesAtIso,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null,
    };
    memoryCache = { at: Date.now(), window };
    return window;
  } catch (err) {
    console.warn(
      "[registration-window] Could not load:",
      err instanceof Error ? err.message : err,
    );
    return empty;
  }
}

export async function getRegistrationWindowStatus(
  now: Date = new Date(),
): Promise<RegistrationWindowStatus> {
  return toWindowStatus(await getRegistrationWindow(), now);
}

export async function setRegistrationWindow(
  closesAtIso: string | null,
): Promise<RegistrationWindowStatus> {
  const updatedAt = new Date().toISOString();
  await windowRef().set({ closesAtIso, updatedAt }, { merge: true });
  const window: RegistrationWindow = { closesAtIso, updatedAt };
  memoryCache = { at: Date.now(), window };
  return toWindowStatus(window);
}
