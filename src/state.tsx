// Single source of truth for the live scenario.
// - `inputs` is what the user typed in any category form.
// - `result` is the most recent /api/analyze response (initially the canned
//   default — same shape the backend returns in mock mode).
// - `derived` produces the legacy data shapes the existing UI consumes,
//   so we don't have to rewrite every chart and card.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  AnalyzeRequest, AnalyzeResponse,
  LocationAgentResult, SynthesizeResult,
} from "./api";

// ---- inputs (what the forms write) ----

export type Stage         = "" | "idea" | "pilot" | "scale";
export type OwnerXp       = "" | "none" | "some" | "established";
export type Audience      = "" | "office" | "residents" | "students" | "tourists" | "mixed";
export type PriceTier     = "value" | "mid" | "premium";
export type Hours         = "" | "short" | "standard" | "long" | "24h";
export type SiteType      = "" | "street_front" | "inside_building" | "mall" | "basement";
export type Parking       = "" | "none" | "limited" | "good";
export type Reach         = "" | "walk_by" | "district" | "city" | "online_offline";
export type LegalEntity   = "" | "unregistered" | "sole_prop" | "llc" | "joint_stock";
export type SalesChannel  = "" | "storefront" | "storefront_online" | "online_only" | "b2b";
export type Collateral    = "" | "none" | "real_estate" | "vehicle" | "equipment" | "deposit";
export type RepayFreq     = "monthly" | "quarterly";

export interface ScenarioInputs {
  // ============ PROFILE — identity, concept, founder ============
  business_name: string;
  business_type: string;
  format: "kiosk" | "standard" | "premium";
  stage: Stage;
  description: string;
  target_audience: Audience;
  // Founder track record (real lender questions):
  owner_experience: OwnerXp;
  years_in_industry: number;
  prior_businesses_count: number;
  prior_business_failures: number;
  legal_entity: LegalEntity;
  has_employees_planned: number;       // headcount at launch

  // ============ LOCATION — site facts (no analysis here) ============
  pin_lat: number | null;
  pin_lng: number | null;
  city: string;
  district: string;     // auto-derived from map; user can override
  site_size_sqm: number;
  monthly_rent_uzs: number;
  operating_hours: Hours;
  site_type: SiteType;
  parking: Parking;
  lease_term_months: number;           // common ask in rental contracts
  rent_deposit_months: number;         // typical 1-3 in Tashkent

  // ============ MARKET — commercial plan ============
  niche: string;
  price_tier: PriceTier;               // defaults from format if not set
  average_ticket_uzs: number;
  customers_per_day: number;
  days_open_per_week: number;
  sales_channel: SalesChannel;
  marketing_reach: Reach;
  marketing_budget_m_uzs: number;
  differentiation_one_liner: string;
  comparable_competitor: string;

  // ============ FINANCIALS — loan-application grade ============
  // Capital structure
  budget_uzs: number;                  // founder capital injection
  loan_uzs: number;
  repayment_months: number;
  grace_period_months: number;
  repay_freq: RepayFreq;
  // Use of funds (must sum to ~100; UI shows the slider remainder)
  use_equipment_pct: number;
  use_renovation_pct: number;
  use_inventory_pct: number;
  use_working_capital_pct: number;
  use_marketing_pct: number;
  // Collateral & guarantor
  collateral_type: Collateral;
  collateral_value_uzs: number;
  collateral_pledged_elsewhere: boolean;
  has_cosigner: boolean;
  cosigner_relationship: string;
  // Personal financial standing (debt-service)
  existing_monthly_debts_m_uzs: number;
  other_monthly_income_m_uzs: number;
  dependents_count: number;
  // Risk acknowledgement
  top_risk_self_identified: string;
  contingency_runway_months: number;
  business_insurance_planned: boolean;
  // Operating economics
  other_monthly_costs_m_uzs: number;
  revenue_ramp_months: number;

  // --- Misc / legacy ---
  notes: string;
  payroll_m_uzs: number;
  cogs_pct: number;
  margin_pct: number;
  competitors_500m: number;
  walkability: number;
  visibility: number;
}

// First-paint defaults so the app doesn't open to a blank screen.
// Click "+ New analysis" to wipe back to EMPTY_INPUTS.
const DEFAULT_INPUTS: ScenarioInputs = {
  business_name: "Black Bean Co.", business_type: "Coffee shop",
  format: "premium", stage: "pilot",
  description: "Premium specialty coffee shop near Chilonzor metro, targeting young professionals with on-site roasting, evening dessert pairings and work-friendly seating.",
  target_audience: "office",
  owner_experience: "some", years_in_industry: 4,
  prior_businesses_count: 1, prior_business_failures: 0,
  legal_entity: "sole_prop", has_employees_planned: 4,

  pin_lat: 41.2756, pin_lng: 69.2036,
  city: "Tashkent", district: "Chilonzor",
  site_size_sqm: 75, monthly_rent_uzs: 14_000_000,
  operating_hours: "long", site_type: "street_front", parking: "limited",
  lease_term_months: 24, rent_deposit_months: 2,

  niche: "Specialty coffee", price_tier: "premium",
  average_ticket_uzs: 42_000, customers_per_day: 150,
  days_open_per_week: 7, sales_channel: "storefront",
  marketing_reach: "district", marketing_budget_m_uzs: 3,
  differentiation_one_liner: "On-site roasting and evening dessert pairings",
  comparable_competitor: "",

  budget_uzs: 180_000_000, loan_uzs: 120_000_000,
  repayment_months: 24, grace_period_months: 3, repay_freq: "monthly",
  use_equipment_pct: 35, use_renovation_pct: 25, use_inventory_pct: 15,
  use_working_capital_pct: 20, use_marketing_pct: 5,
  collateral_type: "deposit", collateral_value_uzs: 50_000_000,
  collateral_pledged_elsewhere: false,
  has_cosigner: false, cosigner_relationship: "",
  existing_monthly_debts_m_uzs: 2, other_monthly_income_m_uzs: 8,
  dependents_count: 2,
  top_risk_self_identified: "Local saturation and weekend competition",
  contingency_runway_months: 3, business_insurance_planned: true,
  other_monthly_costs_m_uzs: 6, revenue_ramp_months: 4,

  notes: "",
  payroll_m_uzs: 22, cogs_pct: 38, margin_pct: 22,
  competitors_500m: 7, walkability: 82, visibility: 74,
};

// Blank slate. business_type/district required; the rest are validated
// after a Profile is filled (see PROFILE_REQUIRED below).
const EMPTY_INPUTS: ScenarioInputs = {
  business_name: "", business_type: "", format: "standard",
  stage: "", description: "", target_audience: "",
  owner_experience: "", years_in_industry: 0,
  prior_businesses_count: 0, prior_business_failures: 0,
  legal_entity: "", has_employees_planned: 0,

  pin_lat: null, pin_lng: null, city: "Tashkent", district: "",
  site_size_sqm: 0, monthly_rent_uzs: 0,
  operating_hours: "", site_type: "", parking: "",
  lease_term_months: 0, rent_deposit_months: 0,

  niche: "", price_tier: "mid",
  average_ticket_uzs: 0, customers_per_day: 0,
  days_open_per_week: 0, sales_channel: "",
  marketing_reach: "", marketing_budget_m_uzs: 0,
  differentiation_one_liner: "", comparable_competitor: "",

  budget_uzs: 0, loan_uzs: 0,
  repayment_months: 24, grace_period_months: 0, repay_freq: "monthly",
  use_equipment_pct: 0, use_renovation_pct: 0, use_inventory_pct: 0,
  use_working_capital_pct: 0, use_marketing_pct: 0,
  collateral_type: "", collateral_value_uzs: 0,
  collateral_pledged_elsewhere: false,
  has_cosigner: false, cosigner_relationship: "",
  existing_monthly_debts_m_uzs: 0, other_monthly_income_m_uzs: 0,
  dependents_count: 0,
  top_risk_self_identified: "",
  contingency_runway_months: 0, business_insurance_planned: false,
  other_monthly_costs_m_uzs: 0, revenue_ramp_months: 0,

  notes: "",
  payroll_m_uzs: 0, cogs_pct: 0, margin_pct: 0,
  competitors_500m: 0, walkability: 0, visibility: 0,
};

// What the *Profile* step needs. (District is no longer asked here — it's
// auto-derived from the map pin on the Location screen.)
export const PROFILE_REQUIRED: Array<keyof ScenarioInputs> = [
  "business_name", "business_type", "description",
];
const PROFILE_LABELS: Record<string, string> = {
  business_name: "Business name",
  business_type: "Business type",
  description: "Description",
};
export function missingProfile(inputs: ScenarioInputs): string[] {
  return PROFILE_REQUIRED
    .filter((k) => !String(inputs[k] ?? "").trim())
    .map((k) => PROFILE_LABELS[k] ?? String(k));
}

export function isProfileComplete(inputs: ScenarioInputs): boolean {
  return missingProfile(inputs).length === 0;
}

/** Which agents have produced data we can show on the Overview. */
export interface CompletionState {
  profile: boolean;
  market: boolean;
  location: boolean;
  financials: boolean;
  /** anyMetric: at least one of market/location/financials is filled. */
  anyMetric: boolean;
  /** allMetrics: market AND location AND financials all filled. */
  allMetrics: boolean;
}
function deriveCompletion(inputs: ScenarioInputs, result: AnalyzeResponse | null): CompletionState {
  const profile = isProfileComplete(inputs);
  const market     = !!result && result.market.score > 0 && result.market.tam_b_uzs > 0;
  const location   = !!result && result.location_block.score > 0 && result.location_block.foot_traffic_per_day > 0;
  const financials = !!result && result.financial.score > 0 && result.financial.gross_margin_pct > 0;
  return {
    profile, market, location, financials,
    anyMetric: market || location || financials,
    allMetrics: market && location && financials,
  };
}

// ---- the canned default that matches the server's mock ----

const DEFAULT_RESULT: AnalyzeResponse = {
  request_id: "req_default",
  scenario_id: "SCN-2026-0481",
  business_type: "Coffee shop",
  location: "Chilonzor, Tashkent",
  market: { tam_b_uzs: 184, sam_b_uzs: 62, som_b_uzs: 8.4, saturation_index: 61, score: 82 },
  demand: {
    forecast_index: [92, 96, 101, 104, 108, 112, 117, 124, 119, 122, 130, 134],
    peak_periods: ["Navro'z (March)", "September back-to-office"],
    off_peak_dip_pct: 18, score: 74,
  },
  location_block: { foot_traffic_per_day: 850, competitors_within_500m: 7, walkability: 82, visibility: 74, score: 79 },
  financial: { breakeven_month: 7, burn_rate_m_uzs: 32, roi_12mo_pct: 18, gross_margin_pct: 62, score: 64 },
  competition: { direct_competitors: 7, competitor_density_index: 68, failure_probability_pct: 34, risk_level: "Medium", score: 61 },
  credit: { suggested_loan_m_uzs: 120, dti: 0.32, credit_readiness: 71, product: "SME working capital", score: 71 },
  factors: {
    positives: [
      "Strong card spend growth in cafe MCC inside 500m radius",
      "Evening + weekend traffic 1.4× district average",
      "Limited premium competitor coverage (3 within 500m)",
      "Borrower segment shows healthy 12-mo turnover trend",
    ],
    risks: [
      "Rent burden above safe threshold (~22% of projected revenue)",
      "Seasonality dip during Ramazon (~ -18% AOV)",
      "Competitor density elevated within 250m",
      "Repayment stress in conservative demand scenario",
    ],
    next_actions: [
      "Offer smaller initial loan, ~120M UZS",
      "Add 3-month working capital buffer",
      "Phased rollout, reassess after Q1 turnover",
      "Schedule RM advisory call within 7 days",
    ],
  },
  verdict: {
    label: "Proceed with caution", short_label: "MAYBE",
    confidence: 78, composite_score: 64,
    blurb: "Strong demand and good foot traffic at Chilonzor metro, but high rent burden and local saturation reduce upside.",
  },
  models: [
    { id: "M-A3", name: "Saturation Index",       version: "1.2.0", confidence: 0.81, last_retrain: "2026-03-15" },
    { id: "M-B1", name: "Demand Forecasting",     version: "1.4.0", confidence: 0.76, last_retrain: "2026-03-12" },
    { id: "M-C1", name: "Location Score",          version: "2.0.1", confidence: 0.79, last_retrain: "2026-03-18" },
    { id: "M-D1", name: "Viability Check",         version: "1.1.0", confidence: 0.72, last_retrain: "2026-03-10" },
    { id: "M-E1", name: "Competitor Intelligence", version: "1.3.0", confidence: 0.84, last_retrain: "2026-03-14" },
    { id: "M-F1", name: "Credit Risk Score",       version: "2.1.0", confidence: 0.77, last_retrain: "2026-03-17" },
  ],
};

// ---- derived shapes (computed from result; consumed by existing UI) ----

const MONTHS = ["May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr"];

export function deriveDashboard(r: AnalyzeResponse) {
  const scenario = {
    business: r.business_type,
    location: r.location,
    metro: r.location.split(",")[0] + " metro",
    recommendation: (r.verdict.short_label === "YES" ? "launch"
                  : r.verdict.short_label === "MAYBE" ? "caution"
                  : "no") as "launch" | "caution" | "no",
    confidence: r.verdict.confidence,
    blurb: r.verdict.blurb,
  };

  const tone = (s: number) => (s >= 70 ? "good" : s >= 50 ? "warn" : "bad") as "good" | "warn" | "bad";

  const marketReady     = r.market.score > 0 && r.market.tam_b_uzs > 0;
  const demandReady     = r.demand.score > 0 && r.demand.forecast_index.some((v) => v > 0);
  const locationReady   = r.location_block.score > 0 && r.location_block.foot_traffic_per_day > 0;
  const financialsReady = r.financial.score > 0 && r.financial.gross_margin_pct > 0;
  const creditReady     = r.credit.credit_readiness > 0;

  const kpis = [
    { label: "Market Opportunity", value: r.market.score,            model: "M-A1", tone: tone(r.market.score),               ready: marketReady },
    { label: "Demand Forecast",     value: r.demand.score,            model: "M-B1", tone: tone(r.demand.score),               ready: demandReady },
    { label: "Saturation Index",    value: r.market.saturation_index, model: "M-A3", tone: tone(100 - r.market.saturation_index), ready: marketReady },
    { label: "Location Score",      value: r.location_block.score,    model: "M-C1", tone: tone(r.location_block.score),       ready: locationReady },
    { label: "Viability Score",     value: r.financial.score,         model: "M-D1", tone: tone(r.financial.score),            ready: financialsReady },
    { label: "Credit Readiness",    value: r.credit.credit_readiness, model: "M-F1", tone: tone(r.credit.credit_readiness),    ready: creditReady },
  ];

  // Convert forecast_index into the actual/forecast split the chart expects.
  const splitAt = 6;
  const demandSeries = r.demand.forecast_index.map((v, i) => ({
    m: MONTHS[i] ?? `M${i+1}`,
    actual:   i <  splitAt ? v : (i === splitAt ? v : null),
    forecast: i >= splitAt ? v : null,
  }));

  const scoreFormula = [
    { block: "Market",    weight: 20, score: r.market.score,         ready: marketReady },
    { block: "Demand",    weight: 20, score: r.demand.score,         ready: demandReady },
    { block: "Location",  weight: 25, score: r.location_block.score, ready: locationReady },
    { block: "Financial", weight: 25, score: r.financial.score,      ready: financialsReady },
    { block: "Risk",      weight: 10, score: r.competition.score, inverted: true, ready: financialsReady },
  ];

  const composite = r.verdict.composite_score;
  const verdict = r.verdict.short_label === "YES"
    ? { label: "YES",   tone: "good" as const }
    : r.verdict.short_label === "MAYBE"
    ? { label: "MAYBE", tone: "warn" as const }
    : { label: "NO",    tone: "bad"  as const };

  const marketSize = [
    { tier: "TAM", value: r.market.tam_b_uzs, label: "Total addressable", sub: "Tashkent cafe segment" },
    { tier: "SAM", value: r.market.sam_b_uzs, label: "Serviceable",        sub: `${scenario.location.split(",")[0]} + adjacent districts` },
    { tier: "SOM", value: r.market.som_b_uzs, label: "Obtainable Y1",      sub: "Realistic year-1 share" },
  ];

  const headline: Record<string, { k: string; v: string }[]> = {
    Market: [
      { k: "TAM (Y1)",   v: `${r.market.tam_b_uzs}B UZS` },
      { k: "Saturation", v: `${r.market.saturation_index} / 100` },
      { k: "Niche fit",  v: "Premium · open" },
    ],
    Demand: [
      { k: "12-mo forecast", v: `${Math.round(((r.demand.forecast_index.at(-1)! / r.demand.forecast_index[0]) - 1) * 100)}%` },
      { k: "Peak periods",   v: r.demand.peak_periods[0] ?? "—" },
      { k: "Off-peak dip",   v: `-${r.demand.off_peak_dip_pct}% Ramazon` },
    ],
    Location: [
      { k: "Foot traffic",       v: `~${r.location_block.foot_traffic_per_day} / day` },
      { k: "Competitors 500m",   v: String(r.location_block.competitors_within_500m) },
      { k: "Walkability",        v: `${r.location_block.walkability} / 100` },
    ],
    Financials: [
      { k: "Breakeven",    v: `Month ${r.financial.breakeven_month}` },
      { k: "Burn rate",    v: `${r.financial.burn_rate_m_uzs}M UZS / mo` },
      { k: "ROI · 12mo",   v: `${r.financial.roi_12mo_pct >= 0 ? "+" : ""}${r.financial.roi_12mo_pct}%` },
      { k: "Gross margin", v: `${r.financial.gross_margin_pct}%` },
    ],
    Competition: [
      { k: "Failure prob.",      v: `${r.competition.failure_probability_pct}% · Y1` },
      { k: "Risk level",         v: r.competition.risk_level },
      { k: "Direct competitors", v: `${r.competition.direct_competitors} total` },
    ],
    Lending: [
      { k: "Suggested loan",   v: `${r.credit.suggested_loan_m_uzs}M UZS` },
      { k: "DTI",              v: r.credit.dti.toFixed(2) },
      { k: "Credit readiness", v: `${r.credit.credit_readiness} / 100` },
    ],
  };

  return {
    scenario, kpis, demandSeries, scoreFormula, composite, verdict,
    marketSize, headline,
    positives: r.factors.positives,
    risks: r.factors.risks,
    nextActions: r.factors.next_actions,
    bank: r.credit,
    models: r.models,
  };
}

// ---- context plumbing ----

interface Ctx {
  inputs: ScenarioInputs;
  setInput: <K extends keyof ScenarioInputs>(k: K, v: ScenarioInputs[K]) => void;
  result: AnalyzeResponse | null;
  setResult: (r: AnalyzeResponse) => void;
  buildAnalyzeRequest: () => AnalyzeRequest;
  reset: () => void;
  loadDemo: () => void;
  missing: string[];
  completion: CompletionState;
  hydrate: (req: AnalyzeRequest, res: AnalyzeResponse) => void;
  // Agent-specific outputs needed by the Overview view (map overlay, summary):
  locationAgent: LocationAgentResult | null;
  setLocationAgent: (r: LocationAgentResult | null) => void;
  synthesis: SynthesizeResult | null;
  setSynthesis: (r: SynthesizeResult | null) => void;
}

const ScenarioCtx = createContext<Ctx | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  // Inputs default to the demo so the forms aren't blank on first paint.
  // Result starts NULL so nothing on the Overview is hardcoded — every value
  // shown there must come from an agent.
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [locationAgent, setLocationAgent] = useState<LocationAgentResult | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesizeResult | null>(null);

  const value = useMemo<Ctx>(() => ({
    inputs,
    setInput: (k, v) => setInputs((s) => ({ ...s, [k]: v })),
    result,
    setResult,
    buildAnalyzeRequest: () => ({
      business_type: inputs.business_type,
      district: inputs.district,
      city: inputs.city,
      budget_uzs: inputs.budget_uzs,
      loan_uzs: inputs.loan_uzs || undefined,
      monthly_rent_uzs: inputs.monthly_rent_uzs || undefined,
      format: inputs.format,
      notes: inputs.notes || undefined,
    }),
    reset: () => {
      setInputs(EMPTY_INPUTS);
      setResult(null);
      setLocationAgent(null);
      setSynthesis(null);
    },
    loadDemo: () => {
      setInputs(DEFAULT_INPUTS);
      setResult(DEFAULT_RESULT);
    },
    locationAgent, setLocationAgent,
    synthesis, setSynthesis,
    hydrate: (req, res) => {
      setInputs((s) => ({
        ...s,
        business_type: req.business_type,
        district: req.district,
        city: req.city ?? s.city,
        format: req.format ?? s.format,
        budget_uzs: req.budget_uzs,
        loan_uzs: req.loan_uzs ?? 0,
        monthly_rent_uzs: req.monthly_rent_uzs ?? 0,
        notes: req.notes ?? "",
      }));
      setResult(res);
    },
    missing: missingProfile(inputs),
    completion: deriveCompletion(inputs, result),
  }), [inputs, result, locationAgent, synthesis]);

  return <ScenarioCtx.Provider value={value}>{children}</ScenarioCtx.Provider>;
}

export function useScenario(): Ctx {
  const v = useContext(ScenarioCtx);
  if (!v) throw new Error("useScenario must be used inside ScenarioProvider");
  return v;
}

export function useDerived() {
  const { result } = useScenario();
  return useMemo(() => (result ? deriveDashboard(result) : null), [result]);
}

/** Compact text summary the assistant can use as grounding context. */
export function renderScenarioContext(r: AnalyzeResponse | null): string {
  if (!r) return "(No analysis has been run yet. Ask the user to fill in the form and press Recompute.)";
  return _renderScenarioContext(r);
}
function _renderScenarioContext(r: AnalyzeResponse): string {
  return `SCENARIO ${r.scenario_id} — current dashboard state:
  Business:   ${r.business_type} (${r.location})
  Verdict:    ${r.verdict.label} · ${r.verdict.confidence}% confidence · composite ${r.verdict.composite_score}/100
  Block scores: Market ${r.market.score} · Demand ${r.demand.score} · Location ${r.location_block.score} · Viability ${r.financial.score} · Competition ${r.competition.score} · Credit ${r.credit.credit_readiness}
  Headline:
    TAM ${r.market.tam_b_uzs}B / SAM ${r.market.sam_b_uzs}B / SOM ${r.market.som_b_uzs}B UZS · Saturation ${r.market.saturation_index}
    Foot traffic ~${r.location_block.foot_traffic_per_day}/day, ${r.location_block.competitors_within_500m} competitors within 500m
    Breakeven month ${r.financial.breakeven_month}, burn ${r.financial.burn_rate_m_uzs}M UZS/mo, ROI@12mo ${r.financial.roi_12mo_pct}%, gross margin ${r.financial.gross_margin_pct}%
    Failure probability ${r.competition.failure_probability_pct}% (Y1), risk level ${r.competition.risk_level}
    Suggested loan ${r.credit.suggested_loan_m_uzs}M UZS, DTI ${r.credit.dti.toFixed(2)}, credit readiness ${r.credit.credit_readiness}
  Top positives: ${r.factors.positives.slice(0, 3).join("; ")}
  Top risks:     ${r.factors.risks.slice(0, 3).join("; ")}`;
}
