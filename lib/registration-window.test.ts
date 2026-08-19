import { describe, expect, it } from "vitest";
import {
  isRegistrationClosed,
  istDateAndTimeToUtcIso,
  toWindowStatus,
  utcIsoToIstDateTime,
} from "./registration-window";

describe("isRegistrationClosed", () => {
  it("stays open when no cutoff is set", () => {
    expect(isRegistrationClosed(null, new Date("2026-08-19T12:00:00.000Z"))).toBe(
      false,
    );
  });

  it("closes at the cutoff instant", () => {
    const closes = "2026-08-19T12:30:00.000Z";
    expect(isRegistrationClosed(closes, new Date("2026-08-19T12:29:59.000Z"))).toBe(
      false,
    );
    expect(isRegistrationClosed(closes, new Date("2026-08-19T12:30:00.000Z"))).toBe(
      true,
    );
  });
});

describe("IST schedule conversion", () => {
  it("stores 19 Aug 2026 18:00 IST as UTC", () => {
    expect(istDateAndTimeToUtcIso("2026-08-19", "18:00")).toBe(
      "2026-08-19T12:30:00.000Z",
    );
  });

  it("round-trips IST date and time", () => {
    expect(utcIsoToIstDateTime("2026-08-19T12:30:00.000Z")).toEqual({
      date: "2026-08-19",
      time: "18:00",
    });
  });
});

describe("toWindowStatus", () => {
  it("labels an open scheduled window", () => {
    const status = toWindowStatus(
      { closesAtIso: "2026-08-19T12:30:00.000Z", updatedAt: null },
      new Date("2026-08-19T10:00:00.000Z"),
    );
    expect(status.closed).toBe(false);
    expect(status.closesAtLabel).toBe("2026-08-19 18:00 IST");
  });
});
