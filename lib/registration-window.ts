import { formatIst, getIstParts, istWallClockToUtc } from "@/lib/automations/ist";

export const REGISTRATION_CLOSED_MESSAGE =
  "Registrations for this placement drive are closed. Thank you for your interest.";

export interface RegistrationWindow {
  closesAtIso: string | null;
  updatedAt: string | null;
}

export interface RegistrationWindowStatus extends RegistrationWindow {
  closed: boolean;
  closesAtLabel: string | null;
  /** Why it is closed, when it is. */
  closedReason: "scheduled" | "event_passed" | null;
}

/**
 * A drive stops taking registrations once its event day is over, whether or
 * not anyone remembered to schedule a close time. Nobody can attend a drive
 * that already happened, and leaving a finished campaign open is how stale
 * pages keep collecting leads.
 *
 * The cutoff is the end of the event day in IST, so same-day signups still
 * work. A drive that needs to stay open past that (or close earlier) sets an
 * explicit close time, which always wins.
 */
export function hasEventPassed(
  eventDayIstDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!eventDayIstDate) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDayIstDate)) return false;
  const endOfEventDay = istWallClockToUtc(`${eventDayIstDate}T23:59:59`);
  return now.getTime() > endOfEventDay.getTime();
}

export function isRegistrationClosed(
  closesAtIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!closesAtIso) return false;
  const at = Date.parse(closesAtIso);
  if (!Number.isFinite(at)) return false;
  return now.getTime() >= at;
}

export function formatClosesAtLabel(closesAtIso: string | null): string | null {
  if (!closesAtIso) return null;
  const at = Date.parse(closesAtIso);
  if (!Number.isFinite(at)) return null;
  return formatIst(new Date(at));
}

export function toWindowStatus(
  win: RegistrationWindow & { eventDayIstDate?: string | null },
  now: Date = new Date(),
): RegistrationWindowStatus {
  const scheduled = isRegistrationClosed(win.closesAtIso, now);
  const eventPassed = hasEventPassed(win.eventDayIstDate, now);
  return {
    closesAtIso: win.closesAtIso,
    updatedAt: win.updatedAt,
    closed: scheduled || eventPassed,
    closesAtLabel: formatClosesAtLabel(win.closesAtIso),
    closedReason: scheduled ? "scheduled" : eventPassed ? "event_passed" : null,
  };
}

export function istDateAndTimeToUtcIso(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return istWallClockToUtc(`${date}T${t}`).toISOString();
}

export function utcIsoToIstDateTime(iso: string): { date: string; time: string } {
  const p = getIstParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}
