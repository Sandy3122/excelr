import { NextResponse } from "next/server";
import { requestOtp } from "@/lib/whatsapp-otp/service";
import {
  SEND_MESSAGES,
  getClientIp,
  sendStatus,
} from "@/lib/whatsapp-otp/http";
import { REGISTRATION_CLOSED_MESSAGE } from "@/lib/registration-window";
import { driveWindowStatus } from "@/lib/registration-window-store";
import { resolvePublicDrive } from "@/lib/drives/request";

// crypto + fetch to Infobip need the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: SEND_MESSAGES.INVALID_PHONE },
      { status: 400 },
    );
  }

  const fields = (body ?? {}) as { phoneNumber?: unknown; driveSlug?: unknown };

  // Resolve the campaign before anything else — limits, templates and store
  // keys all belong to it.
  const resolved = await resolvePublicDrive(fields.driveSlug);
  if (!resolved.ok) {
    return NextResponse.json(
      { success: false, message: resolved.error },
      { status: resolved.status },
    );
  }

  if (driveWindowStatus(resolved.drive).closed) {
    return NextResponse.json(
      { success: false, message: REGISTRATION_CLOSED_MESSAGE },
      { status: 403 },
    );
  }

  if (typeof fields.phoneNumber !== "string") {
    return NextResponse.json(
      { success: false, message: SEND_MESSAGES.INVALID_PHONE },
      { status: 400 },
    );
  }

  const result = await requestOtp(
    resolved.drive,
    fields.phoneNumber,
    getClientIp(req),
  );

  const payload: {
    success: boolean;
    message: string;
    phoneNumber?: string;
    maskedPhone?: string;
    retryAfterSeconds?: number;
  } = {
    success: result.ok,
    message: SEND_MESSAGES[result.code],
  };
  // Echo the normalized phone so the client keeps a consistent value, but only
  // ever the masked form for display. Never return the OTP.
  if (result.phone) {
    payload.phoneNumber = result.phone.e164;
    payload.maskedPhone = result.phone.masked;
  }
  if (result.retryAfterSeconds) {
    payload.retryAfterSeconds = result.retryAfterSeconds;
  }

  return NextResponse.json(payload, { status: sendStatus(result.code) });
}
