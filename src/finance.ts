// Bank-grade loan math.
//
// Everything here exists because the real bank loan application form
// ("Лойиҳа паспорти" — Loyiha pasporti) asks for it. Row references below
// point at that form:
//   row 6  — Охирги 12 ойлик пул айланмаси (12-month turnover, D-t / K-t)
//   row 9  — Лойиҳанинг умумий суммаси = ўз маблағи + банк крединти
//   row 10 — Кредит фоизи (+ давлат жамғармаси компенсацияси)
//   row 11 — Кредит муддати (муддат + имтиёзли давр)
//   row 12 — Таъминот/гаров таркиби (мустақил баҳоловчи баҳолаган)
//
// Before this module the app computed a loan payment as `principal / months`,
// i.e. with no interest at all — which understated the monthly payment by
// ~21% at the form's own example terms (19.5% / 24 mo) and therefore
// understated DTI and overstated credit readiness.

/** Effective annual rate the borrower actually pays, after any state
 *  compensation (the form's example: 19.5% headline, 4.2% compensated by the
 *  Entrepreneurship Support Fund → 15.3% effective). Never negative. */
export function effectiveRatePct(interestRatePct: number, subsidyPct: number): number {
  return Math.max(0, (interestRatePct || 0) - (subsidyPct || 0));
}

/** Standard annuity (equal-instalment) payment.
 *  P·r / (1 − (1+r)^−n), degrading to P/n at zero interest. */
export function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = (annualRatePct || 0) / 100 / 12;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export interface DebtService {
  /** Interest-only instalment paid during the grace period. */
  gracePayment: number;
  /** Full instalment once principal amortisation starts — the number that
   *  matters for affordability, so DTI/DSCR are measured against it. */
  peakPayment: number;
  /** Total paid across the whole term (grace + amortisation). */
  totalPaid: number;
  /** Total interest cost over the life of the loan. */
  totalInterest: number;
  effectiveRatePct: number;
  amortMonths: number;
}

/** Monthly debt service, honouring the grace period the form asks for
 *  (row 11 — "60 ой (24 ой имтиёзли даври билан)").
 *  During grace the borrower services interest only; principal then amortises
 *  over the remaining months, which raises the later instalment. */
export function debtService(
  principal: number,
  interestRatePct: number,
  subsidyPct: number,
  termMonths: number,
  graceMonths: number,
): DebtService {
  const rate = effectiveRatePct(interestRatePct, subsidyPct);
  const grace = Math.max(0, Math.min(graceMonths || 0, Math.max(0, (termMonths || 0) - 1)));
  const amortMonths = Math.max(0, (termMonths || 0) - grace);
  const r = rate / 100 / 12;

  const gracePayment = principal > 0 ? principal * r : 0;
  const peakPayment = annuityPayment(principal, rate, amortMonths);
  const totalPaid = gracePayment * grace + peakPayment * amortMonths;

  return {
    gracePayment,
    peakPayment,
    totalPaid,
    totalInterest: Math.max(0, totalPaid - principal),
    effectiveRatePct: rate,
    amortMonths,
  };
}

/** Debt Service Coverage Ratio — annual net operating income ÷ annual debt
 *  service. The single most-used SME lending metric: ≥1.25 is conventionally
 *  approvable, <1.0 means the business cannot service the loan at all. */
export function dscr(annualNetOperatingIncome: number, monthlyDebtService: number): number | null {
  const annualService = (monthlyDebtService || 0) * 12;
  if (annualService <= 0) return null;
  return Number((annualNetOperatingIncome / annualService).toFixed(2));
}

export type Band = "good" | "warn" | "bad";

export function dscrBand(v: number | null): Band {
  if (v == null) return "good";
  if (v >= 1.25) return "good";
  if (v >= 1.0) return "warn";
  return "bad";
}

/** Loan-to-Value against independently appraised collateral (form row 12).
 *  Returns null when nothing is pledged — an unsecured loan has no LTV. */
export function ltv(loanUzs: number, collateralValueUzs: number): number | null {
  if (!collateralValueUzs || collateralValueUzs <= 0) return null;
  if (!loanUzs || loanUzs <= 0) return 0;
  return Number((loanUzs / collateralValueUzs).toFixed(2));
}

export function ltvBand(v: number | null): Band {
  if (v == null) return "warn";       // unsecured — not automatically "good"
  if (v <= 0.7) return "good";
  if (v <= 1.0) return "warn";
  return "bad";
}

/** Founder's own contribution as a share of total project cost (form row 9).
 *  State-backed programmes commonly require 20–30% — the form's own example
 *  is 2.0bn own / 6.6bn total = 30%. */
export function equityShare(ownFundsUzs: number, loanUzs: number): number | null {
  const total = (ownFundsUzs || 0) + (loanUzs || 0);
  if (total <= 0) return null;
  return Number(((ownFundsUzs || 0) / total).toFixed(3));
}

export function equitySharePct(ownFundsUzs: number, loanUzs: number): number | null {
  const s = equityShare(ownFundsUzs, loanUzs);
  return s == null ? null : Math.round(s * 100);
}

export function equityBand(pct: number | null): Band {
  if (pct == null) return "bad";
  if (pct >= 30) return "good";
  if (pct >= 20) return "warn";
  return "bad";
}

/** Rent as a share of monthly revenue. Green <15%, amber 15–25%, red >25% —
 *  the thresholds a credit officer applies by eye. */
export function rentBurdenPct(monthlyRentUzs: number, monthlyRevenueUzs: number): number | null {
  if (!monthlyRevenueUzs || monthlyRevenueUzs <= 0) return null;
  return Math.round(((monthlyRentUzs || 0) / monthlyRevenueUzs) * 100);
}

export function rentBurdenBand(pct: number | null): Band {
  if (pct == null) return "warn";
  if (pct < 15) return "good";
  if (pct <= 25) return "warn";
  return "bad";
}

/** Total project cost — the form states it as own funds + bank credit (row 9). */
export function totalProjectCost(ownFundsUzs: number, loanUzs: number): number {
  return (ownFundsUzs || 0) + (loanUzs || 0);
}
