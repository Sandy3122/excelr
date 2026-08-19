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
  win: RegistrationWindow,
  now: Date = new Date(),
): RegistrationWindowStatus {
  return {
    ...win,
    closed: isRegistrationClosed(win.closesAtIso, now),
    closesAtLabel: formatClosesAtLabel(win.closesAtIso),
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
