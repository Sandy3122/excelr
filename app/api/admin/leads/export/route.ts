import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { listAllRegistrations } from "@/lib/firebase/registrations";
import { toCsv } from "@/lib/csv";
import { AUTOMATION_KINDS } from "@/lib/automations/types";
import { getAutomation } from "@/lib/automations/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const leads = await listAllRegistrations();
    const extraHeaders: string[] = [];
    for (const kind of AUTOMATION_KINDS) {
      const def = getAutomation(kind);
      for (const channel of def.channels) {
        extraHeaders.push(`${kind}_${channel}`);
      }
    }

    const headers = [
      "id",
      "firstName",
      "fullName",
      "email",
      "phone",
      "college",
      "qualification",
      "pageUrl",
      "submittedAt",
      ...extraHeaders,
    ];

    const rows = leads.map((r) => {
      const base = [
        r.id,
        r.firstName,
        r.fullName,
        r.email,
        r.phone,
        r.college,
        r.qualification,
        r.pageUrl,
        r.submittedAt || r.submittedAtIso || "",
      ];
      const statuses: string[] = [];
      for (const kind of AUTOMATION_KINDS) {
        const def = getAutomation(kind);
        for (const channel of def.channels) {
          const status =
            r.messages?.[kind]?.[channel]?.status ||
            (kind === "welcome" ? "legacy" : "pending");
          statuses.push(status);
        }
      }
      return [...base, ...statuses];
    });

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="placement-drive-leads.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin/leads/export] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not export registrations." },
      { status: 500 },
    );
  }
}
