// Overview's "Run full analysis" orchestrator.
// Single button kicks off Location, Market, Financials in parallel, then
// fires the Synthesis agent once all three return. Each agent has its own
// status pill that flips through pending → running → done / error.
//
// Also renders the read-only map at the top once the Location agent has
// produced data — competitors and anchors plotted live.

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Sparkles, Loader2, Check, AlertCircle, MapPin, BarChart3, Wallet,
  PlayCircle, RefreshCcw, Search, X,
} from "lucide-react";
import clsx from "clsx";
import { api, type LocationAgentResult, type PlaceHit, type MarketAgentResult, type FinancialsAgentResult, type AnalyzeResponse } from "../api";
import { useScenario, type ScenarioInputs } from "../state";

type AgentKey = "location" | "market" | "financials" | "synthesis";
type Status = "pending" | "running" | "done" | "error";
type RunState = Record<AgentKey, { status: Status; error?: string }>;

const initialState: RunState = {
  location:   { status: "pending" },
  market:     { status: "pending" },
  financials: { status: "pending" },
  synthesis:  { status: "pending" },
};

export function OverviewOrchestrator() {
  const { inputs, result, setResult, locationAgent, setLocationAgent, synthesis, setSynthesis } = useScenario();
  const [run, setRun] = useState<RunState>(initialState);
  const running = Object.values(run).some((s) => s.status === "running");
  const allDone = Object.values(run).every((s) => s.status === "done");
  const hasResults = !!locationAgent || !!synthesis || (result?.market.tam_b_uzs ?? 0) > 0;

  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!inputs.business_type)  out.push("business type");
    if (inputs.pin_lat == null) out.push("map pin");
    if (!inputs.average_ticket_uzs)   out.push("average ticket");
    if (!inputs.customers_per_day)    out.push("customers/day");
    if (!inputs.budget_uzs)           out.push("startup capital");
    return out;
  }, [inputs]);

  async function runAll() {
    setRun({
      location:   { status: "running" },
      market:     { status: "running" },
      financials: { status: "running" },
      synthesis:  { status: "pending" },
    });

    const locP = api.agentLocation({
      lat: inputs.pin_lat!, lng: inputs.pin_lng!,
      business_type: inputs.business_type, format: inputs.format,
      business_name: inputs.business_name || undefined,
      description: inputs.description || undefined,
      site_size_sqm: inputs.site_size_sqm || undefined,
      monthly_rent_uzs: inputs.monthly_rent_uzs || undefined,
      operating_hours: (inputs.operating_hours || undefined) as any,
    });
    const mktP = api.agentMarket({
      brief: inputs.description || `${inputs.business_type} in ${inputs.district}`,
      district: inputs.district || undefined,
      business_type: inputs.business_type || undefined,
      business_name: inputs.business_name || undefined,
      format: inputs.format,
      target_audience: inputs.target_audience || undefined,
      price_tier: inputs.price_tier,
      average_ticket_uzs: inputs.average_ticket_uzs || undefined,
      customers_per_day: inputs.customers_per_day || undefined,
      marketing_reach: inputs.marketing_reach || undefined,
      comparable_competitor: inputs.comparable_competitor || undefined,
      niche: inputs.niche || undefined,
    });
    const finP = api.agentFinancials({
      business_type: inputs.business_type,
      district: inputs.district || "Tashkent",
      format: inputs.format,
      business_name: inputs.business_name || undefined,
      description: inputs.description || undefined,
      startup_capital_uzs: inputs.budget_uzs,
      loan_uzs: inputs.loan_uzs || undefined,
      repayment_months: inputs.repayment_months || undefined,
      monthly_rent_uzs: inputs.monthly_rent_uzs || undefined,
      average_ticket_uzs: inputs.average_ticket_uzs || undefined,
      expected_customers_per_day: inputs.customers_per_day || undefined,
    } as any);

    // Settle independently so partial failure is recoverable.
    const [locR, mktR, finR] = await Promise.allSettled([locP, mktP, finP]);

    if (locR.status === "fulfilled") setLocationAgent(locR.value);

    // Build the dashboard result entirely from agent output. Anything an
    // agent didn't produce stays at 0/empty so the dashboard cards render
    // "—" via their `ready` flag instead of inventing numbers.
    const nextResult = buildResultFromAgents(
      inputs,
      locR.status === "fulfilled" ? locR.value : null,
      mktR.status === "fulfilled" ? mktR.value : null,
      finR.status === "fulfilled" ? finR.value : null,
    );
    setResult(nextResult);

    setRun((s) => ({
      ...s,
      location:   { status: locR.status === "fulfilled" ? "done" : "error", error: locR.status === "rejected" ? String(locR.reason).slice(0, 120) : undefined },
      market:     { status: mktR.status === "fulfilled" ? "done" : "error", error: mktR.status === "rejected" ? String(mktR.reason).slice(0, 120) : undefined },
      financials: { status: finR.status === "fulfilled" ? "done" : "error", error: finR.status === "rejected" ? String(finR.reason).slice(0, 120) : undefined },
      synthesis:  { status: "running" },
    }));

    // Synthesis — only meaningful if all three upstream agents succeeded.
    if (locR.status === "fulfilled" && mktR.status === "fulfilled" && finR.status === "fulfilled") {
      try {
        const synth = await api.agentSynthesize({
          business_name: inputs.business_name,
          business_type: inputs.business_type,
          description: inputs.description,
          location: nextResult.location,
          composite_score: nextResult.verdict.composite_score,
          short_label: nextResult.verdict.short_label,
          market: nextResult.market,
          loc: nextResult.location_block,
          financial: nextResult.financial,
          credit: nextResult.credit,
          loan_uzs: inputs.loan_uzs,
          collateral_type: inputs.collateral_type,
          has_cosigner: inputs.has_cosigner,
          contingency_runway_months: inputs.contingency_runway_months,
        });
        setSynthesis(synth);
        // Update the verdict's blurb (with the AI-written paragraph), the
        // factor lists, and the bank product/credit description.
        setResult({
          ...nextResult,
          verdict: { ...nextResult.verdict, blurb: synth.blurb },
          factors: {
            positives: synth.positives,
            risks: synth.risks,
            next_actions: synth.next_actions,
          },
          credit: { ...nextResult.credit, product: synth.bank_product },
        });
        setRun((s) => ({ ...s, synthesis: { status: "done" } }));
      } catch (e: any) {
        setRun((s) => ({ ...s, synthesis: { status: "error", error: String(e?.message ?? e).slice(0, 120) } }));
      }
    } else {
      setRun((s) => ({ ...s, synthesis: { status: "error", error: "Skipped — one or more upstream agents failed" } }));
    }
  }

  return (
    <div className="space-y-5">
      <div data-noprint className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
            <Sparkles size={20} />
          </div>
          <div className="flex-1">
            <div className="label">Agent orchestration</div>
            <h2 className="font-display font-bold text-navy text-lg">
              {hasResults ? "Re-run the full analysis" : "Run the full analysis"}
            </h2>
            <p className="text-[12px] text-muted mt-0.5">
              All four agents fire in parallel against the inputs you've captured.
              Total time ≈ 15–30 seconds.
            </p>
          </div>
          <button
            onClick={runAll}
            disabled={running || blockers.length > 0}
            className={clsx(
              "px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition",
              running || blockers.length > 0
                ? "bg-navy/10 text-muted cursor-not-allowed"
                : hasResults
                  ? "bg-white text-petrol border border-petrol hover:bg-petrol/5"
                  : "bg-petrol text-white hover:bg-navy-700 shadow-soft",
            )}
          >
            {running
              ? <><Loader2 size={15} className="animate-spin" /> Running…</>
              : hasResults
                ? <><RefreshCcw size={15} /> Re-run analysis</>
                : <><PlayCircle size={15} /> Run full analysis</>}
          </button>
        </div>

        {blockers.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber/5 border border-amber/30 text-[12px] flex items-start gap-2">
            <AlertCircle size={13} className="text-amber mt-0.5 shrink-0" />
            <span className="text-navy">
              Missing required inputs: <span className="font-semibold">{blockers.join(", ")}</span>.
              Walk back through the wizard to fill them.
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          <AgentChip k="location" label="Location" icon={MapPin} state={run.location} />
          <AgentChip k="market"   label="Market"   icon={BarChart3} state={run.market} />
          <AgentChip k="financials" label="Financials" icon={Wallet} state={run.financials} />
          <AgentChip k="synthesis"  label="Synthesis"  icon={Sparkles} state={run.synthesis} />
        </div>
      </div>

      {/* Real interactive map — visible the moment a pin exists, enriched with
          live competitors + anchors once the Location agent finishes. */}
      {(inputs.pin_lat != null && inputs.pin_lng != null) && (
        <OverviewMap r={locationAgent} pin={[inputs.pin_lat, inputs.pin_lng]} />
      )}

      {/* Synthesis bullets, when present, render inside the existing FactorsCard
          via setResult above — no separate UI here. */}
      {allDone && synthesis && (
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald/10 text-emerald grid place-items-center"><Check size={16} /></div>
            <div className="flex-1">
              <div className="label">AI synthesis · bank product</div>
              <div className="font-display font-bold text-navy">{synthesis.bank_product}</div>
            </div>
          </div>
          {synthesis.bank_conditions.length > 0 && (
            <ul className="mt-3 space-y-1 text-[13px] text-navy/85">
              {synthesis.bank_conditions.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-petrol shrink-0" /> {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AgentChip({ k, label, icon: Icon, state }: { k: AgentKey; label: string; icon: any; state: { status: Status; error?: string } }) {
  const tone =
    state.status === "done"    ? "bg-emerald/10 text-emerald border-emerald/30"
  : state.status === "running" ? "bg-petrol/10 text-petrol border-petrol/30"
  : state.status === "error"   ? "bg-rose-50  text-rose-600 border-rose-200"
  :                              "bg-navy/[0.03] text-muted border-line";
  const StatusIcon =
    state.status === "running" ? Loader2
  : state.status === "done"    ? Check
  : state.status === "error"   ? AlertCircle
  :                              null;
  return (
    <div className={clsx("p-3 rounded-lg border flex items-center gap-2", tone)} title={state.error}>
      <Icon size={14} className="shrink-0" />
      <span className="text-[12px] font-semibold flex-1">{label}</span>
      {StatusIcon && <StatusIcon size={13} className={state.status === "running" ? "animate-spin" : ""} />}
    </div>
  );
  void k;
}

/** Big interactive Overview map. Renders the same OSM tiles, the same pin
 *  styling, the same search box as the Location screen — same look-and-feel
 *  so the user immediately recognises it. The pin appears as soon as a
 *  pin exists; competitor + anchor markers layer on after the Location agent
 *  finishes. The user can re-pin from here too (same Nominatim search). */
function OverviewMap({ r, pin }: { r: LocationAgentResult | null; pin: [number, number] }) {
  const { setInput } = useScenario();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const siteMarkerRef = useRef<L.Marker | null>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Init map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true })
      .setView(pin, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19,
    }).addTo(map);
    overlayRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Site pin + catchment circles update whenever the pin coords change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (siteMarkerRef.current) siteMarkerRef.current.remove();
    L.circle(pin, { radius: 500,  color: "#1B4965", weight: 1, fillOpacity: 0.04, pane: "tilePane" }).addTo(map);
    L.circle(pin, { radius: 1000, color: "#1B4965", weight: 1, dashArray: "4 6", fillOpacity: 0, pane: "tilePane" }).addTo(map);
    siteMarkerRef.current = L.marker(pin, {
      icon: L.divIcon({
        className: "site-pin",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#1B4965;box-shadow:0 0 0 3px white,0 2px 6px rgba(0,0,0,.3);"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      }),
    }).bindPopup("<b>Selected site</b>").addTo(map);
    map.setView(pin, map.getZoom() < 14 ? 15 : map.getZoom());
  }, [pin[0], pin[1]]);

  // Re-render competitor + anchor overlay whenever the Location agent result
  // changes (initial null → populated after agent run).
  useEffect(() => {
    const layer = overlayRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!r) return;
    for (const c of r.competitors) {
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className: "comp-pin",
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#E0A800;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>`,
          iconSize: [10, 10], iconAnchor: [5, 5],
        }),
      }).bindPopup(`<b>${c.name ?? "(unnamed)"}</b><br>${c.kind} · ${c.distance_m}m`).addTo(layer);
    }
    for (const a of r.anchors) {
      const cc = a.type === "transit" ? "#10B981"
               : a.type === "mall" || a.type === "market" ? "#2A9D8F"
               : a.type === "education" ? "#7c5fdc"
               : a.type === "hospital" ? "#e15555"
               : "#94A3B8";
      L.marker([a.lat, a.lng], {
        icon: L.divIcon({
          className: "anchor-pin",
          html: `<div style="width:8px;height:8px;border-radius:2px;background:${cc};border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>`,
          iconSize: [8, 8], iconAnchor: [4, 4],
        }),
      }).bindPopup(`<b>${a.name ?? "(unnamed)"}</b><br>${a.type} · ${a.distance_m}m`).addTo(layer);
    }
  }, [r]);

  // Debounced Nominatim search — same UX as the Location screen.
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) { setHits([]); setSearchOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.geocodeSearch(q);
        setHits(r.items);
        if (r.items.length > 0) setSearchOpen(true);
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function rePinTo(lat: number, lng: number) {
    setInput("pin_lat", lat);
    setInput("pin_lng", lng);
    mapRef.current?.setView([lat, lng], 16);
  }

  return (
    <div className="card overflow-hidden">
      {/* Header strip */}
      <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label">Location intelligence · live OSM map</div>
          <div className="font-display font-bold text-navy text-lg truncate">
            {r?.district
              ? <>{r.district}<span className="text-muted font-medium">, Tashkent</span></>
              : "Selected site"}
            {r?.road && <span className="text-muted font-medium"> · {r.road}</span>}
          </div>
          <div className="text-[11px] text-muted font-mono mt-0.5">
            {pin[0].toFixed(5)}, {pin[1].toFixed(5)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted shrink-0 pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-petrol ring-2 ring-white" /> Site</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber" /> Competitor</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald" /> Transit</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-teal" /> Mall</span>
        </div>
      </div>

      {/* Search bar — same UX as Location screen, allows re-pinning here. */}
      <div data-noprint className="px-5 py-3 border-b border-line bg-white flex items-center gap-3">
        <Search size={14} className="text-petrol shrink-0" />
        <div className="flex-1 relative">
          <input
            className="w-full pr-9 py-1 text-sm bg-transparent border-0 border-b border-line focus:outline-none focus:border-petrol"
            placeholder="Re-pin to a different place — e.g. 'Mustaqillik Square', 'Inha University'…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => hits.length && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setHits([]); setSearchOpen(false); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
            ><X size={14} /></button>
          )}
          {searchOpen && hits.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-soft max-h-72 overflow-y-auto z-[1000]">
              {hits.map((h, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    rePinTo(h.lat, h.lng);
                    setSearchOpen(false);
                    setQuery(h.display.split(",")[0]);
                  }}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-navy/5 border-b border-line/60 last:border-b-0"
                >
                  <div className="text-navy font-medium truncate">{h.display.split(",")[0]}</div>
                  <div className="text-[11px] text-muted truncate">{h.display}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-[11px] text-muted hidden md:inline">Re-run agent after re-pinning</span>
      </div>

      {/* Two-column body: map on the left, analysis on the right */}
      <div className="grid grid-cols-2 min-h-[560px]">
        <div ref={mapEl} className="w-full h-full min-h-[560px] border-r border-line" />

        <div className="p-5 overflow-y-auto max-h-[700px]">
          {r ? (
            <AnalysisPanel r={r} />
          ) : (
            <EmptyAnalysis />
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisPanel({ r }: { r: LocationAgentResult }) {
  const top = r.competitors.slice(0, 8);
  const anchors = r.anchors.slice(0, 8);
  const scoreTone = r.score >= 70 ? "text-emerald" : r.score >= 50 ? "text-amber" : "text-rose-500";

  return (
    <div className="space-y-5">
      {/* Score banner */}
      <div className="flex items-end justify-between">
        <div>
          <div className="label">Location score</div>
          <div className={clsx("font-display font-bold text-3xl leading-none", scoreTone)}>
            {r.score}
            <span className="text-base text-muted font-medium"> / 100</span>
          </div>
          <div className="text-[11px] text-muted mt-1">
            Composite — foot traffic × anchors × competition
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <Stat k="Foot traffic" v={`~${r.foot_traffic_per_day}/d`} />
          <Stat k="Walk"         v={`${r.walkability}/100`} />
          <Stat k="Visibility"   v={`${r.visibility}/100`} />
          <Stat k="Comp 500m"    v={String(r.competitors_within_500m)} />
        </div>
      </div>

      {/* Why this score */}
      {r.rationale.length > 0 && (
        <div>
          <div className="label">Why this score</div>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-navy/85">
            {r.rationale.map((x) => (
              <li key={x} className="flex items-start gap-2">
                <Check size={12} className="mt-0.5 text-emerald shrink-0" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Competitors */}
      <div>
        <div className="flex items-center justify-between">
          <div className="label">
            Competitors within 1 km · {r.competitors_within_1km} total
          </div>
          <span className="chip bg-amber/10 text-amber text-[10px]">
            {r.competitors_within_500m} within 500m
          </span>
        </div>
        {top.length === 0 ? (
          <div className="mt-2 text-[12px] text-muted">None found nearby — clean slate.</div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {top.map((c, i) => (
              <li key={i} className="py-1.5 flex items-center gap-2 text-[12.5px]">
                <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
                <span className="flex-1 min-w-0 truncate text-navy font-medium">
                  {c.name ?? "(unnamed)"}
                </span>
                <span className="text-muted text-[11px] truncate max-w-[110px]">{c.kind}</span>
                <span className="font-mono text-navy text-[11px] w-12 text-right">{c.distance_m}m</span>
              </li>
            ))}
            {r.competitors.length > top.length && (
              <li className="pt-2 text-[11px] text-muted">+ {r.competitors.length - top.length} more on the map</li>
            )}
          </ul>
        )}
      </div>

      {/* Anchors */}
      <div>
        <div className="label">Anchors driving traffic</div>
        {anchors.length === 0 ? (
          <div className="mt-2 text-[12px] text-muted">No anchors within 800m — relies entirely on direct walk-by.</div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {anchors.map((a, i) => {
              const tone = a.type === "transit" ? "bg-emerald"
                          : a.type === "mall" || a.type === "market" ? "bg-teal"
                          : a.type === "education" ? "bg-purple-500"
                          : a.type === "hospital" ? "bg-rose-500"
                          : "bg-slate-400";
              return (
                <li key={i} className="py-1.5 flex items-center gap-2 text-[12.5px]">
                  <span className={clsx("w-2 h-2 rounded-sm shrink-0", tone)} />
                  <span className="flex-1 min-w-0 truncate text-navy font-medium">
                    {a.name ?? "(unnamed)"}
                  </span>
                  <span className="text-muted text-[11px]">{a.type}</span>
                  <span className="font-mono text-navy text-[11px] w-12 text-right">{a.distance_m}m</span>
                </li>
              );
            })}
            {r.anchors.length > anchors.length && (
              <li className="pt-2 text-[11px] text-muted">+ {r.anchors.length - anchors.length} more on the map</li>
            )}
          </ul>
        )}
      </div>

      {r.sparse_data && (
        <div className="text-[11px] text-amber p-3 bg-amber/5 border border-amber/30 rounded-lg">
          OSM coverage is sparse around this point — the score is a conservative estimate.
        </div>
      )}
    </div>
  );
}

function EmptyAnalysis() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-10">
      <div className="w-12 h-12 rounded-xl2 bg-navy/5 text-muted grid place-items-center mb-4">
        <MapPin size={22} />
      </div>
      <div className="font-display font-semibold text-navy">Site pinned · agent not run yet</div>
      <p className="text-[12px] text-muted mt-1 max-w-xs">
        Run the analysis above and this panel will show real competitors,
        anchors and the agent's reasoning for the location score.
      </p>
    </div>
  );
}

/**
 * Build the dashboard's AnalyzeResponse from agent outputs only.
 *
 * Three agents produce real data; Credit and Competition are derived from
 * the agents' output + loan-application inputs (collateral, cosigner, etc.).
 * Demand has no agent yet — left at score 0 so the dashboard renders "—".
 *
 * Composite verdict is recomputed from the blocks that actually have data.
 */
function buildResultFromAgents(
  inputs: ScenarioInputs,
  loc: LocationAgentResult | null,
  mkt: MarketAgentResult | null,
  fin: FinancialsAgentResult | null,
): AnalyzeResponse {
  const fmtId = `req_${Date.now().toString(36)}`;
  const scenarioId = `SCN-${Date.now().toString(36).toUpperCase()}`;

  const market = mkt
    ? { tam_b_uzs: mkt.tam_b_uzs, sam_b_uzs: mkt.sam_b_uzs, som_b_uzs: mkt.som_b_uzs,
        saturation_index: mkt.saturation_index, score: mkt.score }
    : { tam_b_uzs: 0, sam_b_uzs: 0, som_b_uzs: 0, saturation_index: 0, score: 0 };

  const location_block = loc
    ? { foot_traffic_per_day: loc.foot_traffic_per_day,
        competitors_within_500m: loc.competitors_within_500m,
        walkability: loc.walkability, visibility: loc.visibility, score: loc.score }
    : { foot_traffic_per_day: 0, competitors_within_500m: 0, walkability: 0, visibility: 0, score: 0 };

  const financial = fin
    ? { breakeven_month: fin.breakeven_month, burn_rate_m_uzs: fin.burn_rate_m_uzs,
        roi_12mo_pct: fin.roi_12mo_pct, gross_margin_pct: fin.gross_margin_pct, score: fin.score }
    : { breakeven_month: 0, burn_rate_m_uzs: 0, roi_12mo_pct: 0, gross_margin_pct: 0, score: 0 };

  // No demand agent yet — block stays empty; dashboard cards will render "—".
  const demand = { forecast_index: [] as number[], peak_periods: [] as string[],
                   off_peak_dip_pct: 0, score: 0 };

  // Competition derived from market saturation + location's actual competitor count.
  const competition = (loc || mkt) ? deriveCompetition(loc, mkt)
    : { direct_competitors: 0, competitor_density_index: 0,
        failure_probability_pct: 0, risk_level: "Medium" as const, score: 0 };

  // Credit derived from the financial agent's score + the loan-application
  // inputs the user already gave on the Financials screen.
  const credit = fin ? deriveCredit(fin, inputs)
    : { suggested_loan_m_uzs: 0, dti: 0, credit_readiness: 0, product: "—", score: 0 };

  // Composite over only the blocks that actually ran.
  const blocks = [
    { score: market.score,         weight: 20, ready: !!mkt },
    { score: demand.score,         weight: 20, ready: false },          // no demand agent
    { score: location_block.score, weight: 25, ready: !!loc },
    { score: financial.score,      weight: 25, ready: !!fin },
    { score: competition.score,    weight: 10, ready: !!(loc || mkt), inverted: true },
  ];
  const composite = compositePartial(blocks);

  let short_label: "YES" | "MAYBE" | "NO";
  let label: string;
  if (composite >= 70)      { short_label = "YES";   label = "Recommend Launch"; }
  else if (composite >= 50) { short_label = "MAYBE"; label = "Proceed with caution"; }
  else                      { short_label = "NO";    label = "Not recommended"; }
  const confidence = Math.min(95, 60 + Math.abs(composite - 50));

  const districtFromGeo = loc?.district ? `${loc.district}, Tashkent` : (inputs.district ? `${inputs.district}, Tashkent` : "Tashkent");

  return {
    request_id: fmtId,
    scenario_id: scenarioId,
    business_type: inputs.business_type || "—",
    location: districtFromGeo,
    market, demand, location_block, financial, competition, credit,
    factors: { positives: [], risks: [], next_actions: [] },  // synthesis fills these
    verdict: {
      label, short_label, confidence, composite_score: composite,
      blurb: composite > 0
        ? `Composite ${composite}/100 — ${short_label}. Run Synthesis for the bank-grade explanation.`
        : "Run the agents to compute a recommendation.",
    },
    models: [
      { id: "M-A1", name: "Market Sizing",          version: "live", confidence: mkt ? 0.80 : 0,  last_retrain: new Date().toISOString().slice(0, 10) },
      { id: "M-A3", name: "Saturation Index",       version: "live", confidence: mkt ? 0.78 : 0,  last_retrain: new Date().toISOString().slice(0, 10) },
      { id: "M-C1", name: "Location Score",         version: "live", confidence: loc ? 0.82 : 0,  last_retrain: new Date().toISOString().slice(0, 10) },
      { id: "M-D1", name: "Viability Check",        version: "live", confidence: fin ? 0.76 : 0,  last_retrain: new Date().toISOString().slice(0, 10) },
      { id: "M-E1", name: "Competitor Intelligence",version: "live", confidence: loc ? 0.84 : 0,  last_retrain: new Date().toISOString().slice(0, 10) },
      { id: "M-F1", name: "Credit Risk Score",      version: "derived", confidence: fin ? 0.72 : 0, last_retrain: new Date().toISOString().slice(0, 10) },
    ],
  };
}

function compositePartial(
  blocks: Array<{ score: number; weight: number; ready: boolean; inverted?: boolean }>,
): number {
  const ready = blocks.filter((b) => b.ready);
  if (ready.length === 0) return 0;
  const totalWeight = ready.reduce((acc, b) => acc + b.weight, 0);
  const weighted = ready.reduce((acc, b) => {
    const eff = b.inverted ? 100 - b.score : b.score;
    return acc + eff * b.weight;
  }, 0);
  return Math.round(weighted / totalWeight);
}

function deriveCompetition(loc: LocationAgentResult | null, mkt: MarketAgentResult | null) {
  const c500 = loc?.competitors_within_500m ?? 0;
  const c1k  = loc?.competitors_within_1km ?? 0;
  const sat  = mkt?.saturation_index ?? Math.min(100, c500 * 12);
  // density 0-100 from raw competitor count
  const density = Math.min(100, c500 * 12 + c1k * 2);
  // failure probability: blend saturation and density, cap 90
  const failure = Math.min(90, Math.round((sat + density) / 2.5));
  const score = Math.min(100, Math.round((sat + density) / 2));
  const risk_level: "Low" | "Medium" | "High" | "Critical" =
    score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 40 ? "Medium" : "Low";
  return {
    direct_competitors: c500,
    competitor_density_index: density,
    failure_probability_pct: failure,
    risk_level,
    score,
  };
}

function deriveCredit(fin: FinancialsAgentResult, inputs: ScenarioInputs) {
  const loanM = Math.round((inputs.loan_uzs || 0) / 1_000_000);
  const otherIncomeM = Math.max(0.1, inputs.other_monthly_income_m_uzs || 0);
  const monthlyDebtM = inputs.existing_monthly_debts_m_uzs || 0;
  const monthlyRepaymentM = inputs.repayment_months > 0 ? loanM / inputs.repayment_months : 0;
  const dti = Number(((monthlyDebtM + monthlyRepaymentM) / otherIncomeM).toFixed(2));

  // Readiness: starts from financial viability, then adjusted for collateral,
  // cosigner, founder track record and DTI.
  let readiness = fin.score;
  if (inputs.collateral_type === "real_estate") readiness += 12;
  else if (inputs.collateral_type === "vehicle" || inputs.collateral_type === "deposit") readiness += 8;
  else if (inputs.collateral_type === "equipment") readiness += 5;
  if (inputs.has_cosigner) readiness += 6;
  if (inputs.business_insurance_planned) readiness += 3;
  if (inputs.owner_experience === "established") readiness += 8;
  else if (inputs.owner_experience === "some") readiness += 3;
  else if (inputs.owner_experience === "none") readiness -= 6;
  readiness -= (inputs.prior_business_failures || 0) * 6;
  if (dti > 0.5) readiness -= 10;
  else if (dti > 0.35) readiness -= 4;
  readiness = Math.max(0, Math.min(100, Math.round(readiness)));

  // Suggest a product based on collateral + loan size.
  const product =
    loanM === 0 ? "No loan requested"
    : inputs.collateral_type === "equipment" ? "Equipment leasing"
    : inputs.collateral_type === "real_estate" ? "Secured SME term loan"
    : loanM >= 200 ? "SME term loan + guarantee"
    : "SME working capital";

  return {
    suggested_loan_m_uzs: loanM,
    dti,
    credit_readiness: readiness,
    product,
    score: readiness,
  };
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-navy/[0.03] p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{k}</div>
      <div className="font-display font-bold text-navy text-sm mt-0.5">{v}</div>
    </div>
  );
}
