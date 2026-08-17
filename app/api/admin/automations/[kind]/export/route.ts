import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/authorize";
import { hasFirebaseAdminConfig } from "@/lib/firebase/config";
import { isAutomationKind, getAutomation } from "@/lib/automations/catalog";
import { listAllRegistrations } from "@/lib/firebase/registrations";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: { kind: string } },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!isAutomationKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown automation." }, { status: 404 });
  }
  const kind = params.kind;
  if (!hasFirebaseAdminConfig()) {
    return NextResponse.json(
      { ok: false, error: "Registration storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const def = getAutomation(kind);
    const leads = await listAllRegistrations();
    const headers = [
      "id",
      "firstName",
      "fullName",
      "email",
      "phone",
      ...def.channels.flatMap((ch) => [
        `${ch}_status`,
        `${ch}_sentAt`,
        `${ch}_error`,
        `${ch}_providerMessageId`,
      ]),
    ];
    const rows = leads.map((r) => {
      const base = [r.id, r.firstName, r.fullName, r.email, r.phone];
      const rest = def.channels.flatMap((ch) => {
        const d = r.messages?.[kind]?.[ch];
        const status =
          d?.status || (kind === "welcome" ? "legacy" : "pending");
        return [
          status,
          d?.sentAt || "",
          d?.error || d?.skippedReason || "",
          d?.providerMessageId || "",
        ];
      });
      return [...base, ...rest];
    });

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${kind}-delivery.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin/automations/export] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not export delivery report." },
      { status: 500 },
    );
  }
}
