import { describe, expect, it } from "vitest";
import { maskE164, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("normalizes a local Indian number to E.164 + Infobip format", () => {
    const r = normalizePhone("9876543210", "IN");
    expect(r).not.toBeNull();
    expect(r!.e164).toBe("+919876543210");
    expect(r!.infobip).toBe("919876543210"); // no leading +
  });

  it("accepts numbers already in E.164", () => {
    const r = normalizePhone("+91 98765 43210");
    expect(r!.e164).toBe("+919876543210");
  });

  it("rejects clearly invalid input", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });

  it("masks the number safely for logs", () => {
    const r = normalizePhone("9876543210", "IN");
    expect(r!.masked).toMatch(/^\+91X+10$/);
    expect(r!.masked).not.toContain("98765");
  });
});

describe("maskE164", () => {
  it("keeps only the prefix and last two digits", () => {
    expect(maskE164("+919876543210")).toBe("+91XXXXXXXX10");
  });
});
