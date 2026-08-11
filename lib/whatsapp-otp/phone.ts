import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { DEFAULT_COUNTRY } from "./config";

/**
 * Phone number normalization. We rely on libphonenumber-js rather than
 * hand-rolling country-specific parsing.
 *
 * `e164`  -> canonical "+919876543210" used for storage / rate-limit keys.
 * `infobip` -> the same digits WITHOUT the leading "+", which is the format
 *              Infobip expects in the `to` field (e.g. "919876543210").
 * `masked` -> safe-to-log representation, e.g. "+9198XXXXXX10".
 */
export type NormalizedPhone = {
  e164: string;
  infobip: string;
  masked: string;
};

export function normalizePhone(
  input: string,
  defaultCountry: string = DEFAULT_COUNTRY,
): NormalizedPhone | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(
    trimmed,
    defaultCountry as CountryCode,
  );
  if (!parsed || !parsed.isValid()) return null;

  const e164 = parsed.number; // always starts with "+"
  return {
    e164,
    infobip: e164.replace(/^\+/, ""),
    masked: maskE164(e164, parsed.countryCallingCode),
  };
}

/**
 * Mask all but the country calling code and last two digits, e.g.
 * "+919876543210" -> "+91XXXXXXXX10". When the calling code is known (from the
 * parser) it is used for an accurate boundary; otherwise we fall back to a
 * conservative 2-digit prefix.
 */
export function maskE164(e164: string, callingCode?: string): string {
  const digits = e164.replace(/^\+/, "");
  const code = callingCode ?? digits.slice(0, 2);
  const rest = digits.slice(code.length);
  if (rest.length <= 2) return `+${code}${"X".repeat(rest.length)}`;
  const last2 = rest.slice(-2);
  const middle = "X".repeat(rest.length - 2);
  return `+${code}${middle}${last2}`;
}
