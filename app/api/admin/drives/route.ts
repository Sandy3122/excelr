import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/drive-context";
import {
  DriveSlugTakenError,
  createDrive,
  listDrives,
} from "@/lib/drives/store";
import {
  DRIVE_SLUG_RE,
  defaultDriveConfig,
  toDriveSummary,
} from "@/lib/drives/types";
import { driveWhatsAppIssues } from "@/lib/drives/whatsapp";
import { whatsappAccountDefaults } from "@/lib/whatsapp-otp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(DRIVE_SLUG_RE, "Use lowercase letters, numbers and dashes"),
  eventDayIstDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

/** All drives, for the dashboard selector and the drives list. */
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const includeArchived =
    new URL(req.url).searchParams.get("includeArchived") === "1";

  try {
    const drives = await listDrives({ includeArchived });
    return NextResponse.json({
      ok: true,
      drives: drives.map((drive) => ({
        ...toDriveSummary(drive),
        issues: driveWhatsAppIssues(drive),
      })),
    });
  } catch (err) {
    console.error("[admin/drives] list failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load placement drives." },
      { status: 500 },
    );
  }
}

/**
 * Create a drive. Only name, slug and event day are taken here — everything
 * else starts from the shared defaults and is edited on the drive page.
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Check the form and try again.",
      },
      { status: 400 },
    );
  }

  try {
    const drive = await createDrive(
      defaultDriveConfig({
        name: parsed.data.name,
        slug: parsed.data.slug,
        eventDayIstDate: parsed.data.eventDayIstDate ?? null,
        // Start from the account's approved templates so a new campaign is
        // usable immediately; each one stays editable on the drive page.
        automationTemplates: whatsappAccountDefaults().automationTemplates,
      }),
    );
    return NextResponse.json({ ok: true, drive });
  } catch (err) {
    if (err instanceof DriveSlugTakenError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error("[admin/drives] create failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not create the placement drive." },
      { status: 500 },
    );
  }
}
