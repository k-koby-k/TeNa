// Borrower & Loan summary — uses values the user already entered on the
// Profile and Financials screens, plus simple deal-economics math (monthly
// payment, total interest, DSCR). Nothing hardcoded.

import { useMemo } from "react";
import { User, Banknote, PieChart } from "lucide-react";
import clsx from "clsx";
import { useScenario } from "../state";

const SQB_NOMINAL_RATE = 0.22; // typical Tashkent SME nominal annual rate; surface this so the user sees the assumption.

export function BorrowerLoanCard() {
  const { inputs, result } = useScenario();

  const deal = useMemo(() => {
    const principal = inputs.loan_uzs;
    const tenor = inputs.repayment_months || 24;
    const grace = inputs.grace_period_months || 0;
    const r = SQB_NOMINAL_RATE / 12;
    // Standard amortising formula over (tenor - grace) months.
    const payments = Math.max(1, tenor - grace);
    const monthly = principal > 0 && r > 0
      ? Math.round((principal * r) / (1 - Math.pow(1 + r, -payments)))
      : 0;
    const totalInterest = monthly * payments - principal;
    // Debt-Service Coverage: how many times the inferred monthly net income
    // covers the loan payment. Pull from financial agent's inferred numbers.
    const monthlyNetM =
      (result?.financial.gross_margin_pct ?? 0) > 0 && (inputs.average_ticket_uzs * inputs.customers_per_day) > 0
        ? Math.max(0,
            (inputs.average_ticket_uzs * inputs.customers_per_day * 30 / 1_000_000)
            * (result!.financial.gross_margin_pct / 100)
            - inputs.monthly_rent_uzs / 1_000_000
            - (inputs.other_monthly_costs_m_uzs ?? 0))
        : 0;
    const dscr = monthly > 0 ? Number((monthlyNetM * 1_000_000 / monthly).toFixed(2)) : 0;
    return { principal, tenor, grace, monthly, totalInterest, dscr, monthlyNetM };
  }, [inputs, result]);

  const useOfFunds = [
    { k: "Equipment",     v: inputs.use_equipment_pct,        c: "bg-petrol" },
    { k: "Renovations",   v: inputs.use_renovation_pct,       c: "bg-teal" },
    { k: "Inventory",     v: inputs.use_inventory_pct,        c: "bg-emerald" },
    { k: "Working cap.",  v: inputs.use_working_capital_pct,  c: "bg-amber" },
    { k: "Marketing",     v: inputs.use_marketing_pct,        c: "bg-rose-400" },
  ];
  const useTotal = useOfFunds.reduce((a, b) => a + b.v, 0);
  const capitalBase = inputs.budget_uzs + inputs.loan_uzs;

  const fmt = (n: number) => n ? n.toLocaleString("en-US").replace(/,/g, " ") : "—";

  return (
    <div className="card p-5 grid grid-cols-3 gap-5">
      {/* Borrower */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-petrol/10 text-petrol grid place-items-center">
            <User size={15} />
          </div>
          <div className="font-display font-semibold text-navy">Borrower & founder</div>
        </div>
        <dl className="text-[12.5px] space-y-1.5">
          <Row k="Name"          v={inputs.business_name || "—"} />
          <Row k="Stage"         v={cap(inputs.stage) || "—"} />
          <Row k="Owner xp"      v={cap(inputs.owner_experience) || "—"} />
          <Row k="Years in industry" v={inputs.years_in_industry ? `${inputs.years_in_industry}y` : "—"} />
          <Row k="Prior businesses"  v={`${inputs.prior_businesses_count} (${inputs.prior_business_failures} failed)`} />
          <Row k="Legal entity"  v={legalLabel(inputs.legal_entity)} />
          <Row k="Headcount"     v={inputs.has_employees_planned ? `${inputs.has_employees_planned}` : "—"} />
          <Row k="Dependents"    v={inputs.dependents_count ? `${inputs.dependents_count}` : "—"} />
        </dl>
      </div>

      {/* Loan deal economics */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-petrol/10 text-petrol grid place-items-center">
            <Banknote size={15} />
          </div>
          <div className="font-display font-semibold text-navy">Loan ask & deal terms</div>
        </div>
        <dl className="text-[12.5px] space-y-1.5">
          <Row k="Principal"     v={`${fmt(deal.principal)} UZS`} />
          <Row k="Founder cap."  v={`${fmt(inputs.budget_uzs)} UZS`} />
          <Row k="Tenor"         v={deal.tenor ? `${deal.tenor} months` : "—"} />
          <Row k="Grace"         v={deal.grace ? `${deal.grace} months` : "—"} />
          <Row k="Frequency"     v={cap(inputs.repay_freq)} />
          <Row k="Monthly pay·t" v={deal.monthly ? `${fmt(deal.monthly)} UZS` : "—"} hint="@ 22% p.a." />
          <Row k="Total interest" v={deal.totalInterest > 0 ? `${fmt(Math.round(deal.totalInterest))} UZS` : "—"} />
          <Row
            k="DSCR"
            v={deal.dscr ? `${deal.dscr}×` : "—"}
            tone={deal.dscr >= 1.5 ? "good" : deal.dscr >= 1.1 ? "warn" : deal.dscr > 0 ? "bad" : undefined}
            hint="Net income ÷ payment"
          />
        </dl>
      </div>

      {/* Use of funds */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-petrol/10 text-petrol grid place-items-center">
            <PieChart size={15} />
          </div>
          <div className="font-display font-semibold text-navy">Use of funds</div>
        </div>
        {useTotal === 0 ? (
          <div className="text-[12px] text-muted">Not allocated yet.</div>
        ) : (
          <>
            <div className="h-3 w-full rounded-full bg-navy/[0.05] overflow-hidden flex mb-3">
              {useOfFunds.map((u) => u.v > 0 && (
                <div key={u.k} className={clsx("h-full transition-all", u.c)} style={{ width: `${u.v}%` }} />
              ))}
            </div>
            <ul className="space-y-1 text-[12px]">
              {useOfFunds.map((u) => (
                <li key={u.k} className="flex items-center gap-2">
                  <span className={clsx("w-2 h-2 rounded-sm shrink-0", u.c, !u.v && "opacity-30")} />
                  <span className={clsx("flex-1 text-navy", !u.v && "text-muted")}>{u.k}</span>
                  <span className="font-mono text-navy text-[11px] w-12 text-right">{u.v}%</span>
                  <span className="text-muted text-[10px] w-20 text-right">
                    {capitalBase > 0 && u.v > 0 ? `${(capitalBase * u.v / 100 / 1_000_000).toFixed(0)}M` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-[10px] text-muted mt-2">
              Capital base: {fmt(capitalBase)} UZS · {useTotal === 100 ? "100% allocated" : `${useTotal}% allocated`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : "";
const legalLabel = (e: string) => ({
  unregistered: "Unregistered",
  sole_prop: "Sole proprietor",
  llc: "LLC",
  joint_stock: "Joint-stock",
} as Record<string, string>)[e] || "—";

function Row({ k, v, hint, tone }: { k: string; v: string; hint?: string; tone?: "good" | "warn" | "bad" }) {
  const colour = tone === "good" ? "text-emerald" : tone === "warn" ? "text-amber" : tone === "bad" ? "text-rose-500" : "text-navy";
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline">
      <dt className="text-[11px] text-muted uppercase tracking-wider font-semibold">{k}</dt>
      <dd className={clsx("font-medium", colour)}>
        {v}
        {hint && <span className="text-muted text-[10px] font-normal ml-1">· {hint}</span>}
      </dd>
    </div>
  );
}
