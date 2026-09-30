import { NextResponse } from "next/server";
import { requireAdminDrive } from "@/lib/admin/drive-context";
import { isAutomationKind } from "@/lib/automations/catalog";
import { listAllRegistrations } from "@/lib/firebase/registrations";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: { kind: string } },
) {
  if (!isAutomationKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown automation." }, { status: 404 });
  }
  const kind = params.kind;

  const ctx = await requireAdminDrive(req);
  if (!ctx.ok) return ctx.response;
  const drive = ctx.drive;

  try {
    const channels = drive.automations[kind].channels;
    const leads = await listAllRegistrations(drive.id);
    const headers = [
      "id",
      "firstName",
      "fullName",
      "email",
      "phone",
      ...channels.flatMap((ch) => [
        `${ch}_status`,
        `${ch}_sentAt`,
        `${ch}_error`,
        `${ch}_providerMessageId`,
      ]),
    ];
    const rows = leads.map((r) => {
      const base = [r.id, r.firstName, r.fullName, r.email, r.phone];
      const rest = channels.flatMap((ch) => {
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
        "Content-Disposition": `attachment; filename="${drive.slug}-${kind}-delivery.csv"`,
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
