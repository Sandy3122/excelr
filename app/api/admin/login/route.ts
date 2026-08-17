import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  getAdminPassword,
  passwordsMatch,
  adminCookieHeader,
} from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = getAdminPassword();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Admin login is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const password =
    typeof body === "object" && body && "password" in body
      ? String((body as { password?: unknown }).password || "")
      : "";

  if (!password || !passwordsMatch(password, expected)) {
    return NextResponse.json(
      { ok: false, error: "Incorrect password." },
      { status: 401 },
    );
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Could not create a session." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", adminCookieHeader(token));
  return res;
}
