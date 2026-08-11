import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmOtp,
  consumePhoneVerification,
  isPhoneVerified,
  requestOtp,
} from "./service";
import { __resetStoreForTests } from "./store";

const PHONE = "9876543210"; // Indian local; normalizes to +919876543210

/**
 * Mock Infobip so no real WhatsApp message is ever sent, and capture the OTP
 * from the outbound request body so tests can verify against it.
 */
function mockInfobip() {
  const captured = { otp: "" };
  vi.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String((init as RequestInit).body));
    captured.otp = body.messages[0].content.templateData.body.placeholders[0];
    return new Response(JSON.stringify({ messages: [{ messageId: "x" }] }), {
      status: 200,
    });
  });
  return captured;
}

beforeEach(() => {
  __resetStoreForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.INFOBIP_API_KEY = "secret-key";
  process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
  process.env.WHATSAPP_OTP_HASH_SECRET = "test-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestOtp", () => {
  it("sends an OTP and never returns it in the result", async () => {
    mockInfobip();
    const res = await requestOtp(PHONE, null);
    expect(res.ok).toBe(true);
    expect(res.code).toBe("SENT");
    expect(res.phone?.e164).toBe("+919876543210");
    expect(JSON.stringify(res)).not.toMatch(/"otp"/);
  });

  it("rejects an invalid phone number", async () => {
    const res = await requestOtp("123", null);
    expect(res.code).toBe("INVALID_PHONE");
  });

  it("reports NOT_CONFIGURED when Infobip env is missing", async () => {
    delete process.env.INFOBIP_API_KEY;
    delete process.env.INFOBIP_BASE_URL;
    const res = await requestOtp(PHONE, null);
    expect(res.code).toBe("NOT_CONFIGURED");
  });

  it("enforces the resend cooldown", async () => {
    mockInfobip();
    const t = 1_000_000;
    const first = await requestOtp(PHONE, null, t);
    expect(first.ok).toBe(true);
    const second = await requestOtp(PHONE, null, t + 5_000); // 5s later
    expect(second.code).toBe("COOLDOWN");
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("confirmOtp", () => {
  it("verifies a correct OTP and writes a one-time verified marker", async () => {
    const cap = mockInfobip();
    await requestOtp(PHONE, null);

    const res = await confirmOtp(PHONE, cap.otp);
    expect(res.ok).toBe(true);
    expect(res.code).toBe("VERIFIED");

    // Marker is present, and can be consumed exactly once.
    expect((await isPhoneVerified(PHONE)).verified).toBe(true);
    expect((await consumePhoneVerification(PHONE)).verified).toBe(true);
    expect((await consumePhoneVerification(PHONE)).verified).toBe(false);
  });

  it("rejects an incorrect OTP and counts down attempts", async () => {
    const cap = mockInfobip();
    await requestOtp(PHONE, null);
    const wrong = cap.otp === "000000" ? "000001" : "000000";

    const res = await confirmOtp(PHONE, wrong);
    expect(res.code).toBe("INCORRECT");
    expect(res.attemptsRemaining).toBe(4);
  });

  it("invalidates the OTP after the maximum attempts", async () => {
    const cap = mockInfobip();
    await requestOtp(PHONE, null);
    const wrong = cap.otp === "000000" ? "000001" : "000000";

    let last;
    for (let i = 0; i < 5; i++) last = await confirmOtp(PHONE, wrong);
    expect(last!.code).toBe("TOO_MANY_ATTEMPTS");

    // Even the correct OTP no longer works — record was destroyed.
    const after = await confirmOtp(PHONE, cap.otp);
    expect(after.code).toBe("NO_OTP");
  });

  it("rejects an expired OTP", async () => {
    const cap = mockInfobip();
    const t = 2_000_000;
    await requestOtp(PHONE, null, t);
    const res = await confirmOtp(PHONE, cap.otp, t + 301_000); // > 300s
    expect(res.code).toBe("EXPIRED");
  });

  it("prevents OTP reuse after a successful verification", async () => {
    const cap = mockInfobip();
    await requestOtp(PHONE, null);
    expect((await confirmOtp(PHONE, cap.otp)).ok).toBe(true);
    // Second use of the same code fails — it was single-use.
    expect((await confirmOtp(PHONE, cap.otp)).code).toBe("NO_OTP");
  });

  it("rejects malformed OTP input", async () => {
    const res = await confirmOtp(PHONE, "12ab");
    expect(res.code).toBe("INVALID_FORMAT");
  });

  it("returns NO_OTP when nothing was requested", async () => {
    const res = await confirmOtp(PHONE, "123456");
    expect(res.code).toBe("NO_OTP");
  });
});

describe("resend invalidates the previous OTP", () => {
  it("makes the old code unusable after a resend", async () => {
    const cap = mockInfobip();
    const t = 3_000_000;
    await requestOtp(PHONE, null, t);
    const firstOtp = cap.otp;
    // Resend after the cooldown window.
    await requestOtp(PHONE, null, t + 61_000);
    const secondOtp = cap.otp;

    // Old OTP should no longer verify (unless the CSPRNG produced the same
    // 6 digits, which we guard against).
    if (firstOtp !== secondOtp) {
      expect((await confirmOtp(PHONE, firstOtp, t + 62_000)).code).toBe(
        "INCORRECT",
      );
    }
    expect((await confirmOtp(PHONE, secondOtp, t + 62_000)).ok).toBe(true);
  });
});
