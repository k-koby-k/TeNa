// Free OSM Nominatim reverse geocode. No API key.
// Their usage policy requires an identifying User-Agent and ≤1 req/sec.
// We hit it at most once per Location-agent run, so we're well within limits.

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

export interface PlaceHit {
  display: string;
  lat: number;
  lng: number;
  type: string;       // "road" / "amenity" / "city" etc.
  importance: number;
}

/** Search places. Defaults to Tashkent-biased viewbox so common queries like
 * "chilonzor metro" resolve in-city. */
export async function searchPlaces(query: string, limit = 6): Promise<PlaceHit[]> {
  const q = query.trim();
  if (!q) return [];
  // Tashkent rough viewbox (longitude_min, latitude_max, longitude_max, latitude_min)
  const url = `${NOMINATIM_SEARCH}?q=${encodeURIComponent(q)}&format=json&limit=${limit}`
            + `&accept-language=en&addressdetails=0`
            + `&viewbox=69.10,41.40,69.50,41.18&bounded=0&countrycodes=uz`;
  const r = await fetch(url, {
    headers: { "User-Agent": "ai-business-platform/0.1 (sqb-ideathon)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) return [];
  const data = (await r.json()) as any[];
  return data.map((d) => ({
    display: d.display_name,
    lat: Number(d.lat),
    lng: Number(d.lon),
    type: d.type ?? d.class ?? "place",
    importance: Number(d.importance ?? 0),
  }));
}

export interface ReverseGeocode {
  district: string | null;     // e.g. "Chilonzor"
  neighborhood: string | null; // e.g. "TTZ"
  road: string | null;
  display: string;             // human-readable address
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocode> {
  const url = `${NOMINATIM}?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1&accept-language=en`;
  const r = await fetch(url, {
    headers: { "User-Agent": "ai-business-platform/0.1 (sqb-ideathon)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!r.ok) {
    return { district: null, neighborhood: null, road: null, display: `(${lat.toFixed(4)}, ${lng.toFixed(4)})` };
  }
  const data: any = await r.json();
  const a = data.address ?? {};
  // Tashkent's districts ("tumani") commonly land under one of these keys.
  const district = stripTumani(
    a.city_district ?? a.borough ?? a.suburb ?? a.county ?? a.district ?? null,
  );
  const neighborhood = a.neighbourhood ?? a.quarter ?? a.suburb ?? null;
  const road = a.road ?? a.pedestrian ?? null;
  return {
    district,
    neighborhood: neighborhood && neighborhood !== district ? neighborhood : null,
    road,
    display: data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  };
}

// Nominatim returns Russian/Uzbek names like "Chilonzor tumani". Drop the
// "tumani" / "район" suffixes for cleaner UI.
function stripTumani(s: string | null): string | null {
  if (!s) return s;
  return s
    .replace(/\s+tumani$/i, "")
    .replace(/\s+район$/i, "")
    .replace(/\s+district$/i, "")
    .trim();
}
