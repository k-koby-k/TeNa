// Financials agent. Asks the minimum the user needs to provide
// (capital, rent, average ticket, daily customers) and infers everything
// else (COGS, payroll, opex) from Tashkent sector benchmarks.
//
// One-shot design — the agent returns the full financial block in a single
// call. The frontend renders the "assumptions" list so the user can see
// what was inferred and adjust if needed.

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

export interface FinancialsAgentRequest {
  business_type: string;
  district: string;
  format?: "kiosk" | "standard" | "premium";
  business_name?: string;
  description?: string;
  // Now-required:
  startup_capital_uzs: number;
  loan_uzs?: number;
  repayment_months?: number;
  // Pre-known from earlier agents (the Financials screen will not re-ask these):
  monthly_rent_uzs?: number;
  average_ticket_uzs?: number;
  expected_customers_per_day?: number;
  site_size_sqm?: number;
  other_monthly_costs_m_uzs?: number;
  revenue_ramp_months?: number;
}

export interface FinancialsAgentResult {
  breakeven_month: number;
  burn_rate_m_uzs: number;
  roi_12mo_pct: number;
  gross_margin_pct: number;
  score: number;

  // Transparency layer for the UI.
  inferred: {
    monthly_revenue_m_uzs: number;
    cogs_pct: number;
    payroll_m_uzs: number;
    other_opex_m_uzs: number;
    rent_burden_pct: number;
  };
  assumptions: string[];
}

const SCHEMA = {
  type: Type.OBJECT,
  required: ["breakeven_month","burn_rate_m_uzs","roi_12mo_pct","gross_margin_pct","score","inferred","assumptions"],
  properties: {
    breakeven_month:  { type: Type.INTEGER, description: "1-36" },
    burn_rate_m_uzs:  { type: Type.INTEGER, description: "Monthly burn in million UZS during the loss-making phase" },
    roi_12mo_pct:     { type: Type.INTEGER, description: "Can be negative" },
    gross_margin_pct: { type: Type.INTEGER, description: "0-100" },
    score:            { type: Type.INTEGER, description: "0-100 viability score" },
    inferred: {
      type: Type.OBJECT,
      required: ["monthly_revenue_m_uzs","cogs_pct","payroll_m_uzs","other_opex_m_uzs","rent_burden_pct"],
      properties: {
        monthly_revenue_m_uzs: { type: Type.INTEGER },
        cogs_pct:              { type: Type.INTEGER },
        payroll_m_uzs:         { type: Type.INTEGER },
        other_opex_m_uzs:      { type: Type.INTEGER },
        rent_burden_pct:       { type: Type.INTEGER },
      },
    },
    assumptions: {
      type: Type.ARRAY, items: { type: Type.STRING },
      description: "3-6 bullets explaining inferred values, citing benchmarks",
    },
  },
} as const;

const SYSTEM = `You are the financials agent inside a bank SME advisory platform.
The user gives you the minimum: capital, monthly rent, average ticket size,
optionally expected daily customers. You infer the rest from Tashkent sector
benchmarks and produce a viability snapshot.

Tashkent benchmarks (use as anchors):
- Coffee shop standard: COGS 35-40%, payroll 18-25M UZS, opex 4-7M UZS, ticket 25-45k UZS, 100-250 customers/day
- Coffee shop premium: COGS 30-38%, payroll 22-30M UZS, opex 6-10M UZS, ticket 40-70k UZS, 80-200 customers/day
- Pharmacy: COGS 70-78%, payroll 12-18M UZS, opex 3-5M UZS, ticket 35-80k UZS, 150-350 customers/day
- Bakery: COGS 32-40%, payroll 14-20M UZS, opex 4-6M UZS, ticket 18-35k UZS, 200-400 customers/day
- Beauty salon: COGS 18-28%, payroll 25-40M UZS, opex 4-7M UZS, ticket 120-300k UZS, 15-40 customers/day

Rules:
- monthly_revenue = avg_ticket × customers/day × 30
- gross_profit = revenue × (1 - cogs_pct/100)
- monthly_opex = rent + payroll + other_opex
- monthly_net = gross_profit - monthly_opex
- breakeven_month: capital / max(net, 1) when net > 0; 36 when net <= 0
- burn_rate_m_uzs: max(0, -monthly_net) before breakeven, else 0
- roi_12mo_pct: (12 × monthly_net - capital) / capital × 100 (clamped to [-50, 80])
- gross_margin_pct: 100 - cogs_pct
- score (viability 0-100): higher when (a) breakeven < 9 months, (b) ROI > 15%, (c) rent burden < 22%
- rent_burden_pct = monthly_rent / monthly_revenue × 100
- assumptions list: each bullet must cite a number actually used.`;

export async function analyzeFinancials(req: FinancialsAgentRequest): Promise<FinancialsAgentResult> {
  const lines = [
    `- Business: ${req.business_name ? `"${req.business_name}" — ` : ""}${req.business_type} (${req.format ?? "standard"} format)`,
    `- District: ${req.district}`,
    req.description ? `- Concept: ${req.description}` : "",
    `- Startup capital: ${(req.startup_capital_uzs / 1_000_000).toFixed(0)}M UZS`,
    req.loan_uzs        ? `- Loan requested: ${(req.loan_uzs / 1_000_000).toFixed(0)}M UZS over ${req.repayment_months ?? 24} months` : "",
    req.monthly_rent_uzs   ? `- Monthly rent: ${(req.monthly_rent_uzs / 1_000_000).toFixed(1)}M UZS` : "",
    req.average_ticket_uzs ? `- Average ticket: ${req.average_ticket_uzs.toLocaleString()} UZS` : "",
    req.expected_customers_per_day ? `- Customers/day target: ${req.expected_customers_per_day}` : "- Customers/day: infer from ticket and benchmarks",
    req.site_size_sqm      ? `- Site size: ${req.site_size_sqm} sqm` : "",
    req.other_monthly_costs_m_uzs ? `- Other monthly costs (utilities/marketing/etc.): ${req.other_monthly_costs_m_uzs}M UZS` : "",
    req.revenue_ramp_months ? `- Revenue ramp: ${req.revenue_ramp_months} months until full capacity` : "",
  ].filter(Boolean);

  const prompt = `Run the viability evaluation for:
${lines.join("\n")}

If the concept implies a premium positioning (e.g. specialty, organic, premium, boutique), pick from the upper end of the COGS / payroll ranges. Mass / value positioning → lower end.
Return the structured viability snapshot.`;

  const resp = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
      temperature: 0.3,
    },
  });

  const data = JSON.parse(resp.text ?? "{}") as FinancialsAgentResult;
  // Normalise common scale drift
  if (data.burn_rate_m_uzs > 1000) data.burn_rate_m_uzs = Math.round(data.burn_rate_m_uzs / 1_000_000);
  return data;
}
