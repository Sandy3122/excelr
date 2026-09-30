import { describe, expect, it } from "vitest";
import {
  buildRegistrationWebhookPayload,
  registrationWebhookUrl,
} from "./reg-webhook";
import type { PlacementDrive } from "./drives/types";

const DRIVE = {
  id: "drive-1",
  slug: "reg",
  name: "Java Full Stack Placement Drive",
  eventKey: "java-fullstack-placement-drive",
  webhookUrl: "https://excelr.app.n8n.cloud/webhook/java-fsd-registration",
} as PlacementDrive;

describe("buildRegistrationWebhookPayload", () => {
  it("includes lead fields, a first name and the owning drive", () => {
    expect(
      buildRegistrationWebhookPayload({
        drive: DRIVE,
        id: "919876543210",
        submittedAt: "2026-08-21T07:00:00.000Z",
        data: {
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          phone: "+919876543210",
          college: "ExcelR",
          qualification: "B.E / B.Tech",
          driveSlug: "reg",
          pageUrl: "https://excelr-placement-drive.vercel.app/reg",
        },
      }),
    ).toMatchObject({
      source: "excelr-placement-drive",
      event: "java-fullstack-placement-drive",
      placementDriveId: "drive-1",
      placementDriveSlug: "reg",
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

describe("registrationWebhookUrl", () => {
  it("comes from the drive, not the environment", () => {
    expect(registrationWebhookUrl(DRIVE)).toBe(
      "https://excelr.app.n8n.cloud/webhook/java-fsd-registration",
    );
  });

  it("is disabled when the drive leaves it empty", () => {
    expect(registrationWebhookUrl({ ...DRIVE, webhookUrl: "  " })).toBe("");
  });
});
