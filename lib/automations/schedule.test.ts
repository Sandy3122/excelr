import { describe, expect, it } from "vitest";
import { istWallClockToUtc } from "./ist";
import {
  computeThingsToCarryDueAt,
  evaluateEligibility,
  isScheduledAutomationDue,
  isWhatsAppQuietHours,
  nextWhatsAppWindowStart,
} from "./schedule";

describe("isWhatsAppQuietHours", () => {
  it("is quiet at 1:00 AM IST", () => {
    expect(isWhatsAppQuietHours(istWallClockToUtc("2026-08-20T01:00:00"))).toBe(
      true,
    );
  });

  it("is quiet at 9:00 PM IST", () => {
    expect(isWhatsAppQuietHours(istWallClockToUtc("2026-08-20T21:00:00"))).toBe(
      true,
    );
  });

  it("is allowed at 8:00 AM and 8:59 PM IST", () => {
    expect(isWhatsAppQuietHours(istWallClockToUtc("2026-08-20T08:00:00"))).toBe(
      false,
    );
    expect(isWhatsAppQuietHours(istWallClockToUtc("2026-08-20T20:59:00"))).toBe(
      false,
    );
  });
});

describe("nextWhatsAppWindowStart", () => {
  it("holds overnight sends until 8:00 AM IST", () => {
    const due = nextWhatsAppWindowStart(
      istWallClockToUtc("2026-08-20T22:30:00"),
    );
    expect(due.toISOString()).toBe(
      istWallClockToUtc("2026-08-21T08:00:00").toISOString(),
    );
  });

  it("uses today 8:00 AM when still before the window", () => {
    const due = nextWhatsAppWindowStart(
      istWallClockToUtc("2026-08-20T02:00:00"),
    );
    expect(due.toISOString()).toBe(
      istWallClockToUtc("2026-08-20T08:00:00").toISOString(),
    );
  });
});

describe("computeThingsToCarryDueAt", () => {
  it("is one hour after registration during the day", () => {
    const registered = istWallClockToUtc("2026-08-20T11:00:00");
    const due = computeThingsToCarryDueAt(registered);
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-20T12:00:00").toISOString(),
    );
  });

  it("holds a 10:30 PM registration until 8:00 AM", () => {
    const registered = istWallClockToUtc("2026-08-20T21:30:00");
    const due = computeThingsToCarryDueAt(registered);
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-21T08:00:00").toISOString(),
    );
  });

  it("does not schedule after the 8:45 AM cutoff on event day", () => {
    expect(
      computeThingsToCarryDueAt(istWallClockToUtc("2026-08-22T08:50:00")),
    ).toBeNull();
    expect(
      computeThingsToCarryDueAt(istWallClockToUtc("2026-08-22T08:00:00")),
    ).toBeNull();
  });
});

describe("isScheduledAutomationDue", () => {
  it("day-before reminder is not due before 12:00 IST", () => {
    expect(
      isScheduledAutomationDue(
        "reminder_day_before",
        istWallClockToUtc("2026-08-21T11:59:00"),
      ),
    ).toBe(false);
    expect(
      isScheduledAutomationDue(
        "reminder_day_before",
        istWallClockToUtc("2026-08-21T12:00:00"),
      ),
    ).toBe(true);
  });

  it("event-day reminder is due at 8:50 AM IST", () => {
    expect(
      isScheduledAutomationDue(
        "reminder_event_day",
        istWallClockToUtc("2026-08-22T08:49:00"),
      ),
    ).toBe(false);
    expect(
      isScheduledAutomationDue(
        "reminder_event_day",
        istWallClockToUtc("2026-08-22T08:50:00"),
      ),
    ).toBe(true);
  });
});

describe("evaluateEligibility", () => {
  it("does not resend welcome when status is missing (legacy leads)", () => {
    const result = evaluateEligibility({
      kind: "welcome",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-20T10:00:00"),
    });
    expect(result).toEqual({ ok: false, reason: "already_sent" });
  });

  it("sends welcome when the channel is still pending", () => {
    const result = evaluateEligibility({
      kind: "welcome",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-20T10:00:00"),
      snapshot: { status: "pending" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("skips already sent messages even with force off", () => {
    const result = evaluateEligibility({
      kind: "reminder_day_before",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-21T12:01:00"),
      snapshot: { status: "sent" },
    });
    expect(result).toEqual({ ok: false, reason: "already_sent" });
  });

  it("does not auto-retry failed unless asked", () => {
    const result = evaluateEligibility({
      kind: "reminder_event_day",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-22T08:51:00"),
      snapshot: { status: "failed" },
    });
    expect(result).toEqual({ ok: false, reason: "already_sent" });
  });

  it("retries failed when retryFailed is set", () => {
    const result = evaluateEligibility({
      kind: "reminder_event_day",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-22T08:51:00"),
      snapshot: { status: "failed" },
      retryFailed: true,
    });
    expect(result).toEqual({ ok: true });
  });

  it("admin force bypasses the scheduled window", () => {
    const result = evaluateEligibility({
      kind: "reminder_day_before",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-20T10:00:00"),
      force: true,
    });
    expect(result).toEqual({ ok: true });
  });
});
