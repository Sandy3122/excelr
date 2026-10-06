import { describe, expect, it } from "vitest";
import { distanceFromVenueKm, formatGeoLocation, readRequestGeo } from "./geo";

function req(headers: Record<string, string>) {
  return new Request("https://x.test", { headers });
}

describe("geo", () => {
  it("reads and decodes Vercel headers", () => {
    const geo = readRequestGeo(
      req({
        "x-vercel-ip-city": "Navi%20Mumbai",
        "x-vercel-ip-country-region": "MH",
        "x-vercel-ip-country": "IN",
        "x-vercel-ip-latitude": "19.03",
        "x-vercel-ip-longitude": "73.03",
      }),
      "1.2.3.4",
    );
    expect(formatGeoLocation(geo)).toBe("Navi Mumbai, MH, IN");
    expect(geo.ip).toBe("1.2.3.4");
    expect(distanceFromVenueKm(geo, { venueLatitude: 12.9166, venueLongitude: 77.6101 })).toBeGreaterThan(700);
    expect(distanceFromVenueKm(geo, { venueLatitude: null, venueLongitude: null })).toBeNull();
  });

  it("returns nulls without headers", () => {
    const geo = readRequestGeo(req({}), null);
    expect(formatGeoLocation(geo)).toBe("");
    expect(distanceFromVenueKm(geo, null)).toBeNull();
  });
});
