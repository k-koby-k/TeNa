// Shared types between the API and (eventually) the frontend.
// Keep field names stable — the frontend's data.ts will consume the same shapes.

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type ShortVerdict = "YES" | "MAYBE" | "NO";

export interface AnalyzeRequest {
  business_type: string;
  district: string;
  city?: string;
  budget_uzs: number;
  loan_uzs?: number;
  monthly_rent_uzs?: number;
  format?: "kiosk" | "standard" | "premium";
  notes?: string;
}

export interface MarketBlock {
  tam_b_uzs: number; sam_b_uzs: number; som_b_uzs: number;
  saturation_index: number; score: number;
}
export interface DemandBlock {
  forecast_index: number[]; peak_periods: string[];
  off_peak_dip_pct: number; score: number;
}
export interface LocationBlock {
  foot_traffic_per_day: number; competitors_within_500m: number;
  walkability: number; visibility: number; score: number;
}
export interface FinancialBlock {
  breakeven_month: number; burn_rate_m_uzs: number;
  roi_12mo_pct: number; gross_margin_pct: number; score: number;
}
export interface CompetitionBlock {
  direct_competitors: number; competitor_density_index: number;
  failure_probability_pct: number; risk_level: RiskLevel; score: number;
}
export interface CreditBlock {
  suggested_loan_m_uzs: number; dti: number; credit_readiness: number;
  product: string; score: number;
}
export interface FactorList {
  positives: string[]; risks: string[]; next_actions: string[];
}
export interface Verdict {
  label: string;
  short_label: ShortVerdict;
  confidence: number;
  composite_score: number;
  blurb: string;
}
export interface ModelMeta {
  id: string; name: string; version: string;
  confidence: number; last_retrain: string;
}

export interface AnalyzeResponse {
  request_id: string;
  scenario_id: string;
  business_type: string;
  location: string;
  market: MarketBlock;
  demand: DemandBlock;
  location_block: LocationBlock;
  financial: FinancialBlock;
  competition: CompetitionBlock;
  credit: CreditBlock;
  factors: FactorList;
  verdict: Verdict;
  models: ModelMeta[];
}

export interface ChatTurn { role: "user" | "assistant"; text: string }
export interface ChatRequest {
  scenario_id: string;
  history: ChatTurn[];
  message: string;
  /**
   * Optional client-rendered summary of the current dashboard state.
   * When present, the server uses this for grounding instead of its
   * fallback demo block.
   */
  scenario_context?: string;
}
export interface ChatResponse {
  reply: string;
  model_version: string;
}
