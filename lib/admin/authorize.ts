import { timingSafeEqual } from "crypto";
import { isRegAdminAuthorized } from "@/lib/firebase/admin-auth";
import {
  ADMIN_COOKIE,
  readCookie,
  verifyAdminSessionToken,
} from "./session";

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isCronAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth || !/^bearer\s+/i.test(auth)) return false;
  const token = auth.replace(/^bearer\s+/i, "").trim();
  if (!token) return false;
  return secretsEqual(token, expected);
}

export function isAdminSessionRequest(req: Request): boolean {
  const token = readCookie(req.headers.get("cookie"), ADMIN_COOKIE);
  return verifyAdminSessionToken(token);
}

/** Admin UI cookie, API key, or (for cron routes) CRON_SECRET. */
export function isAdminAuthorized(req: Request, opts?: { allowCron?: boolean }): boolean {
  if (isAdminSessionRequest(req)) return true;
  if (isRegAdminAuthorized(req)) return true;
  if (opts?.allowCron && isCronAuthorized(req)) return true;
  return false;
}
