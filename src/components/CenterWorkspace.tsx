import {
  AlertTriangle, CheckCircle2, ArrowUpRight, Share2, FileDown,
  Sparkles, TrendingUp, Banknote, ShieldCheck,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  ReferenceDot, ReferenceLine,
} from "recharts";
import clsx from "clsx";
import { useDerived } from "../state";
import { debtService, dscrBand, ltv, ltvBand, equityBand, equitySharePct } from "../finance";

function RecHeader() {
  const d = useDerived();
  const t = useT();
  const { inputs, completion, result } = useScenario();
  if (!d) return null;
  const { scenario } = d;
  const allDone = completion.allMetrics;
  const tone = !allDone
    ? { bg: "bg-petrol", label: "Analysis in progress", icon: Sparkles }
    : ({
        launch: { bg: "bg-emerald", label: "Yes, open here", icon: CheckCircle2 },
        caution: { bg: "bg-amber", label: "Proceed with caution", icon: AlertTriangle },
        no: { bg: "bg-rose-500", label: "Not recommended", icon: AlertTriangle },
      }[scenario.recommendation]);
  const Icon = tone.icon;
  const displayName = inputs.business_name || scenario.business;
  const completedCount = (completion.market ? 1 : 0) + (completion.location ? 1 : 0) + (completion.financials ? 1 : 0);

  return (
    <section className="card p-6 relative overflow-hidden">
      <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-petrol/5 blur-2xl" />
      <div className="flex items-start gap-6 relative">
        <div className={clsx("w-14 h-14 rounded-xl2 grid place-items-center text-white shadow-soft", tone.bg)}>
          <Icon size={26} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="chip bg-navy/5 text-navy">{t("Scenario")}</span>
            <span>{result?.scenario_id ?? "—"}</span>
            <span>·</span>
            <span>{t("Engine v1.4")}</span>
          </div>
          <h1 className="font-display text-2xl text-navy font-bold mt-1">
            {displayName} <span className="text-muted font-medium">·</span> {scenario.business}{scenario.location ? <> <span className="text-muted font-medium">in</span> {scenario.location}</> : null}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={clsx("chip text-white px-3 py-1 text-xs", tone.bg)}>{t(tone.label)}</span>
            {allDone ? (
              <span className="text-sm text-navy/80">
                <span className="font-semibold">{scenario.confidence}%</span>
                <span className="text-muted"> {t("confidence")}</span>
              </span>
            ) : (
              <span className="text-sm text-petrol font-semibold">{completedCount} {t("of 3 metrics done")}</span>
            )}
            <span className="text-xs text-muted">· {t("Recommendation engine v1.4 · 6 flagship models")}</span>
          </div>
          <p className="mt-3 text-sm text-navy/80 leading-relaxed max-w-2xl">
            {allDone
              ? scenario.blurb
              : `${t("Showing what's known so far.")} ${t("Run the remaining agents to lock in the final recommendation.")}`}
          </p>
        </div>
        <div className="flex flex-col gap-2 no-print">
          <button
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard?.writeText(url);
            }}
            title={t("Copy link to this scenario")}
            className="px-3 py-2 text-xs font-medium border border-line rounded-lg flex items-center gap-1.5 hover:bg-navy/5"
          >
            <Share2 size={14} /> {t("Share")}
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 text-xs font-medium bg-navy text-white rounded-lg flex items-center gap-1.5 hover:bg-navy-700"
          >
            <FileDown size={14} /> {t("Export PDF")}
          </button>
        </div>
      </div>
    </section>
  );
}

function KpiRow() {
  const d = useDerived();
  const t = useT();
  if (!d) return null;
  const { kpis } = d;
  return (
    <section className="grid grid-cols-6 gap-3">
      {kpis.map((k) => {
        const color =
          k.tone === "good" ? "text-emerald" : k.tone === "warn" ? "text-amber" : "text-rose-500";
        return (
          <div key={k.label} className={clsx("card p-4", !k.ready && "opacity-60")}>
            <div className="flex items-center justify-between">
              <span className="label">{t(k.label)}</span>
              <span className="text-[10px] text-muted">{k.model}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              {k.ready ? (
                <>
                  <span className={clsx("text-2xl font-display font-bold", color)}>{k.value}</span>
                  <span className="text-[11px] text-muted">/ 100</span>
                </>
              ) : (
                <span className="text-2xl font-display font-bold text-muted">—</span>
              )}
            </div>
            <div className="mt-2 h-1.5 bg-navy/5 rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full",
                  k.tone === "good" ? "bg-emerald" : k.tone === "warn" ? "bg-amber" : "bg-rose-500"
                )}
                style={{ width: k.ready ? `${k.value}%` : "0%" }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DemandCard() {
  const d = useDerived();
  const t = useT();
  if (!d) return null;
  const { demandSeries } = d;
  return (
    <div className="card p-5 col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">{t("Demand · M-B1")}</div>
          <div className="font-display font-bold text-navy">{t("12-month forecast")}</div>
        </div>
        <div className="seg w-44">
          <div className="seg-btn seg-btn-active">12M</div>
          <div className="seg-btn">24M</div>
          <div className="seg-btn">36M</div>
        </div>
      </div>
      <div className="h-56 mt-3 -ml-2">
        <ResponsiveContainer>
          <AreaChart data={demandSeries}>
            <defs>
              <linearGradient id="ga" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1B4965" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1B4965" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gf" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2A9D8F" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2A9D8F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EFEAE0" vertical={false} />
            <XAxis dataKey="m" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ border: "1px solid #E6E1D6", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#0B2545", fontWeight: 600 }}
            />
            <Area type="monotone" dataKey="actual" stroke="#1B4965" strokeWidth={2} fill="url(#ga)" />
            <Area type="monotone" dataKey="forecast" stroke="#2A9D8F" strokeWidth={2} strokeDasharray="4 3" fill="url(#gf)" />
            <ReferenceLine x="Mar" stroke="#E0A800" strokeDasharray="2 3" label={{ value: "Navro'z", position: "top", fill: "#E0A800", fontSize: 10 }} />
            <ReferenceDot x="Mar" y={130} r={3} fill="#E0A800" stroke="white" strokeWidth={1.5} />
            <ReferenceLine x="Feb" stroke="#94A3B8" strokeDasharray="2 3" label={{ value: "Ramazon", position: "top", fill: "#94A3B8", fontSize: 10 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-petrol" /> {t("Actual")}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-teal" style={{borderTop:'1px dashed'}} /> {t("Forecast")}</span>
        <span className="ml-auto">{t("Customer-intent index, indexed to district avg = 100")}</span>
      </div>
    </div>
  );
}

// Legacy SeasonalityCard / MapCard removed — Overview now renders the real
// Leaflet map via OverviewOrchestrator. Seasonality moved into the demand
// chart's reference markers.

function FactorsCard() {
  const d = useDerived();
  const t = useT();
  if (!d) return null;
  const { positives, risks } = d;
  return (
    <div className="card p-5">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="label flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald" /> {t("Top positive factors")}</div>
          <ul className="mt-2 space-y-2 text-sm text-navy/85">
            {positives.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <ArrowUpRight size={14} className="mt-0.5 text-emerald" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="label flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber" /> {t("Key risk factors")}</div>
          <ul className="mt-2 space-y-2 text-sm text-navy/85">
            {risks.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BankActionCard() {
  const d = useDerived();
  const { inputs } = useScenario();
  const t = useT();
  if (!d) return null;
  const { bank, nextActions } = d;

  // Bank-form metrics (rows 6/9/10/11/12). Prefer what the analysis produced;
  // fall back to recomputing from inputs so a scenario restored from history
  // (saved before these fields existed) still shows real numbers.
  const svc = debtService(
    inputs.loan_uzs, inputs.interest_rate_pct, inputs.subsidy_rate_pct,
    inputs.repayment_months, inputs.grace_period_months,
  );
  const collateralTotal = bank.collateral_value_uzs
    ?? ((inputs.collateral_items ?? []).reduce((a, c) => a + (c.appraised_value_uzs || 0), 0)
        || inputs.collateral_value_uzs || 0);
  const loanToValue = bank.ltv !== undefined ? bank.ltv : ltv(inputs.loan_uzs, collateralTotal);
  const monthlyPayment = bank.monthly_payment_uzs ?? svc.peakPayment;
  const effectiveRate = bank.effective_rate_pct ?? svc.effectiveRatePct;
  const dscrValue = bank.dscr ?? null;
  const tone = (b: "good" | "warn" | "bad") =>
    b === "good" ? "text-emerald" : b === "warn" ? "text-amber" : "text-rose-600";
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-petrol/10 text-petrol grid place-items-center">
          <Banknote size={18} />
        </div>
        <div className="flex-1">
          <div className="label">{t("Bank decision support · M-F1 · M-F2")}</div>
          <div className="font-display font-bold text-navy">{t("Recommended product")}</div>
        </div>
        <span className="chip bg-emerald/15 text-emerald">{t("Suggested")}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <div className="label">{t("Product")}</div>
          <div className="text-sm font-semibold text-navy mt-1">{t(bank.product)}</div>
        </div>
        <div>
          <div className="label">{t("Loan size")}</div>
          <div className="text-sm font-semibold text-navy mt-1">{bank.suggested_loan_m_uzs}M UZS <span className="text-muted font-normal">(±15M)</span></div>
        </div>
        <div>
          <div className="label">{t("Tenor")}</div>
          <div className="text-sm font-semibold text-navy mt-1">
            {inputs.repayment_months} {t("months")}
            {inputs.grace_period_months > 0 && <span className="text-muted font-normal"> · {inputs.grace_period_months} {t("mo grace")}</span>}
          </div>
        </div>
      </div>

      {/* Credit metrics the bank's own form implies: real debt service,
          DSCR, LTV. */}
      {inputs.loan_uzs > 0 && (
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-line">
          <div>
            <div className="label">{t("Monthly payment")}</div>
            <div className="text-sm font-semibold text-navy mt-1">
              {(monthlyPayment / 1_000_000).toFixed(1)}M
              <span className="text-muted font-normal text-[11px]"> @ {effectiveRate.toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <div className="label">DSCR</div>
            <div className={clsx("text-sm font-semibold mt-1", dscrValue == null ? "text-muted" : tone(dscrBand(dscrValue)))}>
              {dscrValue == null ? "—" : dscrValue.toFixed(2)}
              <span className="text-muted font-normal text-[11px]"> {t("min 1.25")}</span>
            </div>
          </div>
          <div>
            <div className="label">LTV</div>
            <div className={clsx("text-sm font-semibold mt-1", loanToValue == null ? "text-muted" : tone(ltvBand(loanToValue)))}>
              {loanToValue == null ? t("unsecured") : `${Math.round(loanToValue * 100)}%`}
            </div>
          </div>
          <div>
            <div className="label">{t("Own funds")}</div>
            <div className={clsx("text-sm font-semibold mt-1", tone(equityBand(equitySharePct(inputs.budget_uzs, inputs.loan_uzs))))}>
              {equitySharePct(inputs.budget_uzs, inputs.loan_uzs) ?? "—"}%
            </div>
          </div>
        </div>
      )}
      <div className="mt-4">
        <div className="label flex items-center gap-1.5"><ShieldCheck size={12} /> {t("Conditions & next actions")}</div>
        <ul className="mt-2 space-y-1.5 text-sm text-navy/85">
          {nextActions.map((a) => (
            <li key={a} className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-petrol shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import type { ViewKey, Mode } from "./Sidebar";
import { CategoryView } from "./CategoryView";
import { LocationAgent } from "./LocationAgent";
import { MarketAgent } from "./MarketAgent";
import { FinancialsAgent } from "./FinancialsAgent";
import { ProfileSetup } from "./ProfileSetup";
import { OverviewOrchestrator } from "./OverviewOrchestrator";
import { BorrowerCard, LoanCard } from "./BorrowerLoanCard";
import { BankerQueue } from "./BankerQueue";
import { ContactGate } from "./ContactGate";
import { useScenario, isContactComplete } from "../state";
import { useT } from "../i18n";
import { Lock as LockIcon } from "lucide-react";

/* Old empty-state component removed — Overview now always renders the
 * orchestrator + dashboard scaffolding. */

function ScoreFormulaCard() {
  const d = useDerived();
  const t = useT();
  if (!d) return null;
  const { composite, verdict, scoreFormula } = d;
  const verdictTone =
    verdict.tone === "good" ? "bg-emerald text-white"
    : verdict.tone === "warn" ? "bg-amber text-white"
    : "bg-rose-500 text-white";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">{t("Composite score · how we decide")}</div>
          <div className="font-display font-bold text-navy">{t("Weighted decision policy")}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-muted">{t("Final score")}</div>
            <div className="font-display font-bold text-2xl text-navy leading-none">{composite}<span className="text-base text-muted font-medium"> / 100</span></div>
          </div>
          <span className={clsx("chip px-3 py-1 text-xs font-bold", verdictTone)}>{t(verdict.label)}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {scoreFormula.map((b) => {
          const eff = b.inverted ? 100 - b.score : b.score;
          const contrib = Math.round((eff * b.weight) / 100);
          return (
            <div key={b.block} className={clsx("rounded-lg bg-navy/[0.03] p-3", !b.ready && "opacity-50")}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-navy">{t(b.block)}</span>
                <span className="text-[10px] text-muted">{b.weight}%</span>
              </div>
              {b.ready ? (
                <>
                  <div className="mt-1 font-display font-bold text-lg text-navy">{contrib}</div>
                  <div className="text-[10px] text-muted">
                    {b.inverted ? `${t("risk")} ${b.score} → ${eff}` : `${t("score")} ${b.score}`}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 font-display font-bold text-lg text-muted">—</div>
                  <div className="text-[10px] text-muted">{t("not run")}</div>
                </>
              )}
              <div className="mt-1.5 h-1 bg-navy/10 rounded-full overflow-hidden">
                <div className="h-full bg-petrol" style={{ width: b.ready ? `${(contrib / b.weight) * 100}%` : "0%" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[11px] text-muted flex items-center gap-3">
        <span>≥70 → {t("YES")}</span><span>50–69 → {t("MAYBE")}</span><span>&lt;50 → {t("NO")}</span>
        <span className="ml-auto">{t("Engine v1.4 · transparent linear policy")}</span>
      </div>
    </div>
  );
}

function MarketSizeCard() {
  const d = useDerived();
  const t = useT();
  if (!d) return null;
  const { marketSize } = d;
  const max = Math.max(...marketSize.map((m) => m.value));
  const palette: Record<string, string> = { TAM: "bg-petrol", SAM: "bg-teal", SOM: "bg-emerald" };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">{t("Market sizing · M-A1")}</div>
          <div className="font-display font-bold text-navy">TAM · SAM · SOM</div>
        </div>
        <span className="text-[11px] text-muted">{t("Billion UZS · Y1")}</span>
      </div>
      <div className="mt-4 space-y-3">
        {marketSize.map((m) => (
          <div key={m.tier}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-navy flex items-center gap-2">
                <span className={clsx("w-2 h-2 rounded-sm", palette[m.tier])} />
                {m.tier} <span className="text-muted font-normal">· {t(m.label)}</span>
              </span>
              <span className="font-display font-bold text-navy">{m.value}B</span>
            </div>
            <div className="mt-1 h-2 bg-navy/[0.05] rounded-full overflow-hidden">
              <div className={clsx("h-full rounded-full", palette[m.tier])} style={{ width: `${(m.value / max) * 100}%` }} />
            </div>
            <div className="text-[10px] text-muted mt-0.5">{t(m.sub)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CenterWorkspace({ view, onChange, mode }: { view: ViewKey; onChange: (v: ViewKey) => void; mode: Mode }) {
  const { completion, inputs } = useScenario();
  const t = useT();

  // In banker mode the founder-side gating doesn't apply — the banker just
  // wants to browse / open queued applications.
  const needsProfile = mode === "founder"
    && !completion.profile
    && (view === "Location" || view === "Market" || view === "Financials" || view === "Overview");

  // Before a founder sees the Overview we collect their contact (name + phone).
  // Bankers skip this — they already have the deal in front of them.
  const needsContact = mode === "founder"
    && view === "Overview"
    && completion.profile
    && !isContactComplete(inputs);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-5">
        <div data-noprint className="flex items-center gap-2 text-xs text-muted">
          <Sparkles size={12} className="text-petrol" />
          <span>{t("AI Decision Cockpit")}</span>
          <span>›</span>
          <span>{t(view === "Queue" ? "Deal Pipeline" : view)}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="chip bg-navy/5 text-navy"><TrendingUp size={10} /> {t("6 flagship models active")}</span>
            <CompletionChip />
          </span>
        </div>

        {view === "Queue"
          ? <BankerQueue onChange={onChange} />
          : view === "Profile"
          ? <ProfileSetup onContinue={onChange} />
          : needsProfile
          ? <LockedScreen
              title={`${t(view)} ${t("agent is locked")}`}
              body={t("Fill the business profile first so the agent has context to ground its analysis.")}
              cta={t("Open Profile")}
              onClick={() => onChange("Profile")}
            />
          : view === "Location"   ? <LocationAgent   onChange={onChange} />
          : view === "Market"     ? <MarketAgent     onChange={onChange} />
          : view === "Financials" ? <FinancialsAgent onChange={onChange} />
          : needsContact
            ? <ContactGate onContinue={() => onChange("Overview")} />
          : view === "Overview"
            ? <OverviewDashboard onChange={onChange} />
          : <CategoryView view={view} />
        }
      </div>
    </main>
  );
}

function CompletionChip() {
  const { completion, result } = useScenario();
  const t = useT();
  const n = (completion.market ? 1 : 0) + (completion.location ? 1 : 0) + (completion.financials ? 1 : 0);
  if (!completion.profile)
    return <span className="chip bg-amber/15 text-amber">{t("Profile required")}</span>;
  if (n === 0)
    return <span className="chip bg-amber/15 text-amber">{t("No agents run yet")}</span>;
  if (n === 3 && result)
    return <span className="chip bg-emerald/15 text-emerald">{t("All agents complete")}</span>;
  return <span className="chip bg-petrol/10 text-petrol">{n} {t("of 3 agents complete")}</span>;
}

function LockedScreen({ title, body, cta, onClick }: { title: string; body: string; cta: string; onClick: () => void }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto w-14 h-14 rounded-xl2 bg-navy/5 text-muted grid place-items-center mb-5">
        <LockIcon size={26} />
      </div>
      <h2 className="font-display text-2xl text-navy font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto">{body}</p>
      <button
        onClick={onClick}
        className="mt-6 px-4 py-2 text-sm font-semibold bg-petrol text-white rounded-lg hover:bg-navy-700"
      >{cta}</button>
    </div>
  );
}

function OverviewDashboard({ onChange }: { onChange: (v: ViewKey) => void }) {
  const { completion, result } = useScenario();
  const t = useT();
  const demandReady = !!result && result.demand.score > 0 && result.demand.forecast_index.length > 0;
  return (
    <>
      {/* Orchestrator renders the agent card, then the business-owner card,
          then the live map — owner sits right after the agents analysis card. */}
      <OverviewOrchestrator afterAgentCard={<BorrowerCard />} />

      <RecHeader />

      <ScoreFormulaCard />
      <KpiRow />

      <section className="grid grid-cols-3 gap-4">
        {completion.market
          ? <MarketSizeCard />
          : <FillToSeeCard target="Market" onChange={onChange} blurb="TAM / SAM / SOM and saturation index" />}
        {demandReady
          ? <DemandCard />
          : <DemandPlaceholder />}
      </section>

      <FactorsCard />

      <LoanCard />

      <BankActionCard />

      <div className="text-[11px] text-muted text-center pt-2 pb-6">
        {t("Decision support · human-in-the-loop · audit log enabled · Recommendation engine v1.4")}
      </div>
    </>
  );
}

// There is no Demand agent yet, so the forecast block has no data to show.
// Be honest about it instead of pointing the user back at the view they're on.
function DemandPlaceholder() {
  const t = useT();
  return (
    <div className="card p-6 col-span-2 flex flex-col items-center justify-center text-center bg-gradient-to-br from-white to-navy/[0.02]">
      <div className="w-10 h-10 rounded-xl bg-navy/5 text-muted grid place-items-center mb-3">
        <TrendingUp size={18} />
      </div>
      <div className="font-display font-semibold text-navy">{t("Demand forecast")}</div>
      <div className="text-[12px] text-muted mt-1 max-w-sm">
        {t("The dedicated demand-forecasting agent isn't live yet — this panel will show the 12-month forecast once it is. It does not affect the current composite score.")}
      </div>
    </div>
  );
}

function FillToSeeCard({ target, blurb, onChange, className }: { target: ViewKey; blurb: string; onChange: (v: ViewKey) => void; className?: string }) {
  const t = useT();
  return (
    <div className={clsx("card p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-white to-navy/[0.02]", className)}>
      <div className="w-10 h-10 rounded-xl bg-navy/5 text-muted grid place-items-center mb-3">
        <LockIcon size={18} />
      </div>
      <div className="font-display font-semibold text-navy">{t(target)} {t("not run yet")}</div>
      <div className="text-[12px] text-muted mt-1">{t("Fill the")} {t(target)} {t("agent to see")} {t(blurb)}.</div>
      <button
        onClick={() => onChange(target)}
        className="mt-4 px-3 py-1.5 text-[12px] font-semibold border border-petrol text-petrol rounded-lg hover:bg-petrol hover:text-white transition"
      >{t("Open")} {t(target)}</button>
    </div>
  );
}
