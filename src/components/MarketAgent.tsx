// Market screen — INPUT ONLY. Just collects the commercial plan.
// Description + audience come from Profile (read-only here).
// The agent itself runs from Overview.

import { BarChart3, Info, FileText } from "lucide-react";
import clsx from "clsx";
import { useScenario } from "../state";
import type { ViewKey } from "./Sidebar";
import { WizardSteps, WizardFooter } from "./Wizard";

export function MarketAgent({ onChange }: { onChange: (v: ViewKey) => void }) {
  const { inputs, setInput } = useScenario();

  const fmt = (n: number) => (n ? n.toLocaleString("en-US").replace(/,/g, " ") : "");
  const parse = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
  const ready = inputs.average_ticket_uzs > 0 && inputs.customers_per_day > 0;

  return (
    <div className="space-y-5">
      <WizardSteps active="Market" onChange={onChange} />

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
            <BarChart3 size={20} />
          </div>
          <div className="flex-1">
            <div className="label">Step 3 · Market & sales</div>
            <h1 className="font-display text-xl text-navy font-bold">How will it sell?</h1>
            <p className="text-sm text-muted mt-0.5">
              The numbers only you know — what one customer spends, how many you expect, how they
              find you. The Market agent will run from the Overview to size TAM / SAM / SOM.
            </p>
          </div>
        </div>
      </div>

      {/* From-Profile context */}
      <div className="card p-4 bg-navy/[0.02]">
        <div className="grid grid-cols-3 gap-4 text-[12px]">
          <FromProfile k="Concept" v={inputs.description || "(set on Profile)"} clamp />
          <FromProfile k="Target audience" v={prettyAudience(inputs.target_audience)} />
          <FromProfile k="Format / tier" v={`${cap(inputs.format)} format · ${cap(inputs.price_tier)} tier`} />
        </div>
        <div className="mt-2 text-[11px] text-muted flex items-center gap-1.5">
          <Info size={11} /> Read from Profile — change them on the Profile screen if needed.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card p-5 space-y-4">
          <div className="label">Unit economics — what only you know</div>

          <Field label="Average ticket" hint="UZS / customer · the single most important number" req>
            <input className="input" placeholder="e.g. 42 000"
              value={fmt(inputs.average_ticket_uzs)}
              onChange={(e) => setInput("average_ticket_uzs", parse(e.target.value))} />
          </Field>

          <Field label="Customers per day target" hint="at full capacity" req>
            <input className="input" placeholder="e.g. 150"
              value={inputs.customers_per_day || ""}
              onChange={(e) => setInput("customers_per_day", Number(e.target.value) || 0)} />
          </Field>

          <Field label="Days open per week">
            <Seg options={["5","6","7"]}
              value={String(inputs.days_open_per_week || 7)}
              onChange={(v) => setInput("days_open_per_week", Number(v))} />
          </Field>

          <Field label="Sales channel">
            <select className="input"
              value={inputs.sales_channel}
              onChange={(e) => setInput("sales_channel", e.target.value as any)}>
              <option value="">Select…</option>
              <option value="storefront">Storefront only</option>
              <option value="storefront_online">Storefront + online (delivery / pickup)</option>
              <option value="online_only">Online only</option>
              <option value="b2b">B2B / wholesale</option>
            </select>
          </Field>

          <Field label="Comparable competitor" hint="optional · name a similar shop">
            <input className="input"
              placeholder="e.g. Caffeine, Bon!"
              value={inputs.comparable_competitor}
              onChange={(e) => setInput("comparable_competitor", e.target.value)} />
          </Field>
        </div>

        <div className="card p-5 space-y-4">
          <div className="label">Reach & differentiation</div>

          <Field label="Marketing reach">
            <select className="input"
              value={inputs.marketing_reach}
              onChange={(e) => setInput("marketing_reach", e.target.value as any)}>
              <option value="">Select…</option>
              <option value="walk_by">Walk-by only</option>
              <option value="district">District (signage + local ads)</option>
              <option value="city">City-wide</option>
              <option value="online_offline">Online + offline</option>
            </select>
          </Field>

          <Field label="Marketing budget" hint="M UZS / month">
            <input className="input"
              placeholder="e.g. 3"
              value={inputs.marketing_budget_m_uzs || ""}
              onChange={(e) => setInput("marketing_budget_m_uzs", Number(e.target.value) || 0)} />
          </Field>

          <Field label="Niche" hint="agent extracts if blank">
            <input className="input"
              placeholder="e.g. specialty coffee"
              value={inputs.niche}
              onChange={(e) => setInput("niche", e.target.value)} />
          </Field>

          <Field label="Differentiation in 1 sentence" hint="why customers come to you, not the competitor">
            <textarea className="input min-h-[80px] text-[13px] leading-snug"
              placeholder="e.g. On-site roasting, evening dessert pairings"
              value={inputs.differentiation_one_liner}
              onChange={(e) => setInput("differentiation_one_liner", e.target.value)} />
          </Field>

          <Field label="Price tier" hint="overrides the format default">
            <Seg options={["Value","Mid","Premium"]}
              value={cap(inputs.price_tier)}
              onChange={(v) => setInput("price_tier", v.toLowerCase() as any)} />
          </Field>
        </div>
      </div>

      <WizardFooter
        active="Market"
        onChange={onChange}
        currentDone={ready}
        doneHint="Set average ticket and customers per day to continue."
        nextHint="Commercial plan captured. Last step: capital structure and the loan ask."
      />
    </div>
  );
}

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : "";
const prettyAudience = (a: string) => ({
  office: "Office workers / commuters",
  residents: "Local residents",
  students: "Students",
  tourists: "Tourists",
  mixed: "Mixed",
} as Record<string, string>)[a] || "(set on Profile)";

function FromProfile({ k, v, clamp }: { k: string; v: string; clamp?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1">
        <FileText size={9} /> {k}
      </div>
      <div className={clsx("text-navy mt-0.5", clamp && "line-clamp-2")}>{v}</div>
    </div>
  );
}
function Field({ label, hint, req, children }: { label: string; hint?: string; req?: boolean; children: any }) {
  return (
    <div>
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
