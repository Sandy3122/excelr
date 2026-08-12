import { timingSafeEqual } from "crypto";

/**
 * Protects GET /api/reg. The public registration form never needs this —
 * only admin listing/read of stored submissions.
 */
export function isRegAdminAuthorized(req: Request): boolean {
  const expected = process.env.REG_ADMIN_API_KEY?.trim();
  if (!expected) return false;

  const provided = extractAdminKey(req);
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractAdminKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const token = auth.replace(/^bearer\s+/i, "").trim();
    if (token) return token;
  }
  const headerKey = req.headers.get("x-admin-key")?.trim();
  return headerKey || null;
}
