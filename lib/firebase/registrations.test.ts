import { describe, expect, it } from "vitest";
import {
  phoneToDocId,
  REGISTRATION_EVENT,
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
  });
});
