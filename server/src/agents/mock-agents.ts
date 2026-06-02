import type { LocationAgentResult } from "./location.js";
import type { MarketAgentRequest, MarketAgentResult } from "./market.js";
import type { FinancialsAgentRequest, FinancialsAgentResult } from "./financials.js";
import type { SynthesizeRequest, SynthesizeResult } from "./synthesize.js";
import type { PlaceHit } from "./geocode.js";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export function mockGeocodeSearch(q: string): { items: PlaceHit[] } {
  const items: PlaceHit[] = [
    { display: "Chilonzor metro, Chilonzor, Tashkent, Uzbekistan", lat: 41.2756, lng: 69.2036, type: "station", importance: 0.8 },
    { display: "Hamid Olimjon metro, Yunusobod, Tashkent, Uzbekistan", lat: 41.3170, lng: 69.2962, type: "station", importance: 0.76 },
    { display: "Magic City, Shaykhantakhur, Tashkent, Uzbekistan", lat: 41.3019, lng: 69.2682, type: "mall", importance: 0.7 },
    { display: "Yunusobod metro, Yunusobod, Tashkent, Uzbekistan", lat: 41.3637, lng: 69.2879, type: "station", importance: 0.68 },
    { display: "Mirzo Ulugbek district, Tashkent, Uzbekistan", lat: 41.3251, lng: 69.3361, type: "district", importance: 0.62 },
    { display: "Sergeli district, Tashkent, Uzbekistan", lat: 41.2225, lng: 69.2253, type: "district", importance: 0.58 },
  ];
  const needle = q.trim().toLowerCase();
  const matches = items.filter((x) => x.display.toLowerCase().includes(needle)).slice(0, 6);
  return { items: matches.length ? matches : items.slice(0, 4) };
}

export function mockLocationAgent(req: { lat: number; lng: number; business_type: string; format?: string }): LocationAgentResult {
  const premium = req.format === "premium";
  return {
    foot_traffic_per_day: premium ? 940 : 820,
    competitors_within_500m: premium ? 6 : 5,
    competitors_within_1km: premium ? 14 : 11,
    walkability: 82,
    visibility: premium ? 78 : 73,
    score: premium ? 79 : 74,
    competitors: [
      { name: "Caffeine", kind: "cafe", distance_m: 180, lat: req.lat + 0.0011, lng: req.lng + 0.0012 },
      { name: "Bon!", kind: "bakery", distance_m: 260, lat: req.lat - 0.0015, lng: req.lng + 0.0006 },
      { name: "Street Coffee", kind: "cafe", distance_m: 420, lat: req.lat + 0.0022, lng: req.lng - 0.001 },
      { name: "Local mini market", kind: "convenience", distance_m: 610, lat: req.lat - 0.0027, lng: req.lng - 0.0011 },
    ],
    anchors: [
      { name: "Metro station", type: "transit", distance_m: 210, lat: req.lat + 0.0008, lng: req.lng - 0.0007 },
      { name: "Office block", type: "office", distance_m: 340, lat: req.lat - 0.0012, lng: req.lng + 0.0014 },
      { name: "Retail corridor", type: "mall", distance_m: 520, lat: req.lat + 0.002, lng: req.lng + 0.0002 },
    ],
    rationale: [
      "Metro and office anchors within 350m support steady weekday traffic.",
      "Six direct competitors within 500m create visible saturation but not a red-zone cluster.",
      "Estimated 900+ daily pedestrian flow is enough for a premium SME format if rent is controlled.",
      "Street visibility is above average, but the site still needs launch marketing to stand out.",
    ],
    sparse_data: false,
    district: "Chilonzor",
    neighborhood: "Metro corridor",
    road: "Bunyodkor avenue",
    display_address: `Demo site near Chilonzor metro (${req.lat.toFixed(5)}, ${req.lng.toFixed(5)})`,
  };
}

export function mockMarketAgent(req: MarketAgentRequest): MarketAgentResult {
  const premium = req.price_tier === "premium" || req.format === "premium";
  const type = req.business_type || "SME retail";
  const ticket = req.average_ticket_uzs || 42_000;
  const customers = req.customers_per_day || 140;
  const impliedRevenueB = ticket * customers * 365 / 1_000_000_000;
  return {
    understood: {
      business_type: type,
      niche: req.niche || (premium ? "premium specialty format" : "neighborhood format"),
      customer_segment: req.target_audience || "mixed local customers",
      geography: req.district || "Tashkent",
    },
    tam_b_uzs: premium ? 184 : 128,
    sam_b_uzs: premium ? 62 : 44,
    som_b_uzs: Number(Math.max(3.5, impliedRevenueB).toFixed(1)),
    saturation_index: premium ? 61 : 54,
    niche_fit: premium ? "premium · open but competitive" : "mid-market · practical",
    score: premium ? 82 : 76,
    rationale: [
      `Ticket ${ticket.toLocaleString()} UZS and ${customers}/day imply about ${impliedRevenueB.toFixed(1)}B UZS annual revenue.`,
      "District-level SAM remains large enough for one disciplined new entrant.",
      "Saturation is moderate-high, so differentiation matters more than broad category demand.",
    ],
    follow_up_questions: [],
  };
}

export function mockFinancialsAgent(req: FinancialsAgentRequest): FinancialsAgentResult {
  const ticket = req.average_ticket_uzs || 42_000;
  const customers = req.expected_customers_per_day || 140;
  const rentM = (req.monthly_rent_uzs || 14_000_000) / 1_000_000;
  const revenueM = Math.round(ticket * customers * 30 / 1_000_000);
  const cogsPct = req.format === "premium" ? 36 : 40;
  const payrollM = req.format === "premium" ? 24 : 18;
  const otherM = req.other_monthly_costs_m_uzs || 6;
  const grossMarginPct = 100 - cogsPct;
  const netM = revenueM * (grossMarginPct / 100) - rentM - payrollM - otherM;
  const capitalM = Math.max(1, req.startup_capital_uzs / 1_000_000);
  const breakeven = netM > 0 ? clamp(capitalM / netM, 3, 24) : 36;
  const roi = clamp(((12 * netM - capitalM) / capitalM) * 100, -50, 80);
  const rentBurden = clamp((rentM / Math.max(1, revenueM)) * 100, 0, 60);
  const score = clamp(72 + (roi > 10 ? 6 : -6) - Math.max(0, rentBurden - 20));
  return {
    breakeven_month: breakeven,
    burn_rate_m_uzs: netM < 0 ? Math.round(Math.abs(netM)) : 0,
    roi_12mo_pct: roi,
    gross_margin_pct: grossMarginPct,
    score,
    inferred: {
      monthly_revenue_m_uzs: revenueM,
      cogs_pct: cogsPct,
      payroll_m_uzs: payrollM,
      other_opex_m_uzs: otherM,
      rent_burden_pct: rentBurden,
    },
    assumptions: [
      `${ticket.toLocaleString()} UZS ticket x ${customers}/day x 30 days gives about ${revenueM}M UZS monthly revenue.`,
      `${cogsPct}% COGS benchmark leaves ${grossMarginPct}% gross margin.`,
      `${rentM.toFixed(1)}M UZS rent is about ${rentBurden}% of monthly revenue.`,
      `${payrollM}M UZS payroll and ${otherM}M UZS other opex used for the viability score.`,
    ],
  };
}

export function mockSynthesis(req: SynthesizeRequest): SynthesizeResult {
  const verdict = req.short_label === "YES" ? "recommended" : req.short_label === "MAYBE" ? "conditionally supportable" : "not recommended";
  return {
    blurb: `${req.business_name || req.business_type} is ${verdict} at ${req.composite_score}/100. Location and market demand are credible, while saturation and rent discipline remain the main constraints for the credit officer.`,
    positives: [
      `Market score ${req.market.score}/100 with TAM around ${req.market.tam_b_uzs}B UZS.`,
      `Location score ${req.loc.score}/100 with about ${req.loc.foot_traffic_per_day} daily pedestrians.`,
      `Financial score ${req.financial.score}/100 with breakeven around month ${req.financial.breakeven_month}.`,
      `Credit readiness ${req.credit.credit_readiness}/100 supports a structured SME product.`,
    ],
    risks: [
      `${req.loc.competitors_within_500m} competitors within 500m require clear differentiation.`,
      `Saturation index ${req.market.saturation_index}/100 limits upside if pricing is weak.`,
      `ROI at 12 months is ${req.financial.roi_12mo_pct}%, so repayment should be monitored monthly.`,
      req.has_cosigner ? "Co-signer improves coverage, but collateral documentation still needs review." : "No co-signer means collateral and cash-flow evidence carry more weight.",
    ],
    next_actions: [
      "Issue a conditional pre-approval and request lease confirmation.",
      "Validate rent, POS assumptions, and supplier contracts before disbursement.",
      "Structure the facility with a 3-month working-capital buffer.",
      "Schedule relationship-manager follow-up after the first monthly turnover report.",
    ],
    bank_product: `SME working capital, ${req.credit.suggested_loan_m_uzs}M UZS, 24 months, 3-month grace`,
    bank_conditions: [
      "Lease and rent deposit documents verified before drawdown.",
      "Monthly POS turnover reporting for the first 6 months.",
      "Loan size capped if rent burden exceeds 22% of projected revenue.",
    ],
  };
}
