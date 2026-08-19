import { NextResponse } from "next/server";
import { requestOtp } from "@/lib/whatsapp-otp/service";
import {
  SEND_MESSAGES,
  getClientIp,
  sendStatus,
} from "@/lib/whatsapp-otp/http";
import { REGISTRATION_CLOSED_MESSAGE } from "@/lib/registration-window";
import { getRegistrationWindowStatus } from "@/lib/registration-window-store";

// crypto + fetch to Infobip need the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const windowStatus = await getRegistrationWindowStatus();
  if (windowStatus.closed) {
    return NextResponse.json(
      { success: false, message: REGISTRATION_CLOSED_MESSAGE },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: SEND_MESSAGES.INVALID_PHONE },
      { status: 400 },
    );
  }

  const phoneNumber =
    body && typeof body === "object" && "phoneNumber" in body
      ? (body as { phoneNumber?: unknown }).phoneNumber
      : undefined;

  if (typeof phoneNumber !== "string") {
    return NextResponse.json(
      { success: false, message: SEND_MESSAGES.INVALID_PHONE },
      { status: 400 },
    );
  }

  const result = await requestOtp(phoneNumber, getClientIp(req));

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
