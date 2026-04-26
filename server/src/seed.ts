// Seed the banker queue with plausible Tashkent SMEs so the demo isn't an
// empty list on first paint. Composite scores deliberately span YES / MAYBE
// / NO so the bucketed banker view is rich. All addresses & districts are
// real Tashkent locations.
//
// These are added to the in-memory store on server boot. They look exactly
// like real /analyze outputs (same shape) so the rest of the platform
// renders them correctly.

import type { AnalyzeRequest, AnalyzeResponse } from "./schemas.js";

interface Seed {
  business_name: string;
  business_type: string;
  district: string;
  format: "kiosk" | "standard" | "premium";
  description: string;
  capital_m: number;
  loan_m: number;
  rent_m: number;
  ticket: number;
  customers: number;
  market_score: number;
  location_score: number;
  financial_score: number;
  saturation: number;
  competitors_500m: number;
  foot_traffic: number;
  breakeven: number;
  burn: number;
  roi: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  failure_pct: number;
  blurb: string;
  positives: string[];
  risks: string[];
  next_actions: string[];
  bank_product: string;
  hours_ago: number; // when it was submitted, for the queue ordering
}

const SEEDS: Seed[] = [
  {
    business_name: "Black Bean Co.",
    business_type: "Coffee shop",
    district: "Chilonzor",
    format: "premium",
    description: "Premium specialty coffee with on-site roasting near Chilonzor metro, targeting young professionals.",
    capital_m: 180, loan_m: 120, rent_m: 14, ticket: 42_000, customers: 150,
    market_score: 82, location_score: 79, financial_score: 64, saturation: 61, competitors_500m: 7, foot_traffic: 850,
    breakeven: 7, burn: 32, roi: 18, risk_level: "Medium", failure_pct: 34,
    blurb: "Strong demand and good foot traffic at Chilonzor metro, but high rent burden and local saturation reduce upside.",
    positives: ["Strong card spend growth in cafe MCC inside 500m", "Evening + weekend traffic 1.4× district average", "Limited premium competitor coverage (3 within 500m)"],
    risks: ["Rent burden ≈ 22% of projected revenue", "Ramazon AOV dip ≈ 18%", "Competitor density elevated within 250m"],
    next_actions: ["Smaller initial loan (120M UZS)", "3-month working capital buffer", "Reassess after Q1 turnover"],
    bank_product: "SME working capital, 120M UZS, 24mo, 3mo grace",
    hours_ago: 0.2,
  },
  {
    business_name: "Yashil Pharma",
    business_type: "Pharmacy",
    district: "Yunusobod",
    format: "standard",
    description: "Neighbourhood pharmacy with 24/7 hours and home delivery within 2 km, serving residential blocks near Yunusobod metro.",
    capital_m: 220, loan_m: 90, rent_m: 9, ticket: 65_000, customers: 280,
    market_score: 88, location_score: 84, financial_score: 79, saturation: 48, competitors_500m: 3, foot_traffic: 1_200,
    breakeven: 5, burn: 18, roi: 32, risk_level: "Low", failure_pct: 14,
    blurb: "Strong fundamentals across the board — low saturation, high foot traffic from residential blocks, and clear cash-flow runway.",
    positives: ["Pharmacy density only 3 within 500m vs city average 6", "24/7 operation captures off-hours demand", "Founder has prior pharmacy operating experience"],
    risks: ["Regulatory compliance burden for 24h drug dispensing", "Inventory financing tied up in narcotics license"],
    next_actions: ["Recommend Launch", "Standard SME term loan + working capital top-up", "License audit before disbursement"],
    bank_product: "SME term loan, 90M UZS, 36mo, 1mo grace",
    hours_ago: 1.5,
  },
  {
    business_name: "Toshkent Dental",
    business_type: "Dental clinic",
    district: "Mirzo Ulug'bek",
    format: "premium",
    description: "Premium dental clinic with implant + cosmetic services targeting upper-middle-class professionals.",
    capital_m: 450, loan_m: 280, rent_m: 22, ticket: 850_000, customers: 18,
    market_score: 76, location_score: 81, financial_score: 71, saturation: 42, competitors_500m: 2, foot_traffic: 600,
    breakeven: 9, burn: 45, roi: 24, risk_level: "Medium", failure_pct: 22,
    blurb: "Clear premium niche with strong unit economics — but heavy capex requires careful covenant on equipment depreciation.",
    positives: ["Average ticket 850k UZS vs neighbourhood mean 320k", "Limited premium competition (2 in 500m)", "Founder is established practitioner, 12 years experience"],
    risks: ["Equipment financing 60% of capex — collateralisation key", "18 patients/day target requires marketing ramp"],
    next_actions: ["Equipment lease + working capital combo", "Cap loan-to-equipment value at 80%", "Pre-disbursement marketing plan review"],
    bank_product: "Equipment leasing 200M + WC 80M, 48mo, 6mo grace",
    hours_ago: 3.2,
  },
  {
    business_name: "Sergeli Fitness Hub",
    business_type: "Gym",
    district: "Sergeli",
    format: "standard",
    description: "Mid-tier gym targeting residential blocks in Sergeli, basic equipment + group classes.",
    capital_m: 95, loan_m: 75, rent_m: 6, ticket: 45_000, customers: 80,
    market_score: 64, location_score: 58, financial_score: 42, saturation: 71, competitors_500m: 5, foot_traffic: 420,
    breakeven: 14, burn: 22, roi: 4, risk_level: "High", failure_pct: 52,
    blurb: "Saturated district, weak unit economics — recommended only with significant collateral and reduced loan ticket.",
    positives: ["Founder has 4 years industry experience", "Low rent burden ≈ 13%"],
    risks: ["5 competitors within 500m incl. 2 chain operators", "Membership churn in mid-tier segment averages 40%/year", "Equipment depreciation eats 18% of revenue annually"],
    next_actions: ["Reduce loan to 50M", "Require real-estate collateral", "12-month performance review before second tranche"],
    bank_product: "Secured SME loan, 50M UZS, 36mo, with covenant",
    hours_ago: 5.0,
  },
  {
    business_name: "Bibi-Khanym Bakery",
    business_type: "Bakery",
    district: "Yashnobod",
    format: "kiosk",
    description: "Quick-service bakery near a bus terminal, focused on morning commuters and breakfast snacks.",
    capital_m: 65, loan_m: 40, rent_m: 4, ticket: 18_000, customers: 320,
    market_score: 78, location_score: 82, financial_score: 73, saturation: 55, competitors_500m: 4, foot_traffic: 1_800,
    breakeven: 6, burn: 8, roi: 28, risk_level: "Low", failure_pct: 19,
    blurb: "Excellent foot traffic from transit anchor, low capex, and proven concept in adjacent district.",
    positives: ["1,800 daily foot traffic from bus terminal", "Concept already validated in Mirobod by same founder", "Capex < 65M UZS, low burn risk"],
    risks: ["Single-product focus — bread/pastry only", "Morning peak only, low afternoon utilisation"],
    next_actions: ["Recommend Launch", "Standard working-capital loan", "Optional second-location PoR after 6 months"],
    bank_product: "SME working capital, 40M UZS, 24mo, 0 grace",
    hours_ago: 8.0,
  },
  {
    business_name: "Style & Co. Salon",
    business_type: "Beauty salon",
    district: "Mirzo Ulug'bek",
    format: "premium",
    description: "High-end beauty salon offering hair, nails, and skincare with imported product lines.",
    capital_m: 140, loan_m: 80, rent_m: 11, ticket: 220_000, customers: 22,
    market_score: 71, location_score: 74, financial_score: 67, saturation: 58, competitors_500m: 4, foot_traffic: 750,
    breakeven: 8, burn: 16, roi: 21, risk_level: "Medium", failure_pct: 28,
    blurb: "Solid premium positioning, viable economics but staff retention is the binding constraint in beauty sector.",
    positives: ["Premium ticket size 220k UZS, well above district avg", "Anchor mall within 200m drives walk-by", "Owner has prior salon, established clientele"],
    risks: ["Beauty salon staff turnover sector avg ≈ 60%/yr", "Imported product margins exposed to UZS depreciation"],
    next_actions: ["Standard SME loan with FX hedging covenant", "Staff retention plan as soft covenant", "Quarterly margin review"],
    bank_product: "SME working capital, 80M UZS, 24mo, 2mo grace",
    hours_ago: 12.0,
  },
  {
    business_name: "Tashkent Petfood",
    business_type: "Pet shop",
    district: "Shaykhantakhur",
    format: "standard",
    description: "Pet shop combining food, accessories and grooming targeting middle-class apartment residents.",
    capital_m: 75, loan_m: 35, rent_m: 5, ticket: 95_000, customers: 35,
    market_score: 68, location_score: 65, financial_score: 58, saturation: 38, competitors_500m: 1, foot_traffic: 380,
    breakeven: 11, burn: 12, roi: 12, risk_level: "Medium", failure_pct: 31,
    blurb: "Underserved niche — only 1 direct competitor — but customer volume risk is real until awareness builds.",
    positives: ["Niche underserved: 1 competitor in 500m", "Adjacent grooming service adds margin", "Pet ownership in Tashkent rising 8% y/y"],
    risks: ["35 customers/day target ambitious without marketing budget", "Inventory perishables risk for premium foods"],
    next_actions: ["Smaller initial loan (35M)", "6-month marketing budget covenant", "Inventory turn audit at month 4"],
    bank_product: "SME working capital, 35M UZS, 24mo, 1mo grace",
    hours_ago: 16.0,
  },
  {
    business_name: "Mini-Mart Express",
    business_type: "Mini-market",
    district: "Chilonzor",
    format: "standard",
    description: "Convenience store on a busy residential block, focus on daily essentials and prepared foods.",
    capital_m: 110, loan_m: 90, rent_m: 8, ticket: 32_000, customers: 200,
    market_score: 58, location_score: 63, financial_score: 38, saturation: 78, competitors_500m: 9, foot_traffic: 950,
    breakeven: 18, burn: 15, roi: -3, risk_level: "Critical", failure_pct: 64,
    blurb: "Highly saturated block with 9 direct competitors within 500m — projected ROI negative under base assumptions.",
    positives: ["Foot traffic acceptable", "Founder has retail back-office experience"],
    risks: ["9 competitors within 500m including 2 chain stores", "Average mini-market margin 11% in Tashkent — already thin", "Loan-to-capital ratio 82%, high for thin margin business"],
    next_actions: ["Recommend Defer", "Suggest founder explore lower-saturation district", "Re-evaluate in 6 months"],
    bank_product: "Decline at proposed ticket — counter at 40M with covenant",
    hours_ago: 22.0,
  },
  {
    business_name: "Knigozavr Books",
    business_type: "Bookstore",
    district: "Yashnobod",
    format: "standard",
    description: "Independent bookstore with cafe corner, Russian + Uzbek literature, kids' section.",
    capital_m: 85, loan_m: 50, rent_m: 7, ticket: 75_000, customers: 28,
    market_score: 51, location_score: 60, financial_score: 35, saturation: 41, competitors_500m: 0, foot_traffic: 320,
    breakeven: 22, burn: 14, roi: -8, risk_level: "Critical", failure_pct: 71,
    blurb: "No direct competition but the category itself is structurally challenged — bookstore unit economics rarely viable in Tashkent.",
    positives: ["No direct competition within 500m"],
    risks: ["Category-wide decline in physical book sales", "28 customers/day at 75k ticket = 63M annual revenue, below break-even", "Cafe corner adds opex without proven margin"],
    next_actions: ["Recommend Decline", "Suggest founder pivot to cafe-first with books as anchor", "Re-evaluate model with stronger cafe revenue assumption"],
    bank_product: "Decline at current model",
    hours_ago: 28.0,
  },
  {
    business_name: "Aqua Restaurant",
    business_type: "Restaurant",
    district: "Yunusobod",
    format: "premium",
    description: "Premium seafood restaurant near business district, evening + weekend focus.",
    capital_m: 380, loan_m: 220, rent_m: 28, ticket: 380_000, customers: 45,
    market_score: 74, location_score: 77, financial_score: 62, saturation: 64, competitors_500m: 6, foot_traffic: 880,
    breakeven: 10, burn: 38, roi: 16, risk_level: "Medium", failure_pct: 31,
    blurb: "Premium concept with reasonable economics — but rent burden + ticket sensitivity make it a careful YES with conditions.",
    positives: ["Premium ticket 380k UZS vs district avg 240k", "Evening business district anchor solid", "Owner brings established culinary brand from Almaty"],
    risks: ["Rent burden ≈ 24%, above safe band 22%", "Premium restaurants in Tashkent have 35% 2-yr failure rate", "Imported seafood logistics risk"],
    next_actions: ["Approve with conditions", "Quarterly covenant on revenue trajectory", "FX hedging on imported supply"],
    bank_product: "SME term loan + WC, 220M UZS, 36mo, 3mo grace",
    hours_ago: 36.0,
  },
];

function buildEntry(s: Seed): { req: AnalyzeRequest; res: AnalyzeResponse } {
  const composite = Math.round(
    (s.market_score * 20 + s.location_score * 25 + s.financial_score * 25 + (100 - s.failure_pct) * 10) / 80,
  );
  const short_label: "YES" | "MAYBE" | "NO" =
    composite >= 70 ? "YES" : composite >= 50 ? "MAYBE" : "NO";
  const label =
    short_label === "YES" ? "Recommend Launch"
    : short_label === "MAYBE" ? "Proceed with caution"
    : "Not recommended";

  const created_at = new Date(Date.now() - s.hours_ago * 3600_000).toISOString();
  const idSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  const req: AnalyzeRequest = {
    business_type: s.business_type,
    district: s.district,
    city: "Tashkent",
    budget_uzs: s.capital_m * 1_000_000,
    loan_uzs: s.loan_m * 1_000_000,
    monthly_rent_uzs: s.rent_m * 1_000_000,
    format: s.format,
    notes: s.description,
  };

  const res: AnalyzeResponse = {
    request_id: `req_seed_${idSuffix}`,
    scenario_id: `SCN-SEED-${idSuffix}`,
    business_type: s.business_type,
    location: `${s.district}, Tashkent`,
    market: {
      tam_b_uzs: 80 + Math.round(s.market_score * 1.6),
      sam_b_uzs: Math.round((80 + s.market_score * 1.6) * 0.18),
      som_b_uzs: Math.round((80 + s.market_score * 1.6) * 0.06 * 10) / 10,
      saturation_index: s.saturation,
      score: s.market_score,
    },
    demand: { forecast_index: [], peak_periods: [], off_peak_dip_pct: 0, score: 0 },
    location_block: {
      foot_traffic_per_day: s.foot_traffic,
      competitors_within_500m: s.competitors_500m,
      walkability: 60 + Math.round(s.location_score * 0.3),
      visibility: 60 + Math.round(s.location_score * 0.25),
      score: s.location_score,
    },
    financial: {
      breakeven_month: s.breakeven,
      burn_rate_m_uzs: s.burn,
      roi_12mo_pct: s.roi,
      gross_margin_pct: 50 + Math.round(s.financial_score * 0.2),
      score: s.financial_score,
    },
    competition: {
      direct_competitors: s.competitors_500m,
      competitor_density_index: Math.min(100, s.competitors_500m * 12),
      failure_probability_pct: s.failure_pct,
      risk_level: s.risk_level,
      score: Math.round((s.saturation + Math.min(100, s.competitors_500m * 12)) / 2),
    },
    credit: {
      suggested_loan_m_uzs: s.loan_m,
      dti: Number((s.loan_m / Math.max(50, s.financial_score * 5)).toFixed(2)),
      credit_readiness: Math.max(20, s.financial_score + (s.format === "premium" ? 5 : 0)),
      product: s.bank_product,
      score: Math.max(20, s.financial_score + (s.format === "premium" ? 5 : 0)),
    },
    factors: {
      positives: s.positives,
      risks: s.risks,
      next_actions: s.next_actions,
    },
    verdict: {
      label, short_label, confidence: Math.min(95, 60 + Math.abs(composite - 50)),
      composite_score: composite, blurb: s.blurb,
    },
    models: [
      { id: "M-A1", name: "Market Sizing",          version: "live", confidence: 0.80, last_retrain: created_at.slice(0, 10) },
      { id: "M-A3", name: "Saturation Index",       version: "live", confidence: 0.78, last_retrain: created_at.slice(0, 10) },
      { id: "M-C1", name: "Location Score",         version: "live", confidence: 0.82, last_retrain: created_at.slice(0, 10) },
      { id: "M-D1", name: "Viability Check",        version: "live", confidence: 0.76, last_retrain: created_at.slice(0, 10) },
      { id: "M-E1", name: "Competitor Intelligence",version: "live", confidence: 0.84, last_retrain: created_at.slice(0, 10) },
      { id: "M-F1", name: "Credit Risk Score",      version: "derived", confidence: 0.72, last_retrain: created_at.slice(0, 10) },
    ],
  };

  // Hack: override the scenario_id and created_at to look like older records.
  // (record() in store.ts uses Date.now(); we need historical timestamps for
  //  the banker queue ordering.)
  return { req, res, _at: created_at } as any;
}

export function seedHistory(record: (req: AnalyzeRequest, res: AnalyzeResponse) => any) {
  // Insert in reverse chronological order so the oldest goes in first,
  // and unshift() puts the newest on top (matching real /analyze behaviour).
  const sorted = [...SEEDS].sort((a, b) => b.hours_ago - a.hours_ago);
  for (const s of sorted) {
    const { req, res, _at } = buildEntry(s) as any;
    const entry = record(req, res);
    // Override the timestamp so the banker view shows realistic recency.
    entry.created_at = _at;
  }
}
