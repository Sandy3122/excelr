import { NextResponse } from "next/server";
import { confirmOtp } from "@/lib/whatsapp-otp/service";
import { VERIFY_MESSAGES, verifyStatus } from "@/lib/whatsapp-otp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: VERIFY_MESSAGES.INVALID_FORMAT },
      { status: 400 },
    );
  }

  const obj = (body ?? {}) as { phoneNumber?: unknown; otp?: unknown };
  if (typeof obj.phoneNumber !== "string") {
    return NextResponse.json(
      { success: false, message: VERIFY_MESSAGES.INVALID_PHONE },
      { status: 400 },
    );
  }

  const result = await confirmOtp(obj.phoneNumber, obj.otp);

  return NextResponse.json(
    {
      success: result.ok,
      verified: result.ok,
      message: VERIFY_MESSAGES[result.code],
      ...(result.attemptsRemaining !== undefined
        ? { attemptsRemaining: result.attemptsRemaining }
        : {}),
    },
    { status: verifyStatus(result.code) },
  );
}
