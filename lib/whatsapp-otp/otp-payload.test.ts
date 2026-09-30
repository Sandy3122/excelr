import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOtp } from "./service";
import { __resetStoreForTests } from "./store";
import { MARATHAHALLI_OCT_2026_SEED } from "@/lib/drives/seed-configs";
import type { PlacementDrive } from "@/lib/drives/types";

/**
 * The exact Infobip request the October drive produces. Guards the wiring
 * between a drive document and the OTP send: template name, sender, language,
 * the URL-button parameter and the body placeholder.
 */
const DRIVE = {
  id: "drive-oct",
  ...MARATHAHALLI_OCT_2026_SEED,
  slug: "fsd-oct-2026",
  createdAt: null,
  updatedAt: null,
} as PlacementDrive;

beforeEach(() => {
  __resetStoreForTests();
  delete process.env.REDIS_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.INFOBIP_API_KEY = "test-key";
  process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
  process.env.INFOBIP_WHATSAPP_SENDER = "918050162541";
  process.env.WHATSAPP_OTP_HASH_SECRET = "test-secret";
});

afterEach(() => vi.restoreAllMocks());

describe("OTP send for the October drive", () => {
  it("posts the approved OTP template with the code in body and button", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ messageId: "m1" }] }), {
        status: 200,
      }),
    );

    const res = await requestOtp(DRIVE, "9876543210", null);
    expect(res.ok).toBe(true);
    expect(res.code).toBe("SENT");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.api.infobip.com/whatsapp/1/message/template");
    const body = JSON.parse((init as RequestInit).body as string);
    const msg = body.messages[0];

    expect(msg.from).toBe("918050162541");
    expect(msg.to).toBe("919876543210");
    expect(msg.content.templateName).toBe("fsd_website_otp_11082026");
    expect(msg.content.language).toBe("en_IN");

    const otp = msg.content.templateData.body.placeholders[0];
    expect(otp).toMatch(/^\d{6}$/);
    // The approved template's URL button carries the same code.
    expect(msg.content.templateData.buttons).toEqual([
      { type: "URL", parameter: otp },
    ]);
  });

  it("reports NOT_CONFIGURED instead of sending when no sender resolves", async () => {
    delete process.env.INFOBIP_WHATSAPP_SENDER;
    const fetchMock = vi.spyOn(global, "fetch");
    const res = await requestOtp(DRIVE, "9876543210", null);
    expect(res.code).toBe("NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("when the OTP store is unreachable", () => {
  it("reports STORE_UNAVAILABLE instead of throwing a bare 500", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ messageId: "m1" }] }), {
        status: 200,
      }),
    );
    const { getOtpStore } = await import("./store");
    vi.spyOn(getOtpStore(), "incrementCounter").mockRejectedValue(
      new Error("getaddrinfo ENOTFOUND redis.example.com"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await requestOtp(DRIVE, "9876543210", "1.2.3.4");
    expect(res.ok).toBe(false);
    expect(res.code).toBe("STORE_UNAVAILABLE");
  });
});
