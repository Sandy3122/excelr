/**
 * Approximate submitter location, taken from the edge headers Vercel adds to
 * every request (derived from the client IP). City-level only, and it reflects
 * the network's location: mobile carriers, VPNs and corporate networks can
 * resolve to a different city than the person is actually in.
 */

export interface RegistrationGeo {
  /** "device" = browser GPS the user allowed; "ip" = approximate, from the IP. */
  source: "device" | "ip";
  /** GPS accuracy radius in metres (device only). */
  accuracyMeters: number | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

function clean(value: string | null): string | null {
  if (!value) return null;
  let v = value;
  try {
    v = decodeURIComponent(value);
  } catch {
    // keep raw value
  }
  v = v.trim().slice(0, 120);
  return v || null;
}

function num(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function readRequestGeo(req: Request, ip: string | null): RegistrationGeo {
  const h = req.headers;
  return {
    source: "ip",
    accuracyMeters: null,
    ip,
    city: clean(h.get("x-vercel-ip-city")),
    region: clean(h.get("x-vercel-ip-country-region")),
    country: clean(h.get("x-vercel-ip-country")),
    postalCode: clean(h.get("x-vercel-ip-postal-code")),
    latitude: num(h.get("x-vercel-ip-latitude")),
    longitude: num(h.get("x-vercel-ip-longitude")),
    timezone: clean(h.get("x-vercel-ip-timezone")),
  };
}

/** Rebuild a geo object from a stored Firestore value; null when absent. */
export function parseGeo(raw: unknown): RegistrationGeo | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    source: d.source === "device" ? "device" : "ip",
    accuracyMeters: n(d.accuracyMeters),
    ip: str(d.ip),
    city: str(d.city),
    region: str(d.region),
    country: str(d.country),
    postalCode: str(d.postalCode),
    latitude: n(d.latitude),
    longitude: n(d.longitude),
    timezone: str(d.timezone),
  };
}

/** True when the lookup produced nothing useful (local dev, private IPs). */
export function hasGeoLocation(geo: RegistrationGeo | null): boolean {
  return (
    !!geo &&
    !!(geo.city || geo.region || geo.country || geo.latitude != null)
  );
}

export function formatGeoLocation(geo: RegistrationGeo | null): string {
  if (!geo) return "";
  const named = [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
  if (named) return named;
  if (geo.latitude != null && geo.longitude != null) {
    return `${geo.latitude.toFixed(3)}, ${geo.longitude.toFixed(3)}`;
  }
  return "";
}

/** Straight-line distance in km between two points (haversine). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface VenueCoords {
  venueLatitude: number | null;
  venueLongitude: number | null;
}

/** Approximate distance from the drive's venue in whole km; null if either side is unknown. */
export function distanceFromVenueKm(
  geo: RegistrationGeo | null,
  venue: VenueCoords | null | undefined,
): number | null {
  if (!geo || geo.latitude == null || geo.longitude == null) return null;
  if (!venue || venue.venueLatitude == null || venue.venueLongitude == null) return null;
  return Math.round(
    haversineKm(
      { lat: venue.venueLatitude, lng: venue.venueLongitude },
      { lat: geo.latitude, lng: geo.longitude },
    ),
  );
}

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

/**
 * Name a GPS fix via OpenStreetMap Nominatim. Best effort: any failure or
 * timeout returns blanks and the coordinates alone still drive the distance.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<Pick<RegistrationGeo, "city" | "region" | "country" | "postalCode">> {
  const blank = { city: null, region: null, country: null, postalCode: null };
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&addressdetails=1` +
      `&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "excelr-placement-drive/1.0 (registration geo)" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return blank;
    const a = ((await res.json()) as { address?: Record<string, string> }).address;
    if (!a) return blank;
    return {
      city:
        a.city || a.town || a.village || a.suburb || a.county || a.state_district || null,
      region: a.state || null,
      country: a.country_code ? a.country_code.toUpperCase() : null,
      postalCode: a.postcode || null,
    };
  } catch {
    return blank;
  }
}

/** Replace the IP guess with the user's allowed GPS fix. */
export async function applyDeviceLocation(
  ipGeo: RegistrationGeo,
  device: DeviceLocation,
): Promise<RegistrationGeo> {
  const named = await reverseGeocode(device.latitude, device.longitude);
  return {
    source: "device",
    accuracyMeters:
      device.accuracy != null && Number.isFinite(device.accuracy)
        ? Math.round(device.accuracy)
        : null,
    ip: ipGeo.ip,
    ...named,
    latitude: device.latitude,
    longitude: device.longitude,
    timezone: ipGeo.timezone,
  };
}

/** "16.98710, 82.24750" for emails and sheets; empty when unknown. */
export function formatGeoCoordinates(geo: RegistrationGeo | null): string {
  if (!geo || geo.latitude == null || geo.longitude == null) return "";
  return `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
}

/** Human label for where the location came from. */
export function formatGeoSource(geo: RegistrationGeo | null): string {
  if (!geo || !hasGeoLocation(geo)) return "Unknown";
  if (geo.source === "device") {
    return geo.accuracyMeters != null
      ? `GPS (accurate to ~${geo.accuracyMeters} m)`
      : "GPS";
  }
  return "IP address (approximate)";
}

/** Google Maps link for the coordinates, or empty when unknown. */
export function geoMapsUrl(geo: RegistrationGeo | null): string {
  if (!geo || geo.latitude == null || geo.longitude == null) return "";
  return `https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`;
}
