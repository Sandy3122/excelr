import { afterEach, describe, expect, it } from "vitest";
import { extractAdminKey, isRegAdminAuthorized } from "./admin-auth";

const KEY = "test-admin-key-please-change";

afterEach(() => {
  delete process.env.REG_ADMIN_API_KEY;
});

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/reg", { headers });
}

describe("isRegAdminAuthorized", () => {
  it("rejects when the admin key is not configured", () => {
    expect(isRegAdminAuthorized(req({ authorization: `Bearer ${KEY}` }))).toBe(
      false,
    );
  });

  it("accepts a matching Bearer token", () => {
    process.env.REG_ADMIN_API_KEY = KEY;
    expect(isRegAdminAuthorized(req({ authorization: `Bearer ${KEY}` }))).toBe(
      true,
    );
  });

  it("accepts x-admin-key", () => {
    process.env.REG_ADMIN_API_KEY = KEY;
    expect(isRegAdminAuthorized(req({ "x-admin-key": KEY }))).toBe(true);
  });

  it("rejects a mismatched key", () => {
    process.env.REG_ADMIN_API_KEY = KEY;
    expect(
      isRegAdminAuthorized(req({ authorization: "Bearer wrong-key-value" })),
    ).toBe(false);
  });

  it("rejects a missing header", () => {
    process.env.REG_ADMIN_API_KEY = KEY;
    expect(isRegAdminAuthorized(req())).toBe(false);
  });
});

describe("extractAdminKey", () => {
  it("reads Bearer tokens case-insensitively", () => {
    expect(extractAdminKey(req({ authorization: `bearer ${KEY}` }))).toBe(KEY);
  });
});
