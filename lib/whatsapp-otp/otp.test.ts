import { beforeAll, describe, expect, it } from "vitest";
import {
  generateOtp,
  hashOtp,
  isValidOtpFormat,
  verifyOtp,
} from "./otp";

beforeAll(() => {
  process.env.WHATSAPP_OTP_HASH_SECRET = "test-secret-please-change";
});

describe("generateOtp", () => {
  it("always returns exactly 6 digits", () => {
    for (let i = 0; i < 5000; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
    }
  });

  it("produces varied values (not constant)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateOtp());
    // 200 CSPRNG draws over 1e6 space should give many distinct values.
    expect(seen.size).toBeGreaterThan(150);
  });

  it("can produce leading-zero codes over many samples", () => {
    let sawLeadingZero = false;
    for (let i = 0; i < 20000 && !sawLeadingZero; i++) {
      if (generateOtp().startsWith("0")) sawLeadingZero = true;
    }
    expect(sawLeadingZero).toBe(true);
  });
});

describe("hashOtp", () => {
  it("never returns the plain OTP", () => {
    const otp = "123456";
    const hash = hashOtp(otp);
    expect(hash).not.toContain(otp);
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it("is deterministic for the same input", () => {
    expect(hashOtp("483921")).toBe(hashOtp("483921"));
  });

  it("differs for different inputs", () => {
    expect(hashOtp("000000")).not.toBe(hashOtp("000001"));
  });
});

describe("verifyOtp", () => {
  it("accepts the correct OTP", () => {
    const otp = "654321";
    expect(verifyOtp(otp, hashOtp(otp))).toBe(true);
  });

  it("rejects an incorrect OTP", () => {
    expect(verifyOtp("111111", hashOtp("222222"))).toBe(false);
  });

  it("rejects malformed stored hashes without throwing", () => {
    expect(verifyOtp("123456", "not-a-hash")).toBe(false);
    expect(verifyOtp("123456", "")).toBe(false);
  });
});

describe("isValidOtpFormat", () => {
  it("accepts 6-digit strings only", () => {
    expect(isValidOtpFormat("000000")).toBe(true);
    expect(isValidOtpFormat("12345")).toBe(false);
    expect(isValidOtpFormat("1234567")).toBe(false);
    expect(isValidOtpFormat("12a456")).toBe(false);
    expect(isValidOtpFormat(123456)).toBe(false);
    expect(isValidOtpFormat(null)).toBe(false);
  });
});
