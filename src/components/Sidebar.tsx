import {
  LayoutDashboard, BarChart3, MapPin, Wallet,
  Sparkles, Plus, ArrowRight,
  ClipboardList, Lock, Check as CheckIcon,
  Building2, UserCircle, BriefcaseBusiness,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useScenario } from "../state";
import { api, type HistoryItem } from "../api";
import { useT, useLang } from "../i18n";

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
];

const BANKER_EXTRA_NAV: { icon: any; label: ViewKey }[] = [
  { icon: BriefcaseBusiness, label: "Queue" },
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
  active, onChange, mode, onModeChange, allowModeSwitch = false,
}: {
  active: ViewKey;
  onChange: (v: ViewKey) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  /** Dev/demo only: show the founder↔banker switcher in the account card.
   *  In production the role is fixed by the subdomain. */
  allowModeSwitch?: boolean;
}) {
  const { reset, result, hydrate, completion } = useScenario();
  const t = useT();
  const { lang, setLang } = useLang();
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);

  const NAV = FOUNDER_NAV;

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
  // /api/history is now cookie-scoped: it returns THIS person's own analyses
  // (the anonymous cookie is our no-login identity), so it's correct for both
  // founders (their previous analyses) and bankers (their own submissions).
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
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-navy leading-tight tracking-tight">TeNa</div>
          <div className="text-[11px] text-muted leading-tight">{t("SME advisor · decision cockpit")}</div>
        </div>
        {/* Language toggle — small chip in the brand row */}
        <button
          onClick={() => setLang(lang === "uz" ? "en" : "uz")}
          title={lang === "uz" ? "Switch to English" : "O'zbek tiliga o'tish"}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-line text-navy hover:bg-navy/5 uppercase"
        >
          {lang === "uz" ? "UZ" : "EN"}
        </button>
      </div>

      <div className="px-3 mt-3">
        <button
          onClick={() => { reset(); onChange("Profile"); }}
          className="w-full mb-3 px-3 py-2.5 rounded-lg bg-petrol text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-navy-700 transition shadow-soft"
        >
          <Plus size={14} />
          {mode === "founder" ? t("New analysis") : t("New application")}
        </button>
        <div className="label px-3 mb-1">{t("Business analysis")}</div>
        <nav className="space-y-0.5">
          {NAV.map((n) => {
            const isActive = n.label === active;
            const locked = isLocked(n.label);
            const done = isCompleted(n.label);
            return (
              <button
                key={n.label}
                onClick={() => { if (!locked) onChange(n.label); }}
                disabled={locked}
                className={clsx(
                  "nav-item w-full text-left",
                  isActive && "nav-item-active",
                  locked && !isActive && "opacity-50 cursor-not-allowed",
                )}
                title={locked ? "Complete the previous step first" : undefined}
              >
                <n.icon size={16} />
                <span className="flex-1">{n.label === "Queue" ? t("Deal Pipeline") : t(n.label)}</span>
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
        {mode === "banker" && (
          <>
            <div className="label px-3 mt-4 mb-1">{t("Bank tools")}</div>
            <nav className="space-y-0.5">
              {BANKER_EXTRA_NAV.map((n) => {
                const isActive = n.label === active;
                return (
                  <button
                    key={n.label}
                    onClick={() => onChange(n.label)}
                    className={clsx(
                      "nav-item w-full text-left",
                      isActive && "nav-item-active",
                    )}
                  >
                    <n.icon size={16} />
                    <span className="flex-1">{t("Deal Pipeline")}</span>
                    {isActive && <span className="chip bg-emerald/15 text-emerald">LIVE</span>}
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </div>

      {/* Recent = this person's own analyses, cookie-scoped (our no-login
          identity). Shown for founders and bankers alike. */}
      <div className="px-3 mt-6 flex-1 min-h-0 flex flex-col">
        <button
          onClick={() => onChange("History")}
          className="flex items-center justify-between px-3 mb-2 group"
        >
          <span className="label group-hover:text-navy transition">{t("Recent")}</span>
          <span className="text-[10px] text-petrol font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            {t("View all")} <ArrowRight size={10} />
          </span>
        </button>
        <div className="space-y-1 overflow-y-auto pr-1">
          {recent.length === 0 && (
            <div className="text-[11px] text-muted px-3 py-2">{t("No analyses yet.")}</div>
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

      <div className="mt-auto p-3 relative">
        {allowModeSwitch && accountOpen && (
          <div className="absolute left-3 right-3 bottom-[76px] card p-2 z-20 shadow-soft">
            <button
              onClick={() => {
                onModeChange("founder");
                setAccountOpen(false);
                if (active === "Queue") onChange("Overview");
              }}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-navy/5",
                mode === "founder" && "bg-emerald/10",
              )}
            >
              <div className="w-8 h-8 rounded-full bg-emerald text-white grid place-items-center">
                <UserCircle size={16} />
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-[13px] font-semibold text-navy">{t("Founder")}</div>
                <div className="text-[11px] text-muted">{t("Demo session")}</div>
              </div>
            </button>
            <button
              onClick={() => {
                onModeChange("banker");
                setAccountOpen(false);
                onChange("Queue");
              }}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-navy/5",
                mode === "banker" && "bg-petrol/10",
              )}
            >
              <div className="w-8 h-8 rounded-full bg-petrol text-white grid place-items-center">
                <Building2 size={16} />
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-[13px] font-semibold text-navy">{t("Aziza Karimova")}</div>
                <div className="text-[11px] text-muted">{t("SME Credit Analyst · SQB")}</div>
              </div>
            </button>
          </div>
        )}
        <button
          onClick={() => { if (allowModeSwitch) setAccountOpen((v) => !v); }}
          className={clsx(
            "card p-3 flex items-center gap-3 w-full text-left transition",
            allowModeSwitch ? "hover:border-petrol cursor-pointer" : "cursor-default",
          )}
        >
          <div className={clsx(
            "w-9 h-9 rounded-full text-white grid place-items-center text-sm font-semibold",
            mode === "banker" ? "bg-petrol" : "bg-emerald",
          )}>
            {mode === "banker" ? "AK" : "FN"}
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-semibold text-navy">
              {mode === "banker" ? t("Aziza Karimova") : t("Founder")}
            </div>
            <div className="text-[11px] text-muted">
              {mode === "banker" ? t("SME Credit Analyst · SQB") : t("Demo session")}
            </div>
          </div>
          {allowModeSwitch && (
            <ChevronDown size={14} className={clsx("text-muted transition", accountOpen && "rotate-180")} />
          )}
        </button>
      </div>
    </aside>
  );
}
