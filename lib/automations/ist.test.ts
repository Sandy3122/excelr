import { describe, expect, it } from "vitest";
import { formatIst, getIstParts, istWallClockToUtc } from "./ist";

describe("istWallClockToUtc", () => {
  it("converts 21 Aug 2026 12:00 IST to 06:30 UTC", () => {
    const d = istWallClockToUtc("2026-08-21T12:00:00");
    expect(d.toISOString()).toBe("2026-08-21T06:30:00.000Z");
  });

  it("converts 22 Aug 2026 08:50 IST to 03:20 UTC", () => {
    const d = istWallClockToUtc("2026-08-22T08:50:00");
    expect(d.toISOString()).toBe("2026-08-22T03:20:00.000Z");
  });

  it("converts 22 Aug 2026 08:45 IST to 03:15 UTC", () => {
    const d = istWallClockToUtc("2026-08-22T08:45:00");
    expect(d.toISOString()).toBe("2026-08-22T03:15:00.000Z");
  });
});

describe("getIstParts", () => {
  it("reads IST from a UTC instant", () => {
    const p = getIstParts(new Date("2026-08-21T06:30:00.000Z"));
    expect(p).toMatchObject({
      year: 2026,
      month: 8,
      day: 21,
      hour: 12,
      minute: 0,
    });
  });
});

describe("formatIst", () => {
  it("labels the scheduled reminder time", () => {
    expect(formatIst(istWallClockToUtc("2026-08-21T12:00:00"))).toBe(
      "2026-08-21 12:00 IST",
    );
  });
});
