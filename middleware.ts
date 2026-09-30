import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HOLD_ADMIN_SETTINGS } from "@/lib/admin/settings-feature";
import { redirectTargetFor } from "@/lib/site";

const HELD_ADMIN_PATHS = new Set([
  "/admin/settings",
  "/api/admin/registration-window",
]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (HELD_ADMIN_PATHS.has(pathname)) {
    if (!HOLD_ADMIN_SETTINGS) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Root and retired campaign paths, both driven by lib/site.ts.
  const target = redirectTargetFor(pathname);
  if (target && target !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/settings",
    "/api/admin/registration-window",
    "/marathahalli-fsd-oct-2026",
  ],
};
