// Composite score policy — must mirror src/data.ts on the frontend.
// Market 20, Demand 20, Location 25, Financial 25, Risk 10 (inverted).

import type {
  MarketBlock, DemandBlock, LocationBlock, FinancialBlock,
  CompetitionBlock, Verdict,
} from "./schemas.js";

export function composite(
  m: MarketBlock, d: DemandBlock, l: LocationBlock,
  f: FinancialBlock, c: CompetitionBlock,
): number {
  const riskEff = 100 - c.score;  // higher risk score = worse
  const total =
    (m.score * 20 + d.score * 20 + l.score * 25 + f.score * 25 + riskEff * 10) / 100;
  return Math.round(total);
}

export function verdictFromScore(score: number, blurb: string): Verdict {
  let short: Verdict["short_label"]; let label: string;
  if (score >= 70) { short = "YES";   label = "Recommend Launch"; }
  else if (score >= 50) { short = "MAYBE"; label = "Proceed with caution"; }
  else { short = "NO"; label = "Not recommended"; }
  return {
    label, short_label: short,
    confidence: Math.min(95, 60 + Math.abs(score - 50)),
    composite_score: score,
    blurb,
  };
}
