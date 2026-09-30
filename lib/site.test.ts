import { describe, expect, it } from "vitest";
import { DEFAULT_LANDING_PATH, redirectTargetFor } from "./site";

describe("redirectTargetFor", () => {
  it("sends the bare domain to the default campaign", () => {
    expect(redirectTargetFor("/")).toBe(DEFAULT_LANDING_PATH);
  });

  it("forwards a retired campaign path to its replacement", () => {
    expect(redirectTargetFor("/marathahalli-fsd-oct-2026")).toBe(
      "/fsd-oct-2026",
    );
  });

  it("ignores a trailing slash on a retired path", () => {
    expect(redirectTargetFor("/marathahalli-fsd-oct-2026/")).toBe(
      "/fsd-oct-2026",
    );
  });

  it("leaves the current campaign alone", () => {
    expect(redirectTargetFor("/fsd-oct-2026")).toBeNull();
  });

  it("leaves unrelated paths alone", () => {
    expect(redirectTargetFor("/admin/leads")).toBeNull();
    expect(redirectTargetFor("/reg")).toBeNull();
  });
});
