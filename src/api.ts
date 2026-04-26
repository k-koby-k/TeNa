// Tiny client for the Hono backend. Vite proxies /api/* in dev.

export type ChatTurn = { role: "user" | "assistant"; text: string };

export interface ChatRequest {
  scenario_id: string;
  history: ChatTurn[];
  message: string;
  scenario_context?: string;
}
export interface ChatResponse { reply: string; model_version: string }

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

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type ShortVerdict = "YES" | "MAYBE" | "NO";

export interface MarketBlock { tam_b_uzs: number; sam_b_uzs: number; som_b_uzs: number; saturation_index: number; score: number; }
export interface DemandBlock { forecast_index: number[]; peak_periods: string[]; off_peak_dip_pct: number; score: number; }
export interface LocationBlock { foot_traffic_per_day: number; competitors_within_500m: number; walkability: number; visibility: number; score: number; }
export interface FinancialBlock { breakeven_month: number; burn_rate_m_uzs: number; roi_12mo_pct: number; gross_margin_pct: number; score: number; }
export interface CompetitionBlock { direct_competitors: number; competitor_density_index: number; failure_probability_pct: number; risk_level: RiskLevel; score: number; }
export interface CreditBlock { suggested_loan_m_uzs: number; dti: number; credit_readiness: number; product: string; score: number; }
export interface FactorList { positives: string[]; risks: string[]; next_actions: string[]; }
export interface Verdict { label: string; short_label: ShortVerdict; confidence: number; composite_score: number; blurb: string; }
export interface ModelMeta { id: string; name: string; version: string; confidence: number; last_retrain: string; }

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

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${path} ${r.status}: ${detail.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

export interface HistoryItem {
  scenario_id: string;
  business_type: string;
  location: string;
  short_label: ShortVerdict;
  composite_score: number;
  created_at: string;
}
export interface HistoryEntry {
  scenario_id: string;
  business_type: string;
  location: string;
  short_label: ShortVerdict;
  composite_score: number;
  created_at: string;
  request: AnalyzeRequest;
  response: AnalyzeResponse;
}

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}

// ---- agent payloads ----

export interface LocationAgentRequest {
  lat: number; lng: number;
  business_type: string;
  format?: string;
  business_name?: string;
  description?: string;
  site_size_sqm?: number;
  monthly_rent_uzs?: number;
  operating_hours?: "short" | "standard" | "long" | "24h";
}
export interface LocationCompetitor { name: string | null; kind: string; distance_m: number; lat: number; lng: number; }
export interface LocationAnchor     { name: string | null; type: string; distance_m: number; lat: number; lng: number; }
export interface LocationAgentResult {
  foot_traffic_per_day: number; competitors_within_500m: number; competitors_within_1km: number;
  walkability: number; visibility: number; score: number;
  competitors: LocationCompetitor[]; anchors: LocationAnchor[];
  rationale: string[]; sparse_data: boolean;
  district: string | null; neighborhood: string | null; road: string | null; display_address: string;
}

export interface PlaceHit { display: string; lat: number; lng: number; type: string; importance: number; }

export interface SynthesizeResult {
  blurb: string;
  positives: string[];
  risks: string[];
  next_actions: string[];
  bank_product: string;
  bank_conditions: string[];
}

export interface MarketAgentRequest {
  brief: string;
  district?: string;
  business_type?: string;
  business_name?: string;
  format?: string;
  target_audience?: string;
  price_tier?: "value" | "mid" | "premium";
  average_ticket_uzs?: number;
  customers_per_day?: number;
  marketing_reach?: string;
  comparable_competitor?: string;
  niche?: string;
}
export interface MarketAgentResult {
  understood: { business_type: string; niche: string; customer_segment: string; geography: string; };
  tam_b_uzs: number; sam_b_uzs: number; som_b_uzs: number;
  saturation_index: number; niche_fit: string; score: number;
  rationale: string[]; follow_up_questions: string[];
}

export interface FinancialsAgentRequest {
  business_type: string; district: string; format?: string;
  business_name?: string; description?: string;
  startup_capital_uzs: number; monthly_rent_uzs: number; average_ticket_uzs: number;
  expected_customers_per_day?: number;
}
export interface FinancialsAgentResult {
  breakeven_month: number; burn_rate_m_uzs: number; roi_12mo_pct: number;
  gross_margin_pct: number; score: number;
  inferred: { monthly_revenue_m_uzs: number; cogs_pct: number; payroll_m_uzs: number; other_opex_m_uzs: number; rent_burden_pct: number; };
  assumptions: string[];
}

export interface ExtractedProfile {
  business_name?: string;
  business_type?: string;
  format?: "kiosk" | "standard" | "premium";
  stage?: "idea" | "pilot" | "scale";
  description?: string;
  target_audience?: "office" | "residents" | "students" | "tourists" | "mixed";
  owner_experience?: "none" | "some" | "established";
  district?: string;
  niche?: string;
  budget_uzs?: number;
  monthly_rent_uzs?: number;
  loan_uzs?: number;
  average_ticket_uzs?: number;
  customers_per_day?: number;
  source_summary?: string;
  filled_fields: string[];
}

async function postFile<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(path, { method: "POST", body: fd });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${path} ${r.status}: ${detail.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  chat: (req: ChatRequest) => post<ChatResponse>("/api/chat", req),
  analyze: (req: AnalyzeRequest) => post<AnalyzeResponse>("/api/analyze", req),
  health: () => fetch("/api/health").then((r) => r.json()),
  history: () => getJSON<{ items: HistoryItem[] }>("/api/history"),
  historyEntry: (id: string) => getJSON<HistoryEntry>(`/api/history/${id}`),
  agentLocation:   (req: LocationAgentRequest)   => post<LocationAgentResult>("/api/agent/location", req),
  agentMarket:     (req: MarketAgentRequest)     => post<MarketAgentResult>("/api/agent/market", req),
  agentFinancials: (req: FinancialsAgentRequest) => post<FinancialsAgentResult>("/api/agent/financials", req),
  agentSynthesize: (req: any) => post<SynthesizeResult>("/api/agent/synthesize", req),
  geocodeSearch:   (q: string) => getJSON<{ items: PlaceHit[] }>(`/api/geocode/search?q=${encodeURIComponent(q)}`),
  extractProfile:  (file: File) => postFile<ExtractedProfile>("/api/agent/extract-profile", file),
};
