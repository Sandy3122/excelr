import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HOLD_ADMIN_SETTINGS } from "@/lib/admin/settings-feature";

export function middleware(request: NextRequest) {
  if (!HOLD_ADMIN_SETTINGS) return NextResponse.next();
  return new NextResponse("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/admin/settings", "/api/admin/registration-window"],
};
