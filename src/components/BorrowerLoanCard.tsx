// Borrower / loan / use-of-funds summaries — all driven by values the user
// already entered on the Profile and Financials screens, plus simple
// deal-economics math (monthly payment, total interest, DSCR). Nothing
// hardcoded.
//
// Split into two standalone cards on purpose: the business-owner identity gets
// its own clean card (so a banker can find "who is this?" instantly), and the
// loan economics + use-of-funds live in a separate card.

import { useMemo, type ReactNode } from "react";
import { User, Banknote, PieChart, Phone } from "lucide-react";
import clsx from "clsx";
import { useScenario } from "../state";
import { useT } from "../i18n";

const SQB_NOMINAL_RATE = 0.22; // typical Tashkent SME nominal annual rate; surface this so the user sees the assumption.

/* ---------------------------------------------------------------- *
 * Borrower & founder — its own card, business owner front and centre. *
 * ---------------------------------------------------------------- */
export function BorrowerCard() {
  const { inputs } = useScenario();
  const t = useT();
  const phone = inputs.contact_phone.trim();
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center shrink-0">
          <User size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="label">{t("Business owner")}</div>
          <div className="font-display font-bold text-navy text-lg leading-tight">
            {inputs.contact_name || "—"}
          </div>
          <div className="text-[12.5px] text-muted">
            {inputs.business_name || t("Unnamed business")}
            {inputs.business_type ? <> · {inputs.business_type}</> : null}
          </div>
        </div>
        {phone && (
          <a
            href={telHref}
            className="no-print shrink-0 px-3 py-2 rounded-lg bg-petrol text-white text-[13px] font-semibold flex items-center gap-1.5 hover:bg-navy-700 transition shadow-soft"
          >
            <Phone size={14} /> {phone}
          </a>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2.5">
        <Row k={t("Stage")}             v={cap(inputs.stage) || "—"} />
        <Row k={t("Owner experience")}  v={cap(inputs.owner_experience) || "—"} />
        <Row k={t("Years in industry")} v={inputs.years_in_industry ? `${inputs.years_in_industry}y` : "—"} />
        <Row k={t("Legal entity")}      v={legalLabel(inputs.legal_entity)} />
        <Row k={t("Prior businesses")}  v={`${inputs.prior_businesses_count} (${inputs.prior_business_failures} failed)`} />
        <Row k={t("Planned headcount")} v={inputs.has_employees_planned ? `${inputs.has_employees_planned}` : "—"} />
        <Row k={t("Dependents")}        v={inputs.dependents_count ? `${inputs.dependents_count}` : "—"} />
        <Row k={t("Co-signer")}         v={inputs.has_cosigner ? t("Yes") : t("No")} />
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Loan ask, deal terms and use of funds.                            *
 * ---------------------------------------------------------------- */
export function LoanCard() {
  const { inputs, result } = useScenario();
  const t = useT();

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
    { k: t("Equipment"),     v: inputs.use_equipment_pct,        c: "bg-petrol" },
    { k: t("Renovations"),   v: inputs.use_renovation_pct,       c: "bg-teal" },
    { k: t("Inventory"),     v: inputs.use_inventory_pct,        c: "bg-emerald" },
    { k: t("Working cap."),  v: inputs.use_working_capital_pct,  c: "bg-amber" },
    { k: t("Marketing"),     v: inputs.use_marketing_pct,        c: "bg-rose-400" },
  ];
  const useTotal = useOfFunds.reduce((a, b) => a + b.v, 0);
  const capitalBase = inputs.budget_uzs + inputs.loan_uzs;

  const fmt = (n: number) => n ? n.toLocaleString("en-US").replace(/,/g, " ") : "—";

  return (
    <div className="card p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Loan deal economics */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-petrol/10 text-petrol grid place-items-center">
            <Banknote size={15} />
          </div>
          <div className="font-display font-semibold text-navy">{t("Loan ask & deal terms")}</div>
        </div>
        <dl className="text-[12.5px] space-y-1.5">
          <LineRow k={t("Principal")}     v={`${fmt(deal.principal)} UZS`} />
          <LineRow k={t("Founder cap.")}  v={`${fmt(inputs.budget_uzs)} UZS`} />
          <LineRow k={t("Tenor")}         v={deal.tenor ? `${deal.tenor} ${t("months")}` : "—"} />
          <LineRow k={t("Grace")}         v={deal.grace ? `${deal.grace} ${t("months")}` : "—"} />
          <LineRow k={t("Frequency")}     v={cap(inputs.repay_freq)} />
          <LineRow k={t("Monthly pay·t")} v={deal.monthly ? `${fmt(deal.monthly)} UZS` : "—"} hint="@ 22% p.a." />
          <LineRow k={t("Total interest")} v={deal.totalInterest > 0 ? `${fmt(Math.round(deal.totalInterest))} UZS` : "—"} />
          <LineRow
            k="DSCR"
            v={deal.dscr ? `${deal.dscr}×` : "—"}
            tone={deal.dscr >= 1.5 ? "good" : deal.dscr >= 1.1 ? "warn" : deal.dscr > 0 ? "bad" : undefined}
            hint={t("Net income ÷ payment")}
          />
        </dl>
      </div>

      {/* Use of funds */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-petrol/10 text-petrol grid place-items-center">
            <PieChart size={15} />
          </div>
          <div className="font-display font-semibold text-navy">{t("Use of funds")}</div>
        </div>
        {useTotal === 0 ? (
          <div className="text-[12px] text-muted">{t("Not allocated yet.")}</div>
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
              {t("Capital base")}: {fmt(capitalBase)} UZS · {useTotal === 100 ? t("100% allocated") : `${useTotal}% ${t("allocated")}`}
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

// Stacked label-over-value — used inside the borrower detail grid.
function Row({ k, v, tone }: { k: string; v: ReactNode; tone?: "good" | "warn" | "bad" }) {
  const colour = tone === "good" ? "text-emerald" : tone === "warn" ? "text-amber" : tone === "bad" ? "text-rose-500" : "text-navy";
  return (
    <div>
      <dt className="text-[11px] text-muted uppercase tracking-wider font-semibold">{k}</dt>
      <dd className={clsx("font-medium", colour)}>{v}</dd>
    </div>
  );
}

// Inline label-left / value-right — used inside the loan key/value list.
function LineRow({ k, v, hint, tone }: { k: string; v: ReactNode; hint?: string; tone?: "good" | "warn" | "bad" }) {
  const colour = tone === "good" ? "text-emerald" : tone === "warn" ? "text-amber" : tone === "bad" ? "text-rose-500" : "text-navy";
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-baseline">
      <dt className="text-[11px] text-muted uppercase tracking-wider font-semibold">{k}</dt>
      <dd className={clsx("font-medium", colour)}>
        {v}
        {hint && <span className="text-muted text-[10px] font-normal ml-1">· {hint}</span>}
      </dd>
    </div>
  );
}
