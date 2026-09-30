import { describe, expect, it } from "vitest";
import {
  emailToDocId,
  phoneToDocId,
  registrationIdentityConflict,
  toRegistrationRecord,
} from "./registrations";
import type { RegistrationInput } from "@/lib/reg-schema";

const sample: RegistrationInput = {
  fullName: "Ada Lovelace",
  email: "Ada@Example.com",
  phone: "+919876543210",
  college: "ExcelR",
  qualification: "B.E / B.Tech",
  driveSlug: "reg",
  pageUrl: "https://placements.excelr.in/reg",
};

const DRIVE = {
  id: "drive-1",
  slug: "reg",
  eventKey: "java-fullstack-placement-drive",
};

describe("emailToDocId", () => {
  it("lowercases the email for the lookup document id", () => {
    expect(emailToDocId("Ada@Example.com")).toBe("ada@example.com");
  });
});

describe("registrationIdentityConflict", () => {
  const base = {
    phoneId: "919876543210",
    emailLower: "ada@example.com",
  };

  it("allows a new phone and email", () => {
    expect(
      registrationIdentityConflict({
        ...base,
        phoneExists: false,
        existingEmailLower: "",
        emailLookupPhoneId: null,
      }),
    ).toBeNull();
  });

  it("treats same phone + same email as a retry", () => {
    expect(
      registrationIdentityConflict({
        ...base,
        phoneExists: true,
        existingEmailLower: "ada@example.com",
        emailLookupPhoneId: "919876543210",
      }),
    ).toBeNull();
  });

  it("rejects same phone + different email", () => {
    expect(
      registrationIdentityConflict({
        ...base,
        phoneExists: true,
        existingEmailLower: "other@example.com",
        emailLookupPhoneId: null,
      }),
    ).toBe("phone");
  });

  it("rejects same email + different phone", () => {
    expect(
      registrationIdentityConflict({
        ...base,
        phoneExists: false,
        existingEmailLower: "",
        emailLookupPhoneId: "911111111111",
      }),
    ).toBe("email");
  });
});

describe("phoneToDocId", () => {
  it("strips a leading plus from E.164 numbers", () => {
    expect(phoneToDocId("+919876543210")).toBe("919876543210");
  });

  it("leaves already-bare ids unchanged", () => {
    expect(phoneToDocId("919876543210")).toBe("919876543210");
  });
});

describe("toRegistrationRecord", () => {
  it("stores a lowercase email key and the owning drive", () => {
    const record = toRegistrationRecord(
      sample,
      "2026-08-13T00:00:00.000Z",
      DRIVE,
    );
    expect(record.emailLower).toBe("ada@example.com");
    expect(record.email).toBe("Ada@Example.com");
    expect(record.event).toBe("java-fullstack-placement-drive");
    expect(record.placementDriveId).toBe("drive-1");
    expect(record.placementDriveSlug).toBe("reg");
    expect(record.submittedAtIso).toBe("2026-08-13T00:00:00.000Z");
    expect(record.phone).toBe("+919876543210");
    expect(record.firstName).toBe("Ada");
  });

  it("tags the record with whichever drive owns the page", () => {
    const record = toRegistrationRecord(sample, "2026-10-01T00:00:00.000Z", {
      id: "drive-2",
      slug: "marathahalli-fsd-oct-2026",
      eventKey: "marathahalli-fsd-oct-2026",
    });
    expect(record.placementDriveId).toBe("drive-2");
    expect(record.event).toBe("marathahalli-fsd-oct-2026");
  });
});
