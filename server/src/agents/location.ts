// Location agent. Given a pinned point + business type:
//   1. Fetches real competitors and anchors from OpenStreetMap (Overpass).
//   2. Computes deterministic features (counts, anchor mix, density).
//   3. Asks Gemini to synthesize the M-C1 Location Score with rationale.
//
// The frontend consumes this to populate the Location block automatically —
// no manual "competitors_within_500m" entry.

import { GoogleGenAI, Type } from "@google/genai";
import { fetchCompetitors, fetchAnchors, type POI, type Anchor } from "./overpass.js";
import { reverseGeocode } from "./geocode.js";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    const k = process.env.GEMINI_API_KEY;
    if (!k) throw new Error("GEMINI_API_KEY not set");
    _client = new GoogleGenAI({ apiKey: k });
  }
  return _client;
}

export interface LocationAgentRequest {
  lat: number;
  lng: number;
  business_type: string;
  format?: "kiosk" | "standard" | "premium";
  business_name?: string;
  description?: string;
  // Site facts the user supplies on the Location screen:
  site_size_sqm?: number;
  monthly_rent_uzs?: number;
  operating_hours?: "short" | "standard" | "long" | "24h";
}

export interface LocationAgentResult {
  // Same shape as the LocationBlock the dashboard consumes.
  foot_traffic_per_day: number;
  competitors_within_500m: number;
  walkability: number;
  visibility: number;
  score: number;
  // Plus supporting data the UI shows:
  competitors_within_1km: number;
  competitors: Array<{ name: string | null; kind: string; distance_m: number; lat: number; lng: number }>;
  anchors: Array<{ name: string | null; type: string; distance_m: number; lat: number; lng: number }>;
  rationale: string[];
  // Reverse-geocoded facts about the pin so the UI can stop asking "what district".
  district: string | null;
  neighborhood: string | null;
  road: string | null;
  display_address: string;
  /** True when Overpass returned 0 competitors and 0 anchors — usually means
   * the user pinned an unmapped area; we still return derived defaults. */
  sparse_data: boolean;
}

function summariseAnchors(anchors: Anchor[]): Record<string, { count: number; nearest_m: number | null }> {
  const groups = ["transit", "mall", "market", "hospital", "education", "office"];
  const out: Record<string, { count: number; nearest_m: number | null }> = {};
  for (const g of groups) {
    const m = anchors.filter((a) => a.anchor_type === g);
    out[g] = { count: m.length, nearest_m: m[0]?.distance_m ?? null };
  }
  return out;
}

const SCHEMA = {
  type: Type.OBJECT,
  required: ["foot_traffic_per_day", "walkability", "visibility", "score", "rationale"],
  properties: {
    foot_traffic_per_day: { type: Type.INTEGER, description: "Estimated daily foot traffic 200-3000" },
    walkability:          { type: Type.INTEGER, description: "0-100" },
    visibility:           { type: Type.INTEGER, description: "0-100" },
    score:                { type: Type.INTEGER, description: "0-100 composite location score" },
    rationale: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 short bullet points justifying the score, citing concrete features",
    },
  },
} as const;

export async function analyzeLocation(req: LocationAgentRequest): Promise<LocationAgentResult> {
  const [competitors, anchors, geo] = await Promise.all([
    fetchCompetitors(req.lat, req.lng, req.business_type, 1000),
    fetchAnchors(req.lat, req.lng, 800),
    reverseGeocode(req.lat, req.lng),
  ]);

  const within500 = competitors.filter((c) => c.distance_m <= 500);
  const sparse = competitors.length === 0 && anchors.length === 0;
  const anchorSummary = summariseAnchors(anchors);

  const businessLine = req.business_name
    ? `Business: "${req.business_name}" (${req.business_type}${req.format ? `, ${req.format} format` : ""}).`
    : `Business: ${req.business_type}${req.format ? ` (${req.format} format)` : ""}.`;
  const descLine = req.description ? `Concept: ${req.description}` : "";
  const siteFacts: string[] = [];
  if (req.site_size_sqm)    siteFacts.push(`${req.site_size_sqm} sqm`);
  if (req.monthly_rent_uzs) siteFacts.push(`rent ${(req.monthly_rent_uzs / 1_000_000).toFixed(1)}M UZS/mo`);
  if (req.operating_hours)  siteFacts.push(`hours: ${req.operating_hours}`);
  const siteLine = siteFacts.length ? `Site facts: ${siteFacts.join(" · ")}` : "";

  const prompt = `Score this location for the business below.
Coordinates: (${req.lat.toFixed(5)}, ${req.lng.toFixed(5)}) — ${geo.display}
${geo.district ? `District (reverse-geocoded): ${geo.district}, Tashkent` : ""}

${businessLine}
${descLine}
${siteLine}

Real OSM data within 1 km:
- ${competitors.length} direct competitors total, ${within500.length} within 500 m.
${competitors.slice(0, 8).map((c) => `  · ${c.name ?? "(unnamed)"} — ${c.kind} — ${c.distance_m}m`).join("\n")}

Anchors within 800 m (counts · nearest distance):
${Object.entries(anchorSummary).map(([k, v]) => `- ${k}: ${v.count} · ${v.nearest_m ?? "—"}m`).join("\n")}

Compute:
- foot_traffic_per_day — estimate daily pedestrian traffic. Strong transit (≤300m) and mall presence push it up; a thin anchor mix pulls it down. Bigger sites (≥80 sqm) on busy streets attract more.
- walkability — 0-100; anchor density + street richness.
- visibility — 0-100; site frontage type, anchor proximity.
- score — composite 0-100 the dashboard renders. Penalise heavy saturation (≥8 within 500m). If rent is provided, factor whether it's plausible for the site size and footfall — overpriced sites lose 5–10 points.
- rationale — 3-5 bullets each citing a concrete number from the data above (including site size / rent if provided).

Use realistic Tashkent magnitudes. If OSM data is sparse, return mid-band (50-65) and call it out.`;

  const resp = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: 0.4,
    },
  });

  const data = JSON.parse(resp.text ?? "{}");

  return {
    foot_traffic_per_day: Math.round(data.foot_traffic_per_day),
    competitors_within_500m: within500.length,
    walkability: Math.round(data.walkability),
    visibility: Math.round(data.visibility),
    score: Math.round(data.score),
    competitors_within_1km: competitors.length,
    competitors: competitors.slice(0, 30).map((c: POI) => ({
      name: c.name, kind: c.kind, distance_m: c.distance_m, lat: c.lat, lng: c.lng,
    })),
    anchors: anchors.slice(0, 30).map((a: Anchor) => ({
      name: a.name, type: a.anchor_type, distance_m: a.distance_m, lat: a.lat, lng: a.lng,
    })),
    rationale: data.rationale ?? [],
    district: geo.district,
    neighborhood: geo.neighborhood,
    road: geo.road,
    display_address: geo.display,
    sparse_data: sparse,
  };
}
