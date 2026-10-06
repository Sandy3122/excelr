/**
 * Approximate submitter location, taken from the edge headers Vercel adds to
 * every request (derived from the client IP). City-level only, and it reflects
 * the network's location: mobile carriers, VPNs and corporate networks can
 * resolve to a different city than the person is actually in.
 */

export interface RegistrationGeo {
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
  return !!geo && !!(geo.city || geo.region || geo.country);
}

export function formatGeoLocation(geo: RegistrationGeo | null): string {
  if (!geo) return "";
  return [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
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
