// Synthesis agent. After Location / Market / Financials have run, this
// reads all of them plus the borrower context and writes the executive
// recommendation paragraph shown on the Overview hero.

import { GoogleGenAI, Type } from "@google/genai";
import type {
  MarketBlock, DemandBlock, LocationBlock, FinancialBlock,
  CompetitionBlock, CreditBlock,
} from "./../schemas.js";

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

export interface SynthesizeRequest {
  business_name: string;
  business_type: string;
  description?: string;
  location: string;          // "Chilonzor, Tashkent"
  composite_score: number;
  short_label: "YES" | "MAYBE" | "NO";
  // Block scores (any may be 0 if that agent didn't run)
  market: Pick<MarketBlock, "score" | "tam_b_uzs" | "saturation_index">;
  demand?: Pick<DemandBlock, "score" | "off_peak_dip_pct">;
  loc: Pick<LocationBlock, "score" | "foot_traffic_per_day" | "competitors_within_500m">;
  financial: Pick<FinancialBlock, "score" | "breakeven_month" | "roi_12mo_pct" | "gross_margin_pct">;
  competition?: Pick<CompetitionBlock, "risk_level" | "failure_probability_pct">;
  credit: Pick<CreditBlock, "credit_readiness" | "suggested_loan_m_uzs" | "product">;
  // Loan-app context
  loan_uzs?: number;
  collateral_type?: string;
  has_cosigner?: boolean;
  contingency_runway_months?: number;
}

export interface SynthesizeResult {
  blurb: string;            // 2-3 sentence executive summary
  positives: string[];      // 4-5 bullets
  risks: string[];          // 4-5 bullets
  next_actions: string[];   // 3-4 concrete bank actions
  bank_product: string;     // e.g. "SME working capital, 120M UZS, 24mo, 3mo grace"
  bank_conditions: string[];// up to 3 covenants
}

const SCHEMA = {
  type: Type.OBJECT,
  required: ["blurb","positives","risks","next_actions","bank_product","bank_conditions"],
  properties: {
    blurb:           { type: Type.STRING, description: "2-3 sentence executive verdict, plain prose, ≤320 chars." },
    positives:       { type: Type.ARRAY, items: { type: Type.STRING } },
    risks:           { type: Type.ARRAY, items: { type: Type.STRING } },
    next_actions:    { type: Type.ARRAY, items: { type: Type.STRING } },
    bank_product:    { type: Type.STRING },
    bank_conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
} as const;

const SYSTEM = `You are the SQB SME credit synthesis agent. You compose the
final recommendation that a relationship manager will read to the founder.
Tone: analytical, calibrated, no marketing language. Cite numbers.
Bullets must each reference a concrete metric.`;

export async function synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
  const prompt = `Synthesize the final recommendation.

Business: "${req.business_name}" — ${req.business_type} at ${req.location}
${req.description ? `Concept: ${req.description}` : ""}

Composite verdict: ${req.short_label} · ${req.composite_score}/100

Block summaries:
- Market: score ${req.market.score}, TAM ${req.market.tam_b_uzs}B UZS, saturation ${req.market.saturation_index}/100
- Location: score ${req.loc.score}, foot traffic ~${req.loc.foot_traffic_per_day}/day, ${req.loc.competitors_within_500m} competitors within 500m
- Financial: score ${req.financial.score}, breakeven mo ${req.financial.breakeven_month}, ROI 12mo ${req.financial.roi_12mo_pct}%, margin ${req.financial.gross_margin_pct}%
${req.competition ? `- Competition: ${req.competition.risk_level} risk, ${req.competition.failure_probability_pct}% failure probability` : ""}
- Credit: readiness ${req.credit.credit_readiness}/100, suggested loan ${req.credit.suggested_loan_m_uzs}M UZS, product "${req.credit.product}"

Loan-application facts:
${req.loan_uzs ? `- Loan requested: ${(req.loan_uzs/1_000_000).toFixed(0)}M UZS` : ""}
${req.collateral_type ? `- Collateral: ${req.collateral_type}` : ""}
${req.has_cosigner ? `- Co-signer: yes` : "- Co-signer: no"}
${req.contingency_runway_months ? `- Contingency runway: ${req.contingency_runway_months} months` : ""}

Return:
- blurb: 2-3 sentences, plain English, no exclamation marks. The first sentence states the verdict and the headline reason; the rest names the binding constraint or biggest enabler.
- positives: 4-5 bullets each citing a concrete number from above.
- risks: 4-5 bullets, specific (rent burden %, competitor count, ramp month).
- next_actions: 3-4 concrete bank-side actions a credit officer should take.
- bank_product: 1-line product recommendation including amount + tenor + grace.
- bank_conditions: up to 3 covenants tied to specific metrics.`;

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

  const text = resp.text;
  if (!text) throw new Error("Empty synthesis response");
  return JSON.parse(text) as SynthesizeResult;
}
