// Free OSM Overpass API client. No key required, polite User-Agent.
//
// We use this to find real POIs within radius of a point — competitors,
// metro stations, malls, schools, etc. The data is real OpenStreetMap
// content (good coverage in Tashkent).

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export interface POI {
  id: number;
  name: string | null;
  kind: string;        // "amenity=cafe" / "shop=convenience" etc.
  lat: number;
  lng: number;
  distance_m: number;
}

const haversine = (la1: number, lo1: number, la2: number, lo2: number) => {
  const R = 6_371_000;
  const dLat = (la2 - la1) * Math.PI / 180;
  const dLon = (lo2 - lo1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

async function overpass(query: string): Promise<any> {
  const r = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ai-business-platform/0.1 (sqb-ideathon)",
    },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Map a frontend business type to OSM tag selectors that represent direct
// competitors. Keep this conservative — better to miss a long-tail tag than
// to flood the result with false positives.
function competitorSelectors(business_type: string): string[] {
  const t = business_type.toLowerCase();
  if (t.includes("coffee") || t.includes("cafe")) return ['amenity~"^cafe$"', 'cuisine~"coffee"'];
  if (t.includes("bakery"))                       return ['shop~"^bakery$"', 'amenity~"^cafe$"'];
  if (t.includes("pharmacy") || t.includes("apte")) return ['amenity~"^pharmacy$"'];
  if (t.includes("restaurant"))                   return ['amenity~"^restaurant$"', 'amenity~"^fast_food$"'];
  if (t.includes("salon") || t.includes("beauty")) return ['shop~"^(beauty|hairdresser)$"', 'amenity~"^beauty"'];
  if (t.includes("clinic") || t.includes("dental")) return ['amenity~"^(clinic|dentist|doctors)$"'];
  if (t.includes("market") || t.includes("grocer")) return ['shop~"^(supermarket|convenience)$"'];
  if (t.includes("gym") || t.includes("fit"))     return ['leisure~"^(fitness_centre|sports_centre)$"'];
  // Generic fallback — any retail shop
  return ['shop'];
}

export async function fetchCompetitors(
  lat: number, lng: number, business_type: string, radius_m = 500,
): Promise<POI[]> {
  const selectors = competitorSelectors(business_type);
  // Overpass QL: union of node/way/relation matching each selector
  const around = `(around:${radius_m},${lat},${lng})`;
  const blocks = selectors.flatMap((sel) => [
    `nwr[${sel}]${around};`,
  ]).join("");
  const query = `[out:json][timeout:15];(${blocks});out center tags 60;`;
  const data = await overpass(query);
  const pois: POI[] = [];
  for (const el of data.elements ?? []) {
    const lat2 = el.lat ?? el.center?.lat;
    const lng2 = el.lon ?? el.center?.lon;
    if (lat2 == null || lng2 == null) continue;
    const tags = el.tags ?? {};
    const kind = tags.amenity ? `amenity=${tags.amenity}`
              : tags.shop    ? `shop=${tags.shop}`
              : tags.leisure ? `leisure=${tags.leisure}`
              : "other";
    pois.push({
      id: el.id, name: tags.name ?? null, kind,
      lat: lat2, lng: lng2,
      distance_m: haversine(lat, lng, lat2, lng2),
    });
  }
  pois.sort((a, b) => a.distance_m - b.distance_m);
  return pois;
}

export interface Anchor extends POI { anchor_type: string; }

/** Anchors that drive foot traffic: transit, malls, schools, markets, hospitals. */
export async function fetchAnchors(
  lat: number, lng: number, radius_m = 800,
): Promise<Anchor[]> {
  const around = `(around:${radius_m},${lat},${lng})`;
  const query = `
    [out:json][timeout:15];
    (
      nwr[railway=station]${around};
      nwr[station=subway]${around};
      nwr[public_transport=station]${around};
      nwr[shop=mall]${around};
      nwr[amenity=marketplace]${around};
      nwr[amenity=hospital]${around};
      nwr[amenity~"^(school|university|college)$"]${around};
      nwr[office]${around};
    );
    out center tags 80;`;
  const data = await overpass(query);
  const out: Anchor[] = [];
  for (const el of data.elements ?? []) {
    const lat2 = el.lat ?? el.center?.lat;
    const lng2 = el.lon ?? el.center?.lon;
    if (lat2 == null || lng2 == null) continue;
    const tags = el.tags ?? {};
    let anchor_type = "office";
    if (tags.railway === "station" || tags.station === "subway" || tags.public_transport) anchor_type = "transit";
    else if (tags.shop === "mall") anchor_type = "mall";
    else if (tags.amenity === "marketplace") anchor_type = "market";
    else if (tags.amenity === "hospital") anchor_type = "hospital";
    else if (tags.amenity && /school|university|college/.test(tags.amenity)) anchor_type = "education";
    const name = tags.name ?? tags["name:en"] ?? null;
    out.push({
      id: el.id, name, kind: `anchor=${anchor_type}`,
      lat: lat2, lng: lng2, distance_m: haversine(lat, lng, lat2, lng2),
      anchor_type,
    });
  }
  // Dedup by (anchor_type + rounded coords) — Overpass often returns the same
  // anchor as both a node and the parent way.
  const seen = new Set<string>();
  const dedup = out.filter((a) => {
    const k = `${a.anchor_type}:${a.lat.toFixed(4)}:${a.lng.toFixed(4)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  dedup.sort((a, b) => a.distance_m - b.distance_m);
  return dedup;
}
