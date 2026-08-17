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
