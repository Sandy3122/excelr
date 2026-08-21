import { describe, expect, it } from "vitest";
import {
  buildRegistrationWebhookPayload,
  registrationN8nWebhookUrl,
} from "./reg-webhook";

describe("buildRegistrationWebhookPayload", () => {
  it("includes lead fields and a first name", () => {
    expect(
      buildRegistrationWebhookPayload({
        id: "919876543210",
        submittedAt: "2026-08-21T07:00:00.000Z",
        data: {
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          phone: "+919876543210",
          college: "ExcelR",
          qualification: "B.E / B.Tech",
          pageUrl: "https://excelr-placement-drive.vercel.app/reg",
        },
      }),
    ).toMatchObject({
      source: "excelr-placement-drive",
      event: "java-fullstack-placement-drive",
      id: "919876543210",
      fullName: "Ada Lovelace",
      firstName: "Ada",
      email: "ada@example.com",
      phone: "+919876543210",
      college: "ExcelR",
      qualification: "B.E / B.Tech",
    });
  });
});

describe("registrationN8nWebhookUrl", () => {
  it("defaults to the ExcelR n8n webhook", () => {
    const prev = process.env.REGISTRATION_N8N_WEBHOOK_URL;
    delete process.env.REGISTRATION_N8N_WEBHOOK_URL;
    expect(registrationN8nWebhookUrl()).toBe(
      "https://excelr.app.n8n.cloud/webhook/java-fsd-registration",
    );
    if (prev === undefined) delete process.env.REGISTRATION_N8N_WEBHOOK_URL;
    else process.env.REGISTRATION_N8N_WEBHOOK_URL = prev;
  });
});
