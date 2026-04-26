// Holds two side-screen views accessible from the sidebar:
//   - Explainability: the agent / model registry, populated live from
//     whichever agents have run.
//   - History:        every analysis recorded on the backend.
// Both feed off the live state — nothing hardcoded.

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ShieldCheck, History, FileText, Search } from "lucide-react";
import type { ViewKey } from "./Sidebar";
import { useScenario } from "../state";
import { api, type HistoryItem } from "../api";

export function CategoryView({ view }: { view: ViewKey }) {
  if (view === "Explainability") return <ExplainabilityView />;
  if (view === "History")        return <HistoryView />;
  return null;
}

/* ------------------------------- Explainability ----------------------------- */

function ExplainabilityView() {
  const { result } = useScenario();
  const models = result?.models ?? [];

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
          <ShieldCheck size={20} />
        </div>
        <div className="flex-1">
          <div className="label">Governance · agent registry</div>
          <h1 className="font-display text-xl text-navy font-bold">Explainability & model metadata</h1>
          <p className="text-sm text-muted mt-0.5">
            Every agent that ran for the current scenario, with its version, confidence and model lineage.
            Confidence of 0 means the agent was not invoked yet.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {models.length === 0 ? (
          <div className="col-span-2 text-[12px] text-muted py-8 text-center">
            No analysis run yet — go to Overview and press <span className="font-semibold text-navy">Run full analysis</span>.
          </div>
        ) : models.map((m) => {
          const ran = m.confidence > 0;
          return (
            <div key={m.id} className={clsx("p-4 border border-line rounded-xl2 bg-white", !ran && "opacity-60")}>
              <div className="flex items-center justify-between">
                <span className="chip bg-navy/5 text-navy">{m.id}</span>
                <span className="text-[11px] text-muted">v{m.version}</span>
              </div>
              <div className="mt-2 font-display font-semibold text-navy">{m.name}</div>
              <div className="text-[11px] text-muted">
                {ran
                  ? <>Confidence {Math.round(m.confidence * 100)}% · ran {m.last_retrain}</>
                  : "Not invoked for this scenario"}
              </div>
              <div className="mt-2 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                <div className="h-full bg-petrol" style={{ width: `${m.confidence * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-line text-[11px] text-muted">
        Decision support · human-in-the-loop · audit log enabled · agents and the synthesis layer all run on Gemini 2.5 Flash with structured-output schemas.
      </div>
    </div>
  );
}

/* --------------------------------- History --------------------------------- */

const tone = (s: string) =>
  s === "YES" ? "bg-emerald/15 text-emerald"
  : s === "MAYBE" ? "bg-amber/15 text-amber"
  : "bg-rose-100 text-rose-600";
const toneLabel = (s: string) => (s === "YES" ? "Launch" : s === "MAYBE" ? "Caution" : "Not now");

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today.getTime() - 86400_000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const hhmm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (sameDay(d, today)) return `Today · ${hhmm}`;
  if (sameDay(d, yest))  return `Yesterday · ${hhmm}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ` · ${hhmm}`;
};

function HistoryView() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { hydrate } = useScenario();

  useEffect(() => {
    let cancelled = false;
    api.history()
      .then((r) => { if (!cancelled) setItems(r.items); })
      .catch((e) => { if (!cancelled) setErr(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, []);

  async function open(id: string) {
    try {
      const entry = await api.historyEntry(id);
      hydrate(entry.request, entry.response);
    } catch (e) { console.warn("hydrate failed", e); }
  }

  const visible = (items ?? []).filter((r) =>
    !query.trim() ||
    r.business_type.toLowerCase().includes(query.toLowerCase()) ||
    r.location.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
          <History size={20} />
        </div>
        <div className="flex-1">
          <div className="label">Audit · activity</div>
          <h1 className="font-display text-xl text-navy font-bold">Recent activity</h1>
          <p className="text-sm text-muted mt-0.5">
            Every scenario you've run on this engine. Click to restore one to the dashboard.
          </p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-8 w-56"
            placeholder="Search analyses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="chip bg-navy/5 text-navy">
          <FileText size={12} /> Analyses · {items?.length ?? 0}
        </span>
        <div className="text-[11px] text-muted">Sorted by most recent</div>
      </div>

      {err && <div className="mt-3 text-[12px] text-rose-600">Failed to load history: {err}</div>}

      {items === null && !err && (
        <div className="mt-6 text-sm text-muted text-center py-8">Loading…</div>
      )}
      {items !== null && visible.length === 0 && (
        <div className="mt-6 text-sm text-muted text-center py-8">
          {query ? "No matches." : "Run your first analysis — it'll show up here."}
        </div>
      )}

      <div className="mt-4 divide-y divide-line">
        {visible.map((r) => (
          <button
            key={r.scenario_id}
            onClick={() => open(r.scenario_id)}
            className="w-full text-left py-3 flex items-center gap-4 hover:bg-navy/[0.02] -mx-2 px-2 rounded-lg cursor-pointer transition"
          >
            <span className="text-[11px] text-muted font-mono w-28 truncate">{r.scenario_id}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-navy">
                {r.business_type} <span className="text-muted font-normal">· {r.location}</span>
              </div>
              <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                <span>{fmtTime(r.created_at)}</span>
                <span>·</span>
                <span>composite {r.composite_score}/100</span>
              </div>
            </div>
            <span className={clsx("chip", tone(r.short_label))}>{toneLabel(r.short_label)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
