import { describe, expect, it } from "vitest";
import { istWallClockToUtc } from "./ist";
import {
  computeReminderDayBeforeDueAt,
  computeReminderEventDayDueAt,
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

  it("uses a 10 minute delay after noon on 21 Aug", () => {
    const due = computeThingsToCarryDueAt(istWallClockToUtc("2026-08-21T16:00:00"));
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-21T16:10:00").toISOString(),
    );
  });

  it("uses a 10 minute delay on event morning before the cutoff", () => {
    const due = computeThingsToCarryDueAt(istWallClockToUtc("2026-08-22T08:00:00"));
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-22T08:10:00").toISOString(),
    );
  });

  it("bypasses quiet hours for an early event-day signup", () => {
    const due = computeThingsToCarryDueAt(istWallClockToUtc("2026-08-22T07:30:00"));
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-22T07:40:00").toISOString(),
    );
  });

  it("uses a 5 minute last-chance delay after the 8:45 AM cutoff", () => {
    const due = computeThingsToCarryDueAt(istWallClockToUtc("2026-08-22T10:00:00"));
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-22T10:05:00").toISOString(),
    );
  });
});

describe("late reminder catch-up", () => {
  it("sends the day-before reminder 15 minutes after a post-noon 21 Aug signup", () => {
    const due = computeReminderDayBeforeDueAt(
      istWallClockToUtc("2026-08-21T16:00:00"),
    );
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-21T16:15:00").toISOString(),
    );
  });

  it("does not send the day-before reminder to event-day signups", () => {
    expect(
      computeReminderDayBeforeDueAt(istWallClockToUtc("2026-08-22T10:00:00")),
    ).toBeNull();
  });

  it("sends the event-day reminder 10 minutes after an after-8:50 signup", () => {
    const due = computeReminderEventDayDueAt(
      istWallClockToUtc("2026-08-22T10:00:00"),
    );
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-22T10:10:00").toISOString(),
    );
  });

  it("keeps 8:50 AM for people who registered before that time", () => {
    const due = computeReminderEventDayDueAt(
      istWallClockToUtc("2026-08-21T16:00:00"),
    );
    expect(due?.toISOString()).toBe(
      istWallClockToUtc("2026-08-22T08:50:00").toISOString(),
    );
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
    expect(
      isScheduledAutomationDue(
        "reminder_day_before",
        istWallClockToUtc("2026-08-22T10:00:00"),
      ),
    ).toBe(false);
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

  it("does not retry failed messages with force alone", () => {
    const result = evaluateEligibility({
      kind: "reminder_event_day",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-22T08:51:00"),
      snapshot: { status: "failed" },
      force: true,
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

  it("does not resend a delivered message with force alone", () => {
    const result = evaluateEligibility({
      kind: "welcome",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-20T10:00:00"),
      snapshot: { status: "sent" },
      force: true,
    });
    expect(result).toEqual({ ok: false, reason: "already_sent" });
  });

  it("resends a delivered message when resend is set", () => {
    const result = evaluateEligibility({
      kind: "welcome",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-20T10:00:00"),
      snapshot: { status: "sent" },
      resend: true,
    });
    expect(result).toEqual({ ok: true });
  });

  it("resends a legacy welcome when asked", () => {
    const result = evaluateEligibility({
      kind: "welcome",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-20T10:00:00"),
      resend: true,
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

  it("skips the day-before reminder for an event-day registration", () => {
    const result = evaluateEligibility({
      kind: "reminder_day_before",
      channel: "whatsapp",
      now: istWallClockToUtc("2026-08-22T10:20:00"),
      registeredAt: istWallClockToUtc("2026-08-22T10:00:00"),
      snapshot: { status: "pending" },
    });
    expect(result).toEqual({ ok: false, reason: "not_applicable" });
  });

  it("sends things to carry 10 minutes after a late 21 Aug signup", () => {
    const registeredAt = istWallClockToUtc("2026-08-21T16:00:00");
    expect(
      evaluateEligibility({
        kind: "things_to_carry",
        channel: "whatsapp",
        now: istWallClockToUtc("2026-08-21T16:09:00"),
        registeredAt,
        snapshot: { status: "pending" },
      }),
    ).toEqual({ ok: false, reason: "not_due" });
    expect(
      evaluateEligibility({
        kind: "things_to_carry",
        channel: "whatsapp",
        now: istWallClockToUtc("2026-08-21T16:10:00"),
        registeredAt,
        snapshot: { status: "pending" },
      }),
    ).toEqual({ ok: true });
  });

  it("holds the day-before reminder until things to carry is sent", () => {
    const registeredAt = istWallClockToUtc("2026-08-21T16:00:00");
    const now = istWallClockToUtc("2026-08-21T16:15:00");
    expect(
      evaluateEligibility({
        kind: "reminder_day_before",
        channel: "whatsapp",
        now,
        registeredAt,
        snapshot: { status: "pending" },
        thingsToCarryStatus: "pending",
      }),
    ).toEqual({ ok: false, reason: "not_due" });
    expect(
      evaluateEligibility({
        kind: "reminder_day_before",
        channel: "whatsapp",
        now,
        registeredAt,
        snapshot: { status: "pending" },
        thingsToCarryStatus: "sent",
      }),
    ).toEqual({ ok: true });
  });
});
