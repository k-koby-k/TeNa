import {
  LayoutDashboard, BarChart3, MapPin, Wallet,
  ShieldCheck, Sparkles, Plus, ArrowRight,
  ClipboardList, Lock, Check as CheckIcon,
  Inbox, Building2, UserCircle,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useScenario } from "../state";
import { api, type HistoryItem } from "../api";

export type ViewKey =
  | "Profile"
  | "Location"
  | "Market"
  | "Financials"
  | "Overview"
  | "Explainability"
  | "History"
  // Banker mode views:
  | "Queue";

export type Mode = "founder" | "banker";

const FOUNDER_NAV: { icon: any; label: ViewKey }[] = [
  { icon: ClipboardList,   label: "Profile" },
  { icon: MapPin,          label: "Location" },
  { icon: BarChart3,       label: "Market" },
  { icon: Wallet,          label: "Financials" },
  { icon: LayoutDashboard, label: "Overview" },
  { icon: ShieldCheck,     label: "Explainability" },
];

// Banker can do everything a founder can — needed for cases where a banker
// fills the form on behalf of a walk-in applicant — plus the Queue inbox at
// the top.
const BANKER_NAV: { icon: any; label: ViewKey }[] = [
  { icon: Inbox,           label: "Queue" },
  { icon: ClipboardList,   label: "Profile" },
  { icon: MapPin,          label: "Location" },
  { icon: BarChart3,       label: "Market" },
  { icon: Wallet,          label: "Financials" },
  { icon: LayoutDashboard, label: "Overview" },
  { icon: ShieldCheck,     label: "Explainability" },
];

const dot = (label: string) =>
  label === "YES" ? "bg-emerald" : label === "MAYBE" ? "bg-amber" : "bg-rose-500";

const relTime = (iso: string) => {
  const dt = (Date.now() - new Date(iso).getTime()) / 1000;
  if (dt < 60) return "now";
  if (dt < 3600) return `${Math.round(dt / 60)}m`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h`;
  return `${Math.round(dt / 86400)}d`;
};

export function Sidebar({
  active, onChange, mode, onModeChange,
}: {
  active: ViewKey;
  onChange: (v: ViewKey) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
}) {
  const { reset, result, hydrate, completion } = useScenario();
  const [recent, setRecent] = useState<HistoryItem[]>([]);

  const NAV = mode === "founder" ? FOUNDER_NAV : BANKER_NAV;

  // Lock rules apply only to founder mode. In banker mode, all views are open.
  const isLocked = (label: ViewKey) => {
    if (mode === "banker") return false;
    if (label === "Profile" || label === "History" || label === "Explainability") return false;
    if (!completion.profile) return true;
    if (label === "Overview") return !completion.anyMetric;
    return false;
  };
  const isCompleted = (label: ViewKey): boolean => {
    if (label === "Profile") return completion.profile;
    if (label === "Location") return completion.location;
    if (label === "Market") return completion.market;
    if (label === "Financials") return completion.financials;
    if (label === "Overview") return completion.allMetrics;
    return false;
  };

  // Re-fetch whenever the current result changes (a new analysis was just saved).
  useEffect(() => {
    let cancelled = false;
    api.history()
      .then((r) => { if (!cancelled) setRecent(r.items.slice(0, 6)); })
      .catch(() => { /* offline fallback: keep whatever we have */ });
    return () => { cancelled = true; };
  }, [result?.scenario_id]);

  async function openScenario(id: string) {
    try {
      const entry = await api.historyEntry(id);
      hydrate(entry.request, entry.response);
      onChange("Overview");
    } catch (e) { console.warn("hydrate failed", e); }
  }
  return (
    <aside className="w-64 shrink-0 border-r border-line bg-white/60 backdrop-blur flex flex-col">
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-navy text-white grid place-items-center shadow-soft">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="font-display font-bold text-navy leading-tight tracking-tight">TeNa</div>
          <div className="text-[11px] text-muted leading-tight">SME advisor · decision cockpit</div>
        </div>
      </div>

      {/* Mode toggle: Founder vs Banker */}
      <div className="px-3 mt-2">
        <div className="seg w-full">
          <button
            onClick={() => { onModeChange("founder"); onChange("Profile"); }}
            className={clsx("seg-btn flex items-center justify-center gap-1.5", mode === "founder" && "seg-btn-active")}
          >
            <UserCircle size={12} /> Founder
          </button>
          <button
            onClick={() => { onModeChange("banker"); onChange("Queue"); }}
            className={clsx("seg-btn flex items-center justify-center gap-1.5", mode === "banker" && "seg-btn-active")}
          >
            <Building2 size={12} /> Banker
          </button>
        </div>
      </div>

      <div className="px-3 mt-3">
        <button
          onClick={() => { reset(); onChange("Profile"); }}
          className="w-full mb-3 px-3 py-2.5 rounded-lg bg-petrol text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-navy-700 transition shadow-soft"
        >
          <Plus size={14} />
          {mode === "founder" ? "New analysis" : "New application"}
        </button>
        <div className="label px-3 mb-1">{mode === "founder" ? "Workspace" : "Banker workspace"}</div>
        <nav className="space-y-0.5">
          {NAV.map((n) => {
            const isActive = n.label === active;
            const locked = isLocked(n.label);
            const done = isCompleted(n.label);
            return (
              <button
                key={n.label}
                onClick={() => onChange(n.label)}
                className={clsx(
                  "nav-item w-full text-left",
                  isActive && "nav-item-active",
                  locked && !isActive && "opacity-50",
                )}
                title={locked ? "Complete the previous step first" : undefined}
              >
                <n.icon size={16} />
                <span className="flex-1">{n.label}</span>
                {locked
                  ? <Lock size={11} className="text-muted" />
                  : done
                    ? <CheckIcon size={12} className={isActive ? "text-white/80" : "text-emerald"} />
                    : isActive
                      ? <span className="chip bg-emerald/15 text-emerald">LIVE</span>
                      : null}
              </button>
            );
          })}
        </nav>
      </div>

      {mode === "founder" ? (
        <div className="px-3 mt-6 flex-1 min-h-0 flex flex-col">
          <button
            onClick={() => onChange("History")}
            className="flex items-center justify-between px-3 mb-2 group"
          >
            <span className="label group-hover:text-navy transition">Recent</span>
            <span className="text-[10px] text-petrol font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
              View all <ArrowRight size={10} />
            </span>
          </button>
          <div className="space-y-1 overflow-y-auto pr-1">
            {recent.length === 0 && (
              <div className="text-[11px] text-muted px-3 py-2">No analyses yet.</div>
            )}
            {recent.map((r) => {
              const isActive = result?.scenario_id === r.scenario_id;
              return (
                <button
                  key={r.scenario_id}
                  onClick={() => openScenario(r.scenario_id)}
                  className={clsx(
                    "nav-item w-full text-left",
                    isActive && "bg-navy/5 text-navy"
                  )}
                >
                  <span className={clsx("w-2 h-2 rounded-full shrink-0", dot(r.short_label))} />
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="text-[13px] text-navy font-medium truncate">{r.business_type}</div>
                    <div className="text-[11px] text-muted truncate">{r.location.split(",")[0]} · {r.composite_score}/100</div>
                  </div>
                  <span className="text-[10px] text-muted shrink-0">{relTime(r.created_at)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="mt-auto p-3">
        <div className="card p-3 flex items-center gap-3">
          <div className={clsx(
            "w-9 h-9 rounded-full text-white grid place-items-center text-sm font-semibold",
            mode === "banker" ? "bg-petrol" : "bg-emerald",
          )}>
            {mode === "banker" ? "AK" : "FN"}
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-semibold text-navy">
              {mode === "banker" ? "Aziza Karimova" : "Founder"}
            </div>
            <div className="text-[11px] text-muted">
              {mode === "banker" ? "SME Credit Analyst · SQB" : "Demo session"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
