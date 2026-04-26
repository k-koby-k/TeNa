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
import type { ViewKey } from "./Sidebar";
import { WizardSteps, WizardFooter } from "./Wizard";

export function FinancialsAgent({ onChange }: { onChange: (v: ViewKey) => void }) {
  const { inputs, setInput } = useScenario();

  const fmt = (n: number) => (n ? n.toLocaleString("en-US").replace(/,/g, " ") : "");
  const parse = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

  const useOfFundsTotal =
    inputs.use_equipment_pct + inputs.use_renovation_pct + inputs.use_inventory_pct
    + inputs.use_working_capital_pct + inputs.use_marketing_pct;

  const ready = inputs.budget_uzs > 0 && inputs.loan_uzs >= 0;

  return (
    <div className="space-y-5">
      <WizardSteps active="Financials" onChange={onChange} />

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
            <Wallet size={20} />
          </div>
          <div className="flex-1">
            <div className="label">Step 4 · Financials & lending</div>
            <h1 className="font-display text-xl text-navy font-bold">Capital, collateral and risk</h1>
            <p className="text-sm text-muted mt-0.5">
              The same questions a credit officer would ask. The viability agent reads all of this
              from the Overview and produces breakeven, ROI, DTI and a recommended product.
            </p>
          </div>
        </div>
      </div>

      {/* Captured-so-far recap */}
      <div className="card p-4 bg-navy/[0.02]">
        <div className="grid grid-cols-4 gap-4 text-[12px]">
          <Recap k="Monthly rent"   v={inputs.monthly_rent_uzs ? `${(inputs.monthly_rent_uzs/1_000_000).toFixed(1)}M UZS` : "—"} from="Location" />
          <Recap k="Avg ticket"     v={inputs.average_ticket_uzs ? `${fmt(inputs.average_ticket_uzs)} UZS` : "—"} from="Market" />
          <Recap k="Customers/day"  v={inputs.customers_per_day ? String(inputs.customers_per_day) : "—"} from="Market" />
          <Recap k="Site size"      v={inputs.site_size_sqm ? `${inputs.site_size_sqm} sqm` : "—"} from="Location" />
        </div>
      </div>

      {/* Section 1: Capital + use of funds */}
      <Section title="Capital structure & use of funds" subtitle="How much, from where, spent on what.">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Founder capital injection" hint="UZS · what you put in" req>
            <input className="input" placeholder="e.g. 180 000 000"
              value={fmt(inputs.budget_uzs)}
              onChange={(e) => setInput("budget_uzs", parse(e.target.value))} />
          </Field>
          <Field label="Loan amount requested" hint="UZS · 0 if no loan" req>
            <input className="input" placeholder="e.g. 120 000 000"
              value={fmt(inputs.loan_uzs)}
              onChange={(e) => setInput("loan_uzs", parse(e.target.value))} />
          </Field>
          <Field label="Repayment horizon" hint="months">
            <Seg options={["12","24","36","48","60"]}
              value={String(inputs.repayment_months)}
              onChange={(v) => setInput("repayment_months", Number(v))} />
          </Field>
          <Field label="Grace period" hint="months without principal repayment">
            <Seg options={["0","1","3","6"]}
              value={String(inputs.grace_period_months)}
              onChange={(v) => setInput("grace_period_months", Number(v))} />
          </Field>
          <Field label="Repayment frequency">
            <Seg options={["Monthly","Quarterly"]}
              value={inputs.repay_freq === "monthly" ? "Monthly" : "Quarterly"}
              onChange={(v) => setInput("repay_freq", v.toLowerCase() as any)} />
          </Field>
        </div>

        <div className="mt-5 pt-5 border-t border-line">
          <div className="flex items-end justify-between mb-3 gap-3">
            <div>
              <div className="label">Use of funds breakdown</div>
              <div className="text-[11px] text-muted">How the total capital (founder + loan) is spent. Type % directly.</div>
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
              >Use typical split</button>
              <button
                onClick={() => {
                  setInput("use_equipment_pct", 0);
                  setInput("use_renovation_pct", 0);
                  setInput("use_inventory_pct", 0);
                  setInput("use_working_capital_pct", 0);
                  setInput("use_marketing_pct", 0);
                }}
                className="text-[11px] px-2.5 py-1 border border-line rounded-md hover:bg-navy/5 text-muted"
              >Clear</button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <PctInput label="Equipment"      color="bg-petrol"
              value={inputs.use_equipment_pct} onChange={(v) => setInput("use_equipment_pct", v)} />
            <PctInput label="Renovations"    color="bg-teal"
              value={inputs.use_renovation_pct} onChange={(v) => setInput("use_renovation_pct", v)} />
            <PctInput label="Inventory"      color="bg-emerald"
              value={inputs.use_inventory_pct} onChange={(v) => setInput("use_inventory_pct", v)} />
            <PctInput label="Working cap."   color="bg-amber"
              value={inputs.use_working_capital_pct} onChange={(v) => setInput("use_working_capital_pct", v)} />
            <PctInput label="Marketing"      color="bg-rose-400"
              value={inputs.use_marketing_pct} onChange={(v) => setInput("use_marketing_pct", v)} />
          </div>

          {/* Live stacked bar + total */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-muted">Allocation preview</span>
              <span className={clsx(
                "font-semibold",
                useOfFundsTotal === 100 ? "text-emerald"
                : useOfFundsTotal > 100 ? "text-rose-500"
                : useOfFundsTotal === 0 ? "text-muted"
                : "text-amber"
              )}>
                {useOfFundsTotal === 100 ? "100% allocated"
                  : useOfFundsTotal === 0 ? "0% allocated"
                  : useOfFundsTotal > 100 ? `${useOfFundsTotal}% — ${useOfFundsTotal - 100}% over`
                  : `${useOfFundsTotal}% — ${100 - useOfFundsTotal}% remaining`}
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
              Capital base: {fmt(inputs.budget_uzs + inputs.loan_uzs)} UZS
              {(inputs.budget_uzs + inputs.loan_uzs) > 0 && useOfFundsTotal > 0 && (
                <> · ≈ {fmt(Math.round((inputs.budget_uzs + inputs.loan_uzs) * useOfFundsTotal / 100))} UZS allocated</>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Collateral & guarantor */}
      <Section title="Collateral & guarantor" subtitle="What secures the loan.">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Collateral type">
            <select className="input"
              value={inputs.collateral_type}
              onChange={(e) => setInput("collateral_type", e.target.value as any)}>
              <option value="">Select…</option>
              <option value="none">None</option>
              <option value="real_estate">Real estate</option>
              <option value="vehicle">Vehicle</option>
              <option value="equipment">Equipment</option>
              <option value="deposit">Cash deposit</option>
            </select>
          </Field>
          <Field label="Collateral value" hint="UZS · only if applicable">
            <input className="input" placeholder="e.g. 50 000 000"
              value={fmt(inputs.collateral_value_uzs)}
              onChange={(e) => setInput("collateral_value_uzs", parse(e.target.value))} />
          </Field>
          <Field label="Already pledged elsewhere?">
            <YesNo value={inputs.collateral_pledged_elsewhere} onChange={(v) => setInput("collateral_pledged_elsewhere", v)} />
          </Field>
          <Field label="Co-signer / guarantor">
            <YesNo value={inputs.has_cosigner} onChange={(v) => setInput("has_cosigner", v)} />
          </Field>
          {inputs.has_cosigner && (
            <Field label="Co-signer relationship" full>
              <input className="input" placeholder="e.g. spouse, parent, business partner"
                value={inputs.cosigner_relationship}
                onChange={(e) => setInput("cosigner_relationship", e.target.value)} />
            </Field>
          )}
        </div>
      </Section>

      {/* Section 3: Founder financial standing */}
      <Section title="Personal financial standing" subtitle="Used for debt-to-income.">
        <div className="grid grid-cols-3 gap-5">
          <Field label="Existing debts" hint="M UZS / month">
            <input className="input" placeholder="e.g. 2"
              value={inputs.existing_monthly_debts_m_uzs || ""}
              onChange={(e) => setInput("existing_monthly_debts_m_uzs", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Other monthly income" hint="M UZS · salary, rentals, etc.">
            <input className="input" placeholder="e.g. 8"
              value={inputs.other_monthly_income_m_uzs || ""}
              onChange={(e) => setInput("other_monthly_income_m_uzs", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Dependents" hint="people in the household">
            <input className="input" placeholder="e.g. 2"
              value={inputs.dependents_count || ""}
              onChange={(e) => setInput("dependents_count", Number(e.target.value) || 0)} />
          </Field>
        </div>
      </Section>

      {/* Section 4: Risk acknowledgement */}
      <Section title="Risk acknowledgement" subtitle="What's the worst case, and how do you cover it?" tone="amber">
        <Field label="Top risk you've identified" hint="in your own words" full>
          <textarea className="input min-h-[70px] text-[13px] leading-snug"
            placeholder="e.g. Local saturation; weekend competition; supply-chain delays for premium beans"
            value={inputs.top_risk_self_identified}
            onChange={(e) => setInput("top_risk_self_identified", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-5 mt-4">
          <Field label="Contingency runway" hint="months of personal funds if revenue misses">
            <Seg options={["0","1","3","6","12"]}
              value={String(inputs.contingency_runway_months)}
              onChange={(v) => setInput("contingency_runway_months", Number(v))} />
          </Field>
          <Field label="Business insurance planned?">
            <YesNo value={inputs.business_insurance_planned} onChange={(v) => setInput("business_insurance_planned", v)} />
          </Field>
        </div>
      </Section>

      {/* Section 5: Operating economics */}
      <Section title="Operating economics" subtitle="Run-rate costs the agent can't infer.">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Other monthly costs" hint="M UZS · utilities, software, accounting, cleaning">
            <input className="input" placeholder="e.g. 6"
              value={inputs.other_monthly_costs_m_uzs || ""}
              onChange={(e) => setInput("other_monthly_costs_m_uzs", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Revenue ramp" hint="months until full capacity">
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
        doneHint="Provide founder capital and loan amount to continue."
        nextHint="All inputs captured. Open the Overview to run the full agentic analysis."
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
  return (
    <div className="seg">
      {options.map((o) => (
        <div key={o} className={clsx("seg-btn", value === o && "seg-btn-active")} onClick={() => onChange(o)}>{o}</div>
      ))}
    </div>
  );
}
function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="seg">
      <div className={clsx("seg-btn", !value && "seg-btn-active")} onClick={() => onChange(false)}>No</div>
      <div className={clsx("seg-btn",  value && "seg-btn-active")} onClick={() => onChange(true)}>Yes</div>
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
