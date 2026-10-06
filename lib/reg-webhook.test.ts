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

describe("webhook location fields", () => {
  const base = {
    drive: { ...DRIVE, venueLatitude: 12.9166, venueLongitude: 77.6101 },
    id: "1",
    submittedAt: "2026-08-21T07:00:00.000Z",
    data: {
      fullName: "Ada",
      email: "a@b.co",
      phone: "+919876543210",
      college: "X",
      qualification: "B.E / B.Tech",
      driveSlug: "reg",
      pageUrl: "https://x.test/reg",
    },
  };

  it("includes coordinates, source and distance", () => {
    const payload = buildRegistrationWebhookPayload({
      ...base,
      geo: {
        source: "device",
        accuracyMeters: 20,
        ip: "1.2.3.4",
        city: "Kakinada",
        region: "Andhra Pradesh",
        country: "IN",
        postalCode: null,
        latitude: 16.9891,
        longitude: 82.2475,
        timezone: null,
      },
    });
    expect(payload).toMatchObject({
      location: "Kakinada, Andhra Pradesh, IN",
      latitude: 16.9891,
      longitude: 82.2475,
      locationSource: "gps",
      locationAccuracyMeters: 20,
    });
    expect(payload.distanceFromVenueKm).toBeGreaterThan(500);
    expect(payload.mapUrl).toContain("16.9891,82.2475");
  });

  it("sends nulls when the location is unknown", () => {
    expect(buildRegistrationWebhookPayload(base)).toMatchObject({
      location: null,
      latitude: null,
      locationSource: null,
      distanceFromVenueKm: null,
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
