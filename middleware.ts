import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminPathDisabled } from "@/lib/admin/sections";
import { redirectTargetFor } from "@/lib/site";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // A section switched off in lib/admin/sections.ts is unreachable, including
  // by typing its URL. Runs before anything else so a disabled page never
  // renders and its APIs never execute.
  if (isAdminPathDisabled(pathname)) {
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
  // Next requires literal values here, so this cannot be derived from the
  // section list - it is deliberately broad, and the per-section decision is
  // made above.
  matcher: ["/", "/admin/:path*", "/api/admin/:path*", "/marathahalli-fsd-oct-2026"],
};
