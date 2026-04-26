// Deterministic mock so the frontend can integrate before Vertex is wired.
import { randomBytes } from "node:crypto";
import type {
  AnalyzeRequest, AnalyzeResponse, ChatResponse,
} from "./schemas.js";
import { composite, verdictFromScore } from "./scoring.js";

// Tiny deterministic adjustments so the demo reacts to inputs without needing
// a live model. None of this is "intelligence" — it's just enough motion so
// the UI proves the round-trip works.
export function mockAnalyze(req: AnalyzeRequest): AnalyzeResponse {
  const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
  const districtBias: Record<string, number> = {
    Chilonzor: 0, Yunusobod: 5, Sergeli: -4, "Mirzo Ulug'bek": 2,
  };
  const formatBias = req.format === "premium" ? 4 : req.format === "kiosk" ? -3 : 0;
  const districtAdj = districtBias[req.district] ?? 0;

  // Rent burden as % of a rough monthly revenue proxy.
  // Budget is *startup capital*; assume monthly revenue ≈ budget / 3 for a
  // typical small SME (i.e. capital pays back over ~3 months of gross sales).
  const monthlyRevProxy = Math.max(1, req.budget_uzs / 3);
  const rentBurdenPct = req.monthly_rent_uzs ? (req.monthly_rent_uzs / monthlyRevProxy) * 100 : 22;
  const rentPenalty = clamp((rentBurdenPct - 18) * 1.5, 0, 25);

  const market = {
    tam_b_uzs: 184, sam_b_uzs: 62, som_b_uzs: 8.4,
    saturation_index: clamp(61 - districtAdj),
    score: clamp(82 + districtAdj + formatBias),
  };
  const demand = {
    forecast_index: [92, 96, 101, 104, 108, 112, 117, 124, 119, 122, 130, 134],
    peak_periods: ["Navro'z (March)", "September back-to-office"],
    off_peak_dip_pct: 18,
    score: clamp(74 + districtAdj),
  };
  const loc = {
    foot_traffic_per_day: 850 + districtAdj * 40,
    competitors_within_500m: 7,
    walkability: 82, visibility: 74,
    score: clamp(79 + districtAdj),
  };
  const fin = {
    breakeven_month: clamp(7 + Math.round(rentPenalty / 5), 4, 18),
    burn_rate_m_uzs: 32 + Math.round(rentPenalty / 2),
    roi_12mo_pct: clamp(18 - rentPenalty / 2, -10, 60),
    gross_margin_pct: 62,
    score: clamp(64 - rentPenalty),
  };
  const comp = {
    direct_competitors: 7,
    competitor_density_index: clamp(68 - districtAdj * 2),
    failure_probability_pct: clamp(34 + Math.round(rentPenalty / 2)),
    risk_level: (rentPenalty > 15 ? "High" : rentPenalty > 8 ? "Medium" : "Low") as "Low" | "Medium" | "High",
    score: clamp(61 + Math.round(rentPenalty / 3)),
  };
  const loanM = req.loan_uzs ? Math.round(req.loan_uzs / 1_000_000) : 120;
  const credit = {
    suggested_loan_m_uzs: loanM,
    dti: Number((loanM / 375).toFixed(2)),
    credit_readiness: clamp(71 - Math.max(0, loanM - 120) / 4),
    product: "SME working capital",
    score: clamp(71 - Math.max(0, loanM - 120) / 4),
  };

  const score = composite(market, demand, loc, fin, comp);
  const blurb =
    `Strong demand and good foot traffic at ${req.district} metro, but high ` +
    `rent burden and local saturation reduce upside.`;

  return {
    request_id: `req_${randomBytes(4).toString("hex")}`,
    scenario_id: "SCN-2026-0481",
    business_type: req.business_type,
    location: `${req.district}, ${req.city ?? "Tashkent"}`,
    market, demand, location_block: loc, financial: fin, competition: comp, credit,
    factors: {
      positives: [
        "Strong card spend growth in cafe MCC inside 500m radius",
        "Evening + weekend traffic 1.4x district average",
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
    verdict: verdictFromScore(score, blurb),
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

export function mockChat(message: string, context?: string): ChatResponse {
  const m = message.toLowerCase();
  // Pull a couple of grounding numbers out of the context if present.
  const grab = (re: RegExp) => context?.match(re)?.[1];
  const verdict = grab(/Verdict:\s+([^·\n]+)/)?.trim() ?? "Proceed with caution";
  const composite = grab(/composite\s+(\d+)/i) ?? "64";
  // The frontend's renderScenarioContext writes "Business: <type> (<district>, <city>)".
  const district = grab(/Business:.*?\(([^,)\n]+)/)?.trim()
                ?? grab(/Location:\s+([^,\n]+)/)?.trim()
                ?? "Chilonzor";

  let reply: string;
  if (m.includes("caution") || m.includes("why") || m.includes("recommendation")) {
    reply = `The recommendation is **${verdict}** at composite ${composite}/100. ` +
      `Strong demand and location signals are partially offset by viability and ` +
      `saturation. See the dashboard for per-block scores.`;
  } else if (m.includes("risk")) {
    reply = `Top risks for ${district}: rent burden, local saturation density, ` +
      `and Ramazon seasonality. Mitigation: smaller initial loan, 3-month ` +
      `buffer, phased rollout.`;
  } else if (m.includes("credit") || m.includes("readiness")) {
    reply = `Credit readiness can be lifted by trimming loan size, adding partial ` +
      `collateral, or sharing 6+ months of POS turnover.`;
  } else if (m.includes("compare") || m.includes("yunusobod") || m.includes("alternative")) {
    reply = `Yunusobod typically scores +5 on Market and Location vs ${district}, ` +
      `but rent benchmarks are ~18% higher — net effect roughly neutral on viability.`;
  } else {
    reply = `Grounded in the current ${district} scenario. Ask about the verdict, ` +
      `block scores, risks, credit readiness, or alternative locations.`;
  }
  return { reply, model_version: "mock-v1" };
}
