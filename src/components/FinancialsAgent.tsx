// Financials screen — INPUT ONLY, loan-application grade.
// Asks the things a real bank credit officer needs:
//   1. Capital structure & use of funds
//   2. Collateral & guarantor
//   3. Personal debt service & dependents
//   4. Risk acknowledgement
//   5. Operating economics (other costs, ramp)
// All earlier facts (rent, ticket, etc.) are read from state — no double-asking.

import { Wallet, AlertTriangle, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { useScenario } from "../state";
import { debtService, equitySharePct, totalProjectCost } from "../finance";
import type { ViewKey } from "./Sidebar";
import { WizardSteps, WizardFooter } from "./Wizard";
import { useT } from "../i18n";

export function FinancialsAgent({ onChange }: { onChange: (v: ViewKey) => void }) {
  const { inputs, setInput } = useScenario();
  const t = useT();

  const fmt = (n: number) => (n ? n.toLocaleString("en-US").replace(/,/g, " ") : "");
  const parse = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

  const useOfFundsTotal =
    inputs.use_equipment_pct + inputs.use_renovation_pct + inputs.use_inventory_pct
    + inputs.use_working_capital_pct + inputs.use_marketing_pct;

  const ready = inputs.budget_uzs > 0 && inputs.loan_uzs >= 0 && inputs.monthly_rent_uzs > 0;

  const collateralTotal = inputs.collateral_items
    .reduce((a, c) => a + (c.appraised_value_uzs || 0), 0);
  const ltvPct = collateralTotal > 0 && inputs.loan_uzs > 0
    ? inputs.loan_uzs / collateralTotal : null;
  const ltvTone =
    ltvPct == null ? "bg-navy/5 text-muted"
    : ltvPct <= 0.7 ? "bg-emerald/10 text-emerald"
    : ltvPct <= 1.0 ? "bg-amber/10 text-amber"
    : "bg-rose-50 text-rose-600";

  const equityPct = equitySharePct(inputs.budget_uzs, inputs.loan_uzs);

  /** Live repayment box — shows the real instalment, so the founder sees the
   *  interest cost before submitting rather than after. */
  function RepaymentPreview() {
    if (!inputs.loan_uzs) return null;
    const svc = debtService(
      inputs.loan_uzs, inputs.interest_rate_pct, inputs.subsidy_rate_pct,
      inputs.repayment_months, inputs.grace_period_months,
    );
    return (
      <div className="mt-5 pt-5 border-t border-line">
        <div className="label mb-2">{t("Repayment at these terms")}</div>
        <div className="grid grid-cols-4 gap-3">
          <Mini k={t("Effective rate")} v={`${svc.effectiveRatePct.toFixed(1)}%`}
                sub={inputs.subsidy_rate_pct > 0 ? t("after compensation") : undefined} />
          <Mini k={t("Monthly payment")} v={`${(svc.peakPayment / 1_000_000).toFixed(1)}M`} sub={t("UZS / month")} />
          {inputs.grace_period_months > 0 && (
            <Mini k={t("During grace")} v={`${(svc.gracePayment / 1_000_000).toFixed(1)}M`} sub={t("interest only")} />
          )}
          <Mini k={t("Total interest")} v={`${(svc.totalInterest / 1_000_000).toFixed(1)}M`} sub={t("over the term")} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WizardSteps active="Financials" onChange={onChange} />

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
            <Wallet size={20} />
          </div>
          <div className="flex-1">
            <div className="label">{t("Step 4 · Financials & lending")}</div>
            <h1 className="font-display text-xl text-navy font-bold">{t("Capital, collateral and risk")}</h1>
            <p className="text-sm text-muted mt-0.5">
              {t("The same questions a credit officer would ask. The viability agent reads all of this from the Overview and produces breakeven, ROI, DTI and a recommended product.")}
            </p>
          </div>
        </div>
      </div>

      {/* Captured-so-far recap */}
      <div className="card p-4 bg-navy/[0.02]">
        <div className="grid grid-cols-4 gap-4 text-[12px]">
          <Recap k={t("Monthly rent")}   v={inputs.monthly_rent_uzs ? `${(inputs.monthly_rent_uzs/1_000_000).toFixed(1)}M UZS` : "—"} from={t("Location")} />
          <Recap k={t("Avg ticket")}     v={inputs.average_ticket_uzs ? `${fmt(inputs.average_ticket_uzs)} UZS` : "—"} from={t("Market")} />
          <Recap k={t("Customers/day")}  v={inputs.customers_per_day ? String(inputs.customers_per_day) : "—"} from={t("Market")} />
          <Recap k={t("Site size")}      v={inputs.site_size_sqm ? `${inputs.site_size_sqm} sqm` : "—"} from={t("Location")} />
        </div>
      </div>

      {/* Total project cost + own-funds share — bank form row 9. */}
      {(inputs.budget_uzs > 0 || inputs.loan_uzs > 0) && (
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-4">
            <Mini k={t("Total project cost")}
                  v={`${(totalProjectCost(inputs.budget_uzs, inputs.loan_uzs) / 1_000_000).toFixed(0)}M`}
                  sub={t("own funds + credit")} />
            <Mini k={t("Bank credit")} v={`${(inputs.loan_uzs / 1_000_000).toFixed(0)}M`} sub={t("UZS")} />
            <div className={clsx(
              "p-2.5 rounded-lg border",
              equityPct == null ? "bg-navy/[0.03] border-line"
              : equityPct >= 30 ? "bg-emerald/5 border-emerald/30"
              : equityPct >= 20 ? "bg-amber/5 border-amber/30"
              : "bg-rose-50 border-rose-200",
            )}>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{t("Own funds share")}</div>
              <div className="font-display font-bold text-navy text-[17px] leading-tight mt-0.5">
                {equityPct == null ? "—" : `${equityPct}%`}
              </div>
              <div className="text-[10px] text-muted mt-0.5">{t("state programmes expect 20–30%")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Capital + use of funds */}
      <Section title={t("Capital structure & use of funds")} subtitle={t("How much, from where, spent on what.")}>
        <div className="grid grid-cols-2 gap-5">
          <Field label={t("Founder capital injection")} hint={t("UZS · what you put in")} req>
            <input className="input" placeholder={t("e.g. 180 000 000")}
              value={fmt(inputs.budget_uzs)}
              onChange={(e) => setInput("budget_uzs", parse(e.target.value))} />
          </Field>
          <Field label={t("Loan amount requested")} hint={t("UZS · 0 if no loan")} req>
            <input className="input" placeholder={t("e.g. 120 000 000")}
              value={fmt(inputs.loan_uzs)}
              onChange={(e) => setInput("loan_uzs", parse(e.target.value))} />
          </Field>
          <Field label={t("Repayment horizon")} hint={t("months")}>
            <Seg options={["12","24","36","48","60"]}
              value={String(inputs.repayment_months)}
              onChange={(v) => setInput("repayment_months", Number(v))} />
          </Field>
          {/* State-backed programmes run long grace periods — the bank form's
              own example is 24 months on a 60-month loan. */}
          <Field label={t("Grace period")} hint={t("months without principal repayment")}>
            <Seg options={["0","2","3","6","12","24"]}
              value={String(inputs.grace_period_months)}
              onChange={(v) => setInput("grace_period_months", Number(v))} />
          </Field>
          <Field label={t("Repayment frequency")}>
            <Seg options={["Monthly","Quarterly"]}
              value={inputs.repay_freq === "monthly" ? "Monthly" : "Quarterly"}
              onChange={(v) => setInput("repay_freq", v.toLowerCase() as any)} />
          </Field>
          <Field label={t("Interest rate")} hint={t("% per year")} req>
            <input className="input" placeholder={t("e.g. 19.5")} inputMode="decimal"
              value={inputs.interest_rate_pct || ""}
              onChange={(e) => setInput("interest_rate_pct", Number(e.target.value) || 0)} />
          </Field>
          <Field label={t("State fund compensation")} hint={t("% subtracted from the rate")}>
            <input className="input" placeholder={t("e.g. 4.2")} inputMode="decimal"
              value={inputs.subsidy_rate_pct || ""}
              onChange={(e) => setInput("subsidy_rate_pct", Number(e.target.value) || 0)} />
          </Field>
        </div>

        {/* Live repayment maths — the numbers the credit officer checks. */}
        <RepaymentPreview />

        {/* Row 8 — what the credit actually buys. */}
        <div className="mt-5 pt-5 border-t border-line">
          <div className="flex items-end justify-between mb-3 gap-3">
            <div>
              <div className="label">{t("Goods and services to be purchased")}</div>
              <div className="text-[11px] text-muted">{t("The bank asks for the items themselves, not only percentages.")}</div>
            </div>
            <button
              onClick={() => setInput("purchase_items", [...inputs.purchase_items, { name: "", qty: 1, unit_cost_uzs: 0 }])}
              className="text-[11px] font-semibold text-petrol hover:underline"
            >{t("+ Add item")}</button>
          </div>
          {inputs.purchase_items.length === 0 && (
            <div className="text-[12px] text-muted italic">{t("No items yet — optional, but strengthens the application.")}</div>
          )}
          <div className="space-y-2">
            {inputs.purchase_items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_150px_32px] gap-2 items-center">
                <input className="input" placeholder={t("e.g. Coffee machine")}
                  value={it.name}
                  onChange={(e) => setInput("purchase_items", inputs.purchase_items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <input className="input text-center" placeholder={t("qty")} inputMode="numeric"
                  value={it.qty || ""}
                  onChange={(e) => setInput("purchase_items", inputs.purchase_items.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) || 0 } : x))} />
                <input className="input" placeholder={t("unit price, UZS")}
                  value={fmt(it.unit_cost_uzs)}
                  onChange={(e) => setInput("purchase_items", inputs.purchase_items.map((x, j) => j === i ? { ...x, unit_cost_uzs: parse(e.target.value) } : x))} />
                <button
                  onClick={() => setInput("purchase_items", inputs.purchase_items.filter((_, j) => j !== i))}
                  className="text-muted hover:text-rose-500 text-[16px] leading-none"
                  aria-label={t("Remove")}
                >×</button>
              </div>
            ))}
          </div>
          {inputs.purchase_items.length > 0 && (
            <div className="mt-2 text-[12px] text-navy font-semibold">
              {t("Items total")}: {fmt(inputs.purchase_items.reduce((a, x) => a + x.qty * x.unit_cost_uzs, 0))} {t("UZS")}
            </div>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-line">
          <div className="flex items-end justify-between mb-3 gap-3">
            <div>
              <div className="label">{t("Use of funds breakdown")}</div>
              <div className="text-[11px] text-muted">{t("How the total capital (founder + loan) is spent. Type % directly.")}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setInput("use_equipment_pct", 30);
                  setInput("use_renovation_pct", 20);
                  setInput("use_inventory_pct", 15);
                  setInput("use_working_capital_pct", 25);
                  setInput("use_marketing_pct", 10);
                }}
                className="text-[11px] px-2.5 py-1 border border-line rounded-md hover:bg-navy/5 text-navy"
              >{t("Use typical split")}</button>
              <button
                onClick={() => {
                  setInput("use_equipment_pct", 0);
                  setInput("use_renovation_pct", 0);
                  setInput("use_inventory_pct", 0);
                  setInput("use_working_capital_pct", 0);
                  setInput("use_marketing_pct", 0);
                }}
                className="text-[11px] px-2.5 py-1 border border-line rounded-md hover:bg-navy/5 text-muted"
              >{t("Clear")}</button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <PctInput label={t("Equipment")}     color="bg-petrol"
              value={inputs.use_equipment_pct} onChange={(v) => setInput("use_equipment_pct", v)} />
            <PctInput label={t("Renovations")}   color="bg-teal"
              value={inputs.use_renovation_pct} onChange={(v) => setInput("use_renovation_pct", v)} />
            <PctInput label={t("Inventory")}     color="bg-emerald"
              value={inputs.use_inventory_pct} onChange={(v) => setInput("use_inventory_pct", v)} />
            <PctInput label={t("Working cap.")}  color="bg-amber"
              value={inputs.use_working_capital_pct} onChange={(v) => setInput("use_working_capital_pct", v)} />
            <PctInput label={t("Marketing")}     color="bg-rose-400"
              value={inputs.use_marketing_pct} onChange={(v) => setInput("use_marketing_pct", v)} />
          </div>

          {/* Live stacked bar + total */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-muted">{t("Allocation preview")}</span>
              <span className={clsx(
                "font-semibold",
                useOfFundsTotal === 100 ? "text-emerald"
                : useOfFundsTotal > 100 ? "text-rose-500"
                : useOfFundsTotal === 0 ? "text-muted"
                : "text-amber"
              )}>
                {useOfFundsTotal === 100 ? t("100% allocated")
                  : useOfFundsTotal === 0 ? t("0% allocated")
                  : useOfFundsTotal > 100 ? `${useOfFundsTotal}% — ${useOfFundsTotal - 100}% ${t("over")}`
                  : `${useOfFundsTotal}% — ${100 - useOfFundsTotal}% ${t("remaining")}`}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-navy/[0.05] overflow-hidden flex">
              <Slice color="bg-petrol"   pct={inputs.use_equipment_pct} />
              <Slice color="bg-teal"     pct={inputs.use_renovation_pct} />
              <Slice color="bg-emerald"  pct={inputs.use_inventory_pct} />
              <Slice color="bg-amber"    pct={inputs.use_working_capital_pct} />
              <Slice color="bg-rose-400" pct={inputs.use_marketing_pct} />
            </div>
            <div className="mt-1 text-[10px] text-muted">
              {t("Capital base")}: {fmt(inputs.budget_uzs + inputs.loan_uzs)} UZS
              {(inputs.budget_uzs + inputs.loan_uzs) > 0 && useOfFundsTotal > 0 && (
                <> · ≈ {fmt(Math.round((inputs.budget_uzs + inputs.loan_uzs) * useOfFundsTotal / 100))} UZS {t("allocated")}</>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Collateral & guarantor — itemised, appraised (form row 12) */}
      <Section title={t("Collateral & guarantor")} subtitle={t("What secures the loan. The bank requires an independent appraisal per asset.")}>
        <div className="flex items-end justify-between mb-3 gap-3">
          <div>
            <div className="label">{t("Pledged assets")}</div>
            <div className="text-[11px] text-muted">{t("Each asset valued separately by an independent appraiser.")}</div>
          </div>
          <button
            onClick={() => setInput("collateral_items", [...inputs.collateral_items, { kind: "" as any, description: "", area_sqm: 0, appraised_value_uzs: 0, appraiser: "" }])}
            className="text-[11px] font-semibold text-petrol hover:underline"
          >{t("+ Add asset")}</button>
        </div>

        {inputs.collateral_items.length === 0 && (
          <div className="text-[12px] text-muted italic mb-3">{t("No collateral pledged — the loan will be assessed as unsecured.")}</div>
        )}

        <div className="space-y-3">
          {inputs.collateral_items.map((c, i) => {
            const upd = (patch: Partial<typeof c>) =>
              setInput("collateral_items", inputs.collateral_items.map((x, j) => j === i ? { ...x, ...patch } : x));
            return (
              <div key={i} className="p-3 rounded-lg border border-line bg-navy/[0.015]">
                <div className="grid grid-cols-[150px_1fr_32px] gap-2 items-start">
                  <select className="input" value={c.kind} onChange={(e) => upd({ kind: e.target.value as any })}>
                    <option value="">{t("Select…")}</option>
                    <option value="real_estate">{t("Real estate")}</option>
                    <option value="vehicle">{t("Vehicle")}</option>
                    <option value="equipment">{t("Equipment")}</option>
                    <option value="deposit">{t("Cash deposit")}</option>
                  </select>
                  <input className="input" placeholder={t("Description and address")}
                    value={c.description} onChange={(e) => upd({ description: e.target.value })} />
                  <button
                    onClick={() => setInput("collateral_items", inputs.collateral_items.filter((_, j) => j !== i))}
                    className="text-muted hover:text-rose-500 text-[16px] leading-none pt-2"
                    aria-label={t("Remove")}
                  >×</button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <input className="input" placeholder={t("appraised value, UZS")}
                    value={fmt(c.appraised_value_uzs)} onChange={(e) => upd({ appraised_value_uzs: parse(e.target.value) })} />
                  {c.kind === "real_estate" && (
                    <input className="input" placeholder={t("area, m²")} inputMode="decimal"
                      value={c.area_sqm || ""} onChange={(e) => upd({ area_sqm: Number(e.target.value) || 0 })} />
                  )}
                  <input className="input" placeholder={t("appraiser")}
                    value={c.appraiser} onChange={(e) => upd({ appraiser: e.target.value })} />
                </div>
              </div>
            );
          })}
        </div>

        {collateralTotal > 0 && (
          <div className="mt-3 text-[12px] text-navy font-semibold">
            {t("Total appraised value")}: {fmt(collateralTotal)} {t("UZS")}
            {inputs.loan_uzs > 0 && (
              <span className={clsx("ml-2 px-2 py-0.5 rounded text-[11px]", ltvTone)}>
                LTV {Math.round((inputs.loan_uzs / collateralTotal) * 100)}%
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 mt-5 pt-5 border-t border-line">
          <Field label={t("State guarantee fund used?")} hint={t("Entrepreneurship Support Fund")}>
            <YesNo value={inputs.state_guarantee_used} onChange={(v) => setInput("state_guarantee_used", v)} />
          </Field>
          <Field label={t("Already pledged elsewhere?")}>
            <YesNo value={inputs.collateral_pledged_elsewhere} onChange={(v) => setInput("collateral_pledged_elsewhere", v)} />
          </Field>
          <Field label={t("Co-signer / guarantor")}>
            <YesNo value={inputs.has_cosigner} onChange={(v) => setInput("has_cosigner", v)} />
          </Field>
          {inputs.has_cosigner && (
            <Field label={t("Co-signer relationship")}>
              <input className="input" placeholder={t("e.g. spouse, parent, business partner")}
                value={inputs.cosigner_relationship}
                onChange={(e) => setInput("cosigner_relationship", e.target.value)} />
            </Field>
          )}
        </div>
      </Section>

      {/* Section: trading history — bank form row 6 */}
      <Section title={t("Trading history")} subtitle={t("The bank asks for the last 12 months of account turnover.")}>
        <div className="grid grid-cols-2 gap-5">
          <Field label={t("Is the business already trading?")} hint={t("changes how the loan is assessed")}>
            <YesNo value={inputs.is_existing_business} onChange={(v) => setInput("is_existing_business", v)} />
          </Field>
          <Field label={t("Taxpayer ID (STIR)")} hint={t("optional · if already registered")}>
            <input className="input" placeholder={t("e.g. 303 909 808")}
              value={inputs.stir}
              onChange={(e) => setInput("stir", e.target.value)} />
          </Field>
        </div>
        {inputs.is_existing_business ? (
          <div className="grid grid-cols-2 gap-5 mt-4">
            <Field label={t("12-month turnover — credit (in)")} hint={t("UZS · money received")}>
              <input className="input" placeholder={t("e.g. 122 040 000")}
                value={fmt(inputs.turnover_12m_credit_uzs)}
                onChange={(e) => setInput("turnover_12m_credit_uzs", parse(e.target.value))} />
            </Field>
            <Field label={t("12-month turnover — debit (out)")} hint={t("UZS · money paid out")}>
              <input className="input" placeholder={t("e.g. 122 040 000")}
                value={fmt(inputs.turnover_12m_debit_uzs)}
                onChange={(e) => setInput("turnover_12m_debit_uzs", parse(e.target.value))} />
            </Field>
          </div>
        ) : (
          <div className="mt-3 text-[12px] text-muted italic">
            {t("New business — the agents will project revenue instead of reading turnover history.")}
          </div>
        )}
      </Section>

      {/* Section 3: Founder financial standing */}
      <Section title={t("Personal financial standing")} subtitle={t("Used for debt-to-income.")}>
        <div className="grid grid-cols-3 gap-5">
          <Field label={t("Existing debts")} hint={t("M UZS / month")}>
            <input className="input" placeholder={t("e.g. 2")}
              value={inputs.existing_monthly_debts_m_uzs || ""}
              onChange={(e) => setInput("existing_monthly_debts_m_uzs", Number(e.target.value) || 0)} />
          </Field>
          <Field label={t("Other monthly income")} hint={t("M UZS · salary, rentals, etc.")}>
            <input className="input" placeholder={t("e.g. 8")}
              value={inputs.other_monthly_income_m_uzs || ""}
              onChange={(e) => setInput("other_monthly_income_m_uzs", Number(e.target.value) || 0)} />
          </Field>
          <Field label={t("Dependents")} hint={t("people in the household")}>
            <input className="input" placeholder={t("e.g. 2")}
              value={inputs.dependents_count || ""}
              onChange={(e) => setInput("dependents_count", Number(e.target.value) || 0)} />
          </Field>
        </div>
      </Section>

      {/* Section 4: Risk acknowledgement */}
      <Section title={t("Risk acknowledgement")} subtitle={t("What's the worst case, and how do you cover it?")} tone="amber">
        <Field label={t("Top risk you've identified")} hint={t("in your own words")} full>
          <textarea className="input min-h-[70px] text-[13px] leading-snug"
            placeholder={t("e.g. Local saturation; weekend competition; supply-chain delays for premium beans")}
            value={inputs.top_risk_self_identified}
            onChange={(e) => setInput("top_risk_self_identified", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-5 mt-4">
          <Field label={t("Contingency runway")} hint={t("months of personal funds if revenue misses")}>
            <Seg options={["0","1","3","6","12"]}
              value={String(inputs.contingency_runway_months)}
              onChange={(v) => setInput("contingency_runway_months", Number(v))} />
          </Field>
          <Field label={t("Business insurance planned?")}>
            <YesNo value={inputs.business_insurance_planned} onChange={(v) => setInput("business_insurance_planned", v)} />
          </Field>
        </div>
      </Section>

      {/* Section 5: Operating economics */}
      <Section title={t("Operating economics")} subtitle={t("Run-rate costs the agent can't infer.")}>
        <div className="grid grid-cols-2 gap-5">
          <Field label={t("Other monthly costs")} hint={t("M UZS · utilities, software, accounting, cleaning")}>
            <input className="input" placeholder={t("e.g. 6")}
              value={inputs.other_monthly_costs_m_uzs || ""}
              onChange={(e) => setInput("other_monthly_costs_m_uzs", Number(e.target.value) || 0)} />
          </Field>
          <Field label={t("Revenue ramp")} hint={t("months until full capacity")}>
            <Seg options={["1","3","6","12"]}
              value={String(inputs.revenue_ramp_months || 3)}
              onChange={(v) => setInput("revenue_ramp_months", Number(v))} />
          </Field>
        </div>
      </Section>

      <WizardFooter
        active="Financials"
        onChange={onChange}
        currentDone={ready}
        doneHint={t("Provide founder capital, loan amount, and monthly rent to continue.")}
        nextHint={t("All inputs captured. Open the Overview to run the full agentic analysis.")}
      />
    </div>
  );
}

/* ---------- helpers ---------- */

function Section({ title, subtitle, tone, children }: { title: string; subtitle: string; tone?: "amber"; children: any }) {
  const Icon = tone === "amber" ? AlertTriangle : ShieldCheck;
  const colour = tone === "amber" ? "bg-amber/10 text-amber" : "bg-petrol/10 text-petrol";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={clsx("w-8 h-8 rounded-lg grid place-items-center", colour)}>
          <Icon size={16} />
        </div>
        <div>
          <div className="font-display font-bold text-navy">{title}</div>
          <div className="text-[12px] text-muted">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, req, full, children }: { label: string; hint?: string; req?: boolean; full?: boolean; children: any }) {
  return (
    <div className={clsx(full && "col-span-full")}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-semibold text-navy">
          {label}{req && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <div className="seg">
      {options.map((o) => (
        <div key={o} className={clsx("seg-btn", value === o && "seg-btn-active")} onClick={() => onChange(o)}>{t(o)}</div>
      ))}
    </div>
  );
}
function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <div className="seg">
      <div className={clsx("seg-btn", !value && "seg-btn-active")} onClick={() => onChange(false)}>{t("No")}</div>
      <div className={clsx("seg-btn",  value && "seg-btn-active")} onClick={() => onChange(true)}>{t("Yes")}</div>
    </div>
  );
}
function PctInput({ label, color, value, onChange }: { label: string; color: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={clsx("w-2 h-2 rounded-sm", color)} />
        <span className="text-[11px] font-semibold text-navy truncate">{label}</span>
      </div>
      <div className="relative">
        <input
          type="number" min={0} max={100} step={1}
          value={value || ""}
          placeholder="0"
          onChange={(e) => {
            const n = Math.max(0, Math.min(100, Number(e.target.value) || 0));
            onChange(n);
          }}
          className="input pr-7 text-center font-display font-bold"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted">%</span>
      </div>
    </div>
  );
}
function Slice({ color, pct }: { color: string; pct: number }) {
  if (!pct) return null;
  return <div className={clsx("h-full transition-all", color)} style={{ width: `${Math.min(100, pct)}%` }} />;
}
function Mini({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-navy/[0.03] border border-line">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold truncate">{k}</div>
      <div className="font-display font-bold text-navy text-[17px] leading-tight mt-0.5">{v}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
function Recap({ k, v, from }: { k: string; v: string; from: string }) {
  const ok = v !== "—";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{k}</div>
      <div className="text-navy font-medium mt-0.5 flex items-center gap-2">
        {v}
        <span className={clsx("text-[9px] px-1.5 py-0.5 rounded", ok ? "bg-emerald/10 text-emerald" : "bg-amber/10 text-amber")}>{from}</span>
      </div>
    </div>
  );
}
