import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNamedTemplatePayload,
  buildTemplatePayload,
  sendNamedWhatsAppTemplate,
  sendWhatsAppOtp,
} from "./infobip";
import type { InfobipSendConfig } from "./config";

/** Account credentials plus the drive's sender and language. */
const baseCfg: InfobipSendConfig = {
  baseUrl: "https://example.api.infobip.com",
  apiKey: "test-api-key",
  sender: "918050162541",
  language: "en_IN",
};

const OTP_TEMPLATE = "fsd_website_otp_11082026";
const CONFIRMATION_TEMPLATE = "fsd_placement_drive_confirmation_message_a";

describe("buildTemplatePayload", () => {
  it("matches fsd_website_otp_11082026: OTP in body + URL button", () => {
    const payload = buildTemplatePayload(
      baseCfg,
      "919876543210",
      "483921",
      OTP_TEMPLATE,
      "otp",
    );
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
    const payload = buildTemplatePayload(
      baseCfg,
      "919876543210",
      "483921",
      OTP_TEMPLATE,
      "verify",
    );
    expect(payload.messages[0].content.templateData.buttons).toEqual([
      { type: "URL", parameter: "verify" },
    ]);
  });
});

describe("buildNamedTemplatePayload", () => {
  it("matches reminder templates: name placeholder, no buttons", () => {
    const payload = buildNamedTemplatePayload(
      baseCfg,
      "919876543210",
      "Arjun",
      "fsd_placement_drive_reminder_message_21aug_a",
    );
    expect(payload).toEqual({
      messages: [
        {
          from: "918050162541",
          to: "919876543210",
          content: {
            templateName: "fsd_placement_drive_reminder_message_21aug_a",
            templateData: {
              body: { placeholders: ["Arjun"] },
            },
            language: "en_IN",
          },
        },
      ],
    });
  });
});

describe("confirmation template payload", () => {
  it("matches the drive's confirmation template: name placeholder, no buttons", () => {
    const payload = buildNamedTemplatePayload(
      baseCfg,
      "919876543210",
      "Sandeep",
      CONFIRMATION_TEMPLATE,
    );
    expect(payload).toEqual({
      messages: [
        {
          from: "918050162541",
          to: "919876543210",
          content: {
            templateName: "fsd_placement_drive_confirmation_message_a",
            templateData: {
              body: { placeholders: ["Sandeep"] },
            },
            language: "en_IN",
          },
        },
      ],
    });
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

    const res = await sendWhatsAppOtp(
      baseCfg,
      "919876543210",
      "483921",
      OTP_TEMPLATE,
      "otp",
    );
    expect(res.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.api.infobip.com/whatsapp/1/message/template");
    const headers = (init as RequestInit).headers as Record<string, string>;
    // Credentials come from the resolved config, not from the environment.
    expect(headers.Authorization).toBe("App test-api-key");

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

    const res = await sendWhatsAppOtp(
      baseCfg,
      "917989175345",
      "483921",
      OTP_TEMPLATE,
      "otp",
    );
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

    const res = await sendWhatsAppOtp(
      baseCfg,
      "919876543210",
      "483921",
      OTP_TEMPLATE,
      "otp",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("WHATSAPP_SEND_FAILED");
  });

  it("sends confirmation template without buttons", async () => {
    process.env.INFOBIP_API_KEY = "secret-key";
    process.env.INFOBIP_BASE_URL = "https://example.api.infobip.com";
    process.env.INFOBIP_WHATSAPP_SENDER = "918050162541";
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ messageId: "conf-1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await sendNamedWhatsAppTemplate(
      baseCfg,
      "919876543210",
      "Sandeep",
      CONFIRMATION_TEMPLATE,
    );
    expect(res.ok).toBe(true);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[0].content.templateName).toBe(
      "fsd_placement_drive_confirmation_message_a",
    );
    expect(body.messages[0].content.templateData.body.placeholders).toEqual(["Sandeep"]);
    expect(body.messages[0].content.templateData.buttons).toBeUndefined();
  });
});
