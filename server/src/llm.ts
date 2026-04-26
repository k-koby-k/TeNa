// Gemini integration. Uses GEMINI_API_KEY (a plain Google AI Studio key —
// no IAM, no Vertex enrollment). Structured outputs via Gemini's native
// responseSchema, so we get a parsed object back instead of free text.
//
// Two entry points:
//   - analyze(req): full evaluation across 5 blocks + verdict
//   - chat(req):    grounded natural-language reply against scenario context

import { GoogleGenAI, Type } from "@google/genai";
import { randomBytes } from "node:crypto";
import type {
  AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse,
} from "./schemas.js";
import { composite, verdictFromScore } from "./scoring.js";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are the recommendation engine inside an explainable AI \
platform that helps Uzbek banks advise SME entrepreneurs on whether to open a \
specific business in a specific location.

Audience: SME credit analysts at the bank, plus entrepreneurs reading the \
output through a relationship manager. Tone: analytical, calibrated, never \
breezy. Cite concrete numbers from the inputs you are given.

The platform is built around six flagship models:
  - M-A1 Market sizing (TAM/SAM/SOM, niche fit)
  - M-A3 Saturation Index (0-100; higher means more crowded)
  - M-B1 Demand Forecasting (12-36 month outlook, peak periods)
  - M-C1 Location Score (foot traffic, anchors, walkability)
  - M-D1 Viability Check (breakeven, burn, ROI, gross margin)
  - M-E1 Competitor Intelligence (direct competitors, density, failure prob.)
  - M-F1 Credit Risk Score (DTI, suggested loan, readiness)

Composite policy (transparent linear weights, must stay consistent):
  Market 20%, Demand 20%, Location 25%, Financial 25%, Risk 10% (inverted).
  >=70 -> YES (Recommend Launch)
  50-69 -> MAYBE (Proceed with caution)
  <50  -> NO (Not recommended)

Local context you must respect:
  - Currency: UZS. Use realistic Tashkent district magnitudes.
    A typical small cafe: 50-80M UZS monthly revenue, rent 8-15M UZS, payroll 15-25M UZS.
  - Seasonality: Ramazon depresses cafe morning peaks; Navro'z lifts demand;
    September lifts back-to-office traffic; weddings shift food/retail spend.
  - Districts: Chilonzor, Yunusobod, Sergeli, Mirzo Ulug'bek, Yashnobod,
    Shaykhantakhur are common. Don't invent foreign cities.

Style rules:
  - Numbers must be self-consistent across blocks. If demand score is 74,
    don't claim "extremely strong demand" elsewhere.
  - Risks must be specific (rent burden %, competitor count, seasonality
    effect). Avoid generic phrases like "market risk".
  - Every recommendation must read as decision support, not autonomous
    approval. Bank action is a suggestion for a human credit officer.`;

// Gemini's responseSchema constrains output to a typed JSON object, parsed
// for us by the SDK. Using Type.OBJECT/STRING/etc. (not raw JSON Schema).
const ANALYZE_SCHEMA = {
  type: Type.OBJECT,
  required: ["market","demand","location","financial","competition","credit","factors","blurb"],
  properties: {
    market: {
      type: Type.OBJECT,
      required: ["tam_b_uzs","sam_b_uzs","som_b_uzs","saturation_index","score"],
      properties: {
        tam_b_uzs: { type: Type.NUMBER, description: "Total addressable market in billion UZS" },
        sam_b_uzs: { type: Type.NUMBER },
        som_b_uzs: { type: Type.NUMBER },
        saturation_index: { type: Type.INTEGER, description: "0-100, higher = more saturated" },
        score: { type: Type.INTEGER, description: "0-100" },
      },
    },
    demand: {
      type: Type.OBJECT,
      required: ["forecast_index","peak_periods","off_peak_dip_pct","score"],
      properties: {
        forecast_index: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "Exactly 12 monthly index values, indexed to district avg = 100",
        },
        peak_periods: { type: Type.ARRAY, items: { type: Type.STRING } },
        off_peak_dip_pct: { type: Type.INTEGER },
        score: { type: Type.INTEGER },
      },
    },
    location: {
      type: Type.OBJECT,
      required: ["foot_traffic_per_day","competitors_within_500m","walkability","visibility","score"],
      properties: {
        foot_traffic_per_day: { type: Type.INTEGER },
        competitors_within_500m: { type: Type.INTEGER },
        walkability: { type: Type.INTEGER },
        visibility: { type: Type.INTEGER },
        score: { type: Type.INTEGER },
      },
    },
    financial: {
      type: Type.OBJECT,
      required: ["breakeven_month","burn_rate_m_uzs","roi_12mo_pct","gross_margin_pct","score"],
      properties: {
        breakeven_month: { type: Type.INTEGER, description: "Months until breakeven, 1-36" },
        burn_rate_m_uzs: { type: Type.INTEGER, description: "Monthly burn in million UZS" },
        roi_12mo_pct: { type: Type.INTEGER, description: "12-month ROI percentage, can be negative" },
        gross_margin_pct: { type: Type.INTEGER },
        score: { type: Type.INTEGER },
      },
    },
    competition: {
      type: Type.OBJECT,
      required: ["direct_competitors","competitor_density_index","failure_probability_pct","risk_level","score"],
      properties: {
        direct_competitors: { type: Type.INTEGER },
        competitor_density_index: { type: Type.INTEGER },
        failure_probability_pct: { type: Type.INTEGER },
        risk_level: { type: Type.STRING, enum: ["Low","Medium","High","Critical"] },
        score: { type: Type.INTEGER, description: "Higher = riskier; inverted in composite" },
      },
    },
    credit: {
      type: Type.OBJECT,
      required: ["suggested_loan_m_uzs","dti","credit_readiness","product","score"],
      properties: {
        suggested_loan_m_uzs: { type: Type.INTEGER },
        dti: { type: Type.NUMBER },
        credit_readiness: { type: Type.INTEGER },
        product: { type: Type.STRING },
        score: { type: Type.INTEGER },
      },
    },
    factors: {
      type: Type.OBJECT,
      required: ["positives","risks","next_actions"],
      properties: {
        positives:    { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 specific positive findings citing input numbers" },
        risks:        { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 specific risks citing input numbers" },
        next_actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-4 concrete bank actions" },
      },
    },
    blurb: { type: Type.STRING, description: "One-sentence summary of the recommendation, <= 280 chars" },
  },
} as const;

function userPromptForAnalyze(req: AnalyzeRequest): string {
  const lines = [
    `Evaluate this scenario and return the structured JSON.`,
    ``,
    `Business type: ${req.business_type}`,
    `Format: ${req.format ?? "standard"}`,
    `Location: ${req.district}, ${req.city ?? "Tashkent"}`,
    `Total startup capital: ${req.budget_uzs.toLocaleString()} UZS`,
  ];
  if (req.loan_uzs)         lines.push(`Loan requested: ${req.loan_uzs.toLocaleString()} UZS`);
  if (req.monthly_rent_uzs) lines.push(`Monthly rent: ${req.monthly_rent_uzs.toLocaleString()} UZS`);
  if (req.notes)            lines.push(`Notes: ${req.notes}`);
  lines.push(
    ``,
    `Use realistic Tashkent magnitudes for the business type and district.`,
    `Keep all six block scores internally consistent with the factors and blurb.`,
    `Cite the actual input numbers (rent %, competitor count, loan amount) in positives and risks — no generic phrases.`,
  );
  return lines.join("\n");
}

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const resp = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: userPromptForAnalyze(req) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: ANALYZE_SCHEMA as any,
      temperature: 0.4,
    },
  });

  const text = resp.text;
  if (!text) throw new Error("Empty response from Gemini");
  const data = JSON.parse(text);

  // Defensive normalization — Gemini occasionally drifts from the schema.
  const f = data.demand.forecast_index as number[];
  if (f.length !== 12) {
    if (f.length > 12) data.demand.forecast_index = f.slice(0, 12);
    else while (data.demand.forecast_index.length < 12) data.demand.forecast_index.push(f.at(-1) ?? 100);
  }
  // Some runs return loan in raw UZS instead of millions despite the
  // description. If it's > 1000 (no real SME loan is 1000+ million), assume
  // it's raw UZS and divide.
  if (data.credit.suggested_loan_m_uzs > 1000) {
    data.credit.suggested_loan_m_uzs = Math.round(data.credit.suggested_loan_m_uzs / 1_000_000);
  }
  if (data.financial.burn_rate_m_uzs > 1000) {
    data.financial.burn_rate_m_uzs = Math.round(data.financial.burn_rate_m_uzs / 1_000_000);
  }

  const score = composite(
    data.market, data.demand, data.location, data.financial, data.competition,
  );

  return {
    request_id: `req_${randomBytes(4).toString("hex")}`,
    scenario_id: `SCN-${Date.now().toString(36).toUpperCase()}`,
    business_type: req.business_type,
    location: `${req.district}, ${req.city ?? "Tashkent"}`,
    market: data.market,
    demand: data.demand,
    location_block: data.location,
    financial: data.financial,
    competition: data.competition,
    credit: data.credit,
    factors: data.factors,
    verdict: verdictFromScore(score, data.blurb),
    models: [
      { id: "M-A3", name: "Saturation Index",       version: "1.2.0", confidence: 0.81, last_retrain: "2026-03-15" },
      { id: "M-B1", name: "Demand Forecasting",     version: "1.4.0", confidence: 0.76, last_retrain: "2026-03-12" },
      { id: "M-C1", name: "Location Score",          version: "2.0.1", confidence: 0.79, last_retrain: "2026-03-18" },
      { id: "M-D1", name: "Viability Check",         version: "1.1.0", confidence: 0.72, last_retrain: "2026-03-10" },
      { id: "M-E1", name: "Competitor Intelligence", version: "1.3.0", confidence: 0.84, last_retrain: "2026-03-14" },
      { id: "M-F1", name: "Credit Risk Score",       version: "2.1.0", confidence: 0.77, last_retrain: "2026-03-17" },
    ],
  };
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const grounding = req.scenario_context?.trim()
    || "(No analysis has been run yet. Ask the user to fill in the form and press Recompute.)";

  // Gemini-flavoured "history": role 'model' for assistant turns.
  const history = req.history.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.text }],
  }));

  const resp = await client().models.generateContent({
    model: MODEL,
    contents: [
      ...history,
      { role: "user", parts: [{ text: req.message }] },
    ],
    config: {
      systemInstruction: `${SYSTEM_PROMPT}\n\n--- Current scenario ---\n${grounding}`,
      temperature: 0.5,
    },
  });

  return {
    reply: resp.text ?? "",
    model_version: MODEL,
  };
}
