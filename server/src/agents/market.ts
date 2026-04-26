// Market sizing agent. Given a free-text brief (the user's pitch / one-liner),
// extract structured intent, then compute TAM / SAM / SOM with reasoning.
//
// Single-pass design: Gemini does extraction + sizing in one call so the user
// sees results immediately. If the brief is too thin, the response signals
// what's missing rather than fabricating.

import { GoogleGenAI, Type } from "@google/genai";

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

export interface MarketAgentRequest {
  brief: string;
  district?: string;
  business_type?: string;
  business_name?: string;
  format?: "kiosk" | "standard" | "premium";
  // Commercial inputs the user actually fills:
  target_audience?: string;       // office | residents | students | tourists | mixed
  price_tier?: "value" | "mid" | "premium";
  average_ticket_uzs?: number;
  customers_per_day?: number;
  marketing_reach?: string;       // walk_by | district | city | online_offline
  comparable_competitor?: string; // free text — name a similar shop
  niche?: string;                 // optional override of agent's extraction
}

export interface MarketAgentResult {
  // Resolved intent — what the agent understood from the brief.
  understood: {
    business_type: string;
    niche: string;
    customer_segment: string;
    geography: string;
  };
  // Sizing block (B UZS).
  tam_b_uzs: number;
  sam_b_uzs: number;
  som_b_uzs: number;
  saturation_index: number;   // 0-100
  niche_fit: string;          // human-readable: "premium · open" etc.
  score: number;              // 0-100 market opportunity score
  rationale: string[];        // bullets citing assumptions
  /** Questions the agent would ask if anything is genuinely missing. Empty
   *  array means it had enough to answer. */
  follow_up_questions: string[];
}

const SCHEMA = {
  type: Type.OBJECT,
  required: [
    "understood", "tam_b_uzs", "sam_b_uzs", "som_b_uzs",
    "saturation_index", "niche_fit", "score", "rationale", "follow_up_questions",
  ],
  properties: {
    understood: {
      type: Type.OBJECT,
      required: ["business_type", "niche", "customer_segment", "geography"],
      properties: {
        business_type:    { type: Type.STRING },
        niche:            { type: Type.STRING },
        customer_segment: { type: Type.STRING },
        geography:        { type: Type.STRING },
      },
    },
    tam_b_uzs:        { type: Type.NUMBER, description: "Total addressable market, billion UZS" },
    sam_b_uzs:        { type: Type.NUMBER, description: "Serviceable addressable market, billion UZS" },
    som_b_uzs:        { type: Type.NUMBER, description: "Serviceable obtainable market year 1, billion UZS" },
    saturation_index: { type: Type.INTEGER, description: "0-100 (higher = more crowded)" },
    niche_fit:        { type: Type.STRING, description: "Short label e.g. 'premium · open' or 'mass · saturated'" },
    score:            { type: Type.INTEGER, description: "0-100 market opportunity score" },
    rationale:        { type: Type.ARRAY, items: { type: Type.STRING } },
    follow_up_questions: {
      type: Type.ARRAY, items: { type: Type.STRING },
      description: "0-3 short questions if essential info was missing; empty array if not.",
    },
  },
} as const;

const SYSTEM = `You are the market-sizing agent inside a bank-grade SME advisory platform.
You receive a free-text brief from a founder. Your job:

1. Extract structured intent: business_type, niche, customer_segment, geography.
   If the brief omits geography, default to the district hint or "Tashkent".
2. Compute TAM / SAM / SOM in *billion UZS* using realistic Tashkent benchmarks:
   - TAM = the entire category in the city/country.
   - SAM = the serviceable slice for this niche & district.
   - SOM = realistic year-1 obtainable share given competition.
3. Estimate saturation_index (0-100) and a market opportunity score (0-100).
4. List 3-5 rationale bullets, each citing a number or assumption.
5. Only ask follow-up questions if essential information is genuinely missing
   (e.g. brief is one word). Otherwise return an empty array — proceed with
   reasonable defaults.

Reference magnitudes for Tashkent (use as anchors, not gospel):
- Specialty coffee city-wide: ~150-200B UZS/year
- Pharmacy chain city-wide: ~400-600B UZS/year
- Bakery city-wide: ~80-120B UZS/year
- Beauty salon city-wide: ~70-100B UZS/year
A district typically captures 8-15% of city demand.`;

export async function analyzeMarket(req: MarketAgentRequest): Promise<MarketAgentResult> {
  const lines: string[] = [];
  if (req.business_name)  lines.push(`Business: "${req.business_name}"`);
  if (req.business_type)  lines.push(`Type: ${req.business_type}${req.format ? ` (${req.format} format)` : ""}`);
  if (req.district)       lines.push(`Target district: ${req.district}`);
  if (req.niche)          lines.push(`Niche (user-provided): ${req.niche}`);
  if (req.target_audience) lines.push(`Target audience: ${req.target_audience}`);
  if (req.price_tier)     lines.push(`Price tier: ${req.price_tier}`);
  if (req.average_ticket_uzs) lines.push(`Average ticket: ${req.average_ticket_uzs.toLocaleString()} UZS`);
  if (req.customers_per_day)  lines.push(`Customers/day target: ${req.customers_per_day}`);
  if (req.marketing_reach)    lines.push(`Marketing reach: ${req.marketing_reach}`);
  if (req.comparable_competitor) lines.push(`Comparable competitor named: ${req.comparable_competitor}`);

  const prompt = `Concept brief:
"""
${req.brief.trim()}
"""

Structured inputs:
${lines.map((l) => `- ${l}`).join("\n")}

Sizing rules:
- TAM = total city-wide addressable for this category.
- SAM = constrained by the marketing_reach (walk_by ≈ 0.5%; district ≈ 8-15%; city ≈ 60-80%; online_offline ≈ 90%).
- SOM = realistic year-1 capture, factoring saturation and ticket × customers/day implied annual revenue.
- saturation_index reflects competition density for this niche in this geography.
- score (0-100) is the *opportunity* score: high SOM, low saturation, clear niche.

Return structured analysis. If absolutely critical info is missing, list at most 2 follow-up questions; otherwise keep that array empty.`;

  const resp = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: 0.4,
    },
  });

  const data = JSON.parse(resp.text ?? "{}");
  return data as MarketAgentResult;
}
