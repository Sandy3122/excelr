import { describe, expect, it } from "vitest";
import {
  emailToDocId,
  phoneToDocId,
  REGISTRATION_EVENT,
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
  pageUrl: "https://placements.excelr.in/reg",
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
  it("stores a lowercase email key and event tag", () => {
    const record = toRegistrationRecord(sample, "2026-08-13T00:00:00.000Z");
    expect(record.emailLower).toBe("ada@example.com");
    expect(record.email).toBe("Ada@Example.com");
    expect(record.event).toBe(REGISTRATION_EVENT);
    expect(record.submittedAtIso).toBe("2026-08-13T00:00:00.000Z");
    expect(record.phone).toBe("+919876543210");
    expect(record.firstName).toBe("Ada");
  });
});
