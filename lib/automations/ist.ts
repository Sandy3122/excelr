/**
 * India Standard Time helpers. Event automations MUST use IST, never the
 * server's local zone or naive UTC wall-clock times.
 */
export const IST_TIME_ZONE = "Asia/Kolkata";

export interface IstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const IST_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

export function getIstParts(date: Date = new Date()): IstParts {
  const bag: Record<string, string> = {};
  for (const part of IST_FORMATTER.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/**
 * Convert an IST wall-clock datetime (`YYYY-MM-DDTHH:mm:ss`) to a UTC Date.
 * IST is UTC+05:30 year-round (no DST).
 */
export function istWallClockToUtc(istIsoLocal: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    istIsoLocal.trim(),
  );
  if (!match) {
    throw new Error(`Invalid IST wall-clock datetime: ${istIsoLocal}`);
  }
  const [, y, mo, d, h, mi, s] = match;
  const asUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s || "0"),
  );
  return new Date(asUtc - 5.5 * 60 * 60 * 1000);
}

export function formatIst(date: Date): string {
  const p = getIstParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)} IST`;
}

export function istDateKey(date: Date = new Date()): string {
  const p = getIstParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatIstDateLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return key;
  return `${day} ${MONTHS_SHORT[month - 1]} ${match[1]}`;
}

export function nextIstDateKey(key: string): string {
  const noon = istWallClockToUtc(`${key}T12:00:00`);
  return istDateKey(new Date(noon.getTime() + 24 * 60 * 60 * 1000));
}

/** Half-open UTC range covering one IST calendar day. */
export function istDayUtcRange(key: string): { startIso: string; endIso: string } {
  const start = istWallClockToUtc(`${key}T00:00:00`);
  const end = istWallClockToUtc(`${nextIstDateKey(key)}T00:00:00`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
