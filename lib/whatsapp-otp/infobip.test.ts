import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTemplatePayload, sendWhatsAppOtp } from "./infobip";
import type { InfobipConfig } from "./config";

const baseCfg: InfobipConfig = {
  baseUrl: "https://example.api.infobip.com",
  apiKey: "test-api-key",
  sender: "918050162541",
  templateName: "fsd_website_otp_11082026",
  language: "en_IN",
  urlButtonParam: "otp",
};

describe("buildTemplatePayload", () => {
  it("matches fsd_website_otp_11082026: OTP in body + URL button", () => {
    const payload = buildTemplatePayload(baseCfg, "919876543210", "483921");
    expect(payload).toEqual({
      messages: [
        {
          from: "918050162541",
          to: "919876543210",
          content: {
            templateName: "fsd_website_otp_11082026",
            templateData: {
              body: { placeholders: ["483921"] },
              buttons: [{ type: "URL", parameter: "483921" }],
            },
            language: "en_IN",
          },
        },
      ],
    });
  });

  it("sends a literal button suffix when configured with a fixed value", () => {
    const cfg = { ...baseCfg, urlButtonParam: "verify" };
    const payload = buildTemplatePayload(cfg, "919876543210", "483921");
    expect(payload.messages[0].content.templateData.buttons).toEqual([
      { type: "URL", parameter: "verify" },
    ]);
  });
});

describe("sendWhatsAppOtp", () => {
  const OLD = { ...process.env };
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD };
  });

  it("calls the correct endpoint with App auth and never logs the OTP", async () => {
    process.env.INFOBIP_API_KEY = "secret-key";
    process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
    process.env.INFOBIP_WHATSAPP_SENDER = "918050162541";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ messages: [{ messageId: "abc" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await sendWhatsAppOtp("919876543210", "483921");
    expect(res.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.api.infobip.com/whatsapp/1/message/template");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("App secret-key");

    // The OTP must never be logged.
    for (const call of errSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("483921");
    }
  });

  it("fails when Infobip accepts (HTTP 200) but REJECTS the message", async () => {
    process.env.INFOBIP_API_KEY = "secret-key";
    process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            {
              messageId: "abc",
              status: {
                groupId: 5,
                groupName: "REJECTED",
                name: "REJECTED_SOURCE",
                description: "Invalid Source address",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await sendWhatsAppOtp("917989175345", "483921");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("WHATSAPP_SEND_FAILED");
  });

  it("returns a generic error (no provider internals) on HTTP failure", async () => {
    process.env.INFOBIP_API_KEY = "secret-key";
    process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ requestError: {} }), { status: 401 }),
    );

    const res = await sendWhatsAppOtp("919876543210", "483921");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("WHATSAPP_SEND_FAILED");
  });
});
