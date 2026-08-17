import { afterEach, describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  passwordsMatch,
  verifyAdminSessionToken,
} from "./session";

const OLD = { ...process.env };

afterEach(() => {
  process.env = { ...OLD };
});

describe("admin session", () => {
  it("accepts a matching password", () => {
    expect(passwordsMatch("secret-pass!", "secret-pass!")).toBe(true);
    expect(passwordsMatch("secret-pass!", "other")).toBe(false);
  });

  it("round-trips a signed session token", () => {
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "session-secret-value";
    const token = createAdminSessionToken();
    expect(token).toBeTruthy();
    expect(verifyAdminSessionToken(token)).toBe(true);
    expect(verifyAdminSessionToken("nope")).toBe(false);
  });
});
