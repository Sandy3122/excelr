import { describe, expect, it } from "vitest";
import {
  hasEventPassed,
  isRegistrationClosed,
  istDateAndTimeToUtcIso,
  toWindowStatus,
  utcIsoToIstDateTime,
} from "./registration-window";
import { istWallClockToUtc } from "@/lib/automations/ist";

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

describe("hasEventPassed", () => {
  const at = (ist: string) => istWallClockToUtc(ist);

  it("stays open on the morning of the event", () => {
    expect(hasEventPassed("2026-10-09", at("2026-10-09T07:00:00"))).toBe(false);
  });

  it("stays open right up to the end of the event day", () => {
    expect(hasEventPassed("2026-10-09", at("2026-10-09T23:59:00"))).toBe(false);
  });

  it("closes once the event day is over", () => {
    expect(hasEventPassed("2026-10-09", at("2026-10-10T00:30:00"))).toBe(true);
  });

  it("closes a long-finished drive", () => {
    expect(hasEventPassed("2026-08-22", at("2026-09-30T10:00:00"))).toBe(true);
  });

  it("never closes a drive with no event day set", () => {
    expect(hasEventPassed(null, at("2030-01-01T00:00:00"))).toBe(false);
  });
});

describe("toWindowStatus", () => {
  const now = istWallClockToUtc("2026-09-30T10:00:00");

  it("closes a finished drive even with no close time scheduled", () => {
    const status = toWindowStatus(
      { closesAtIso: null, updatedAt: null, eventDayIstDate: "2026-08-22" },
      now,
    );
    expect(status.closed).toBe(true);
    expect(status.closedReason).toBe("event_passed");
  });

  it("leaves an upcoming drive open", () => {
    const status = toWindowStatus(
      { closesAtIso: null, updatedAt: null, eventDayIstDate: "2026-10-09" },
      now,
    );
    expect(status.closed).toBe(false);
    expect(status.closedReason).toBeNull();
  });

  it("an explicit close time still wins for an upcoming drive", () => {
    const status = toWindowStatus(
      {
        closesAtIso: istWallClockToUtc("2026-09-29T18:00:00").toISOString(),
        updatedAt: null,
        eventDayIstDate: "2026-10-09",
      },
      now,
    );
    expect(status.closed).toBe(true);
    expect(status.closedReason).toBe("scheduled");
  });
});
