// Deal pipeline — the bank-facing marketplace of analyzed businesses.
// Includes this account's own analyses plus businesses analyzed by other
// founders, partners, and TeNa sourcing channels.
// Click any row → hydrates the dashboard with that scenario and jumps to
// Overview so the banker sees the full underwriting one-pager.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Inbox, Search, ArrowRight, Loader2, Phone, Clock, X,
  TrendingUp, AlertTriangle, ShieldCheck, SlidersHorizontal,
  RotateCcw, ArrowDownUp,
} from "lucide-react";
import clsx from "clsx";
import { api, type HistoryItem } from "../api";
import { useScenario } from "../state";
import type { ViewKey } from "./Sidebar";
import { useT } from "../i18n";

type Bucket = "YES" | "MAYBE" | "NO" | "ALL";
type ScoreBand = "ALL" | "HIGH" | "MEDIUM" | "LOW";
type SortKey = "NEWEST" | "SCORE_DESC" | "SCORE_ASC" | "REC";
type SourceFilter = "ALL" | "marketplace" | "own";

const districtOf = (item: HistoryItem) => item.location.split(",")[0]?.trim() || "Unknown";

const scoreBand = (score: number): Exclude<ScoreBand, "ALL"> =>
  score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";

export function BankerQueue({ onChange }: { onChange: (v: ViewKey) => void }) {
  const { hydrate } = useScenario();
  const t = useT();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [businessType, setBusinessType] = useState("ALL");
  const [district, setDistrict] = useState("ALL");
  const [band, setBand] = useState<ScoreBand>("ALL");
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("NEWEST");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    api.applications()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  const counts = useMemo(() => {
    const i = items ?? [];
    return {
      YES: i.filter((x) => x.short_label === "YES").length,
      MAYBE: i.filter((x) => x.short_label === "MAYBE").length,
      NO: i.filter((x) => x.short_label === "NO").length,
      ALL: i.length,
    };
  }, [items]);

  const filterOptions = useMemo(() => {
    const i = items ?? [];
    return {
      businessTypes: Array.from(new Set(i.map((x) => x.business_type))).sort(),
      districts: Array.from(new Set(i.map(districtOf))).sort(),
    };
  }, [items]);

  const visible = useMemo(() => {
    let list = items ?? [];
    if (bucket !== "ALL") list = list.filter((x) => x.short_label === bucket);
    if (businessType !== "ALL") list = list.filter((x) => x.business_type === businessType);
    if (district !== "ALL") list = list.filter((x) => districtOf(x) === district);
    if (band !== "ALL") list = list.filter((x) => scoreBand(x.composite_score) === band);
    if (source !== "ALL") list = list.filter((x) => (x.source ?? "marketplace") === source);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((x) =>
        x.business_type.toLowerCase().includes(q) ||
        x.location.toLowerCase().includes(q) ||
        x.scenario_id.toLowerCase().includes(q),
      );
    }
    const recRank = { YES: 0, MAYBE: 1, NO: 2 };
    list = [...list].sort((a, b) => {
      if (sort === "SCORE_DESC") return b.composite_score - a.composite_score;
      if (sort === "SCORE_ASC") return a.composite_score - b.composite_score;
      if (sort === "REC") return recRank[a.short_label] - recRank[b.short_label] || b.composite_score - a.composite_score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [items, bucket, businessType, district, band, source, sort, query]);

  const hasFilters =
    bucket !== "ALL" || businessType !== "ALL" || district !== "ALL" ||
    band !== "ALL" || source !== "ALL" || sort !== "NEWEST" || !!query.trim();

  const filterCount = [
    source !== "ALL",
    businessType !== "ALL",
    district !== "ALL",
    band !== "ALL",
    sort !== "NEWEST",
  ].filter(Boolean).length;

  function resetFilters() {
    setBucket("ALL");
    setBusinessType("ALL");
    setDistrict("ALL");
    setBand("ALL");
    setSource("ALL");
    setSort("NEWEST");
    setQuery("");
  }

  async function open(id: string) {
    setOpening(id);
    try {
      const entry = await api.historyEntry(id);
      hydrate(entry.request, entry.response);
      onChange("Overview");
    } catch (e) { console.warn(e); }
    finally { setOpening(null); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
            <Inbox size={20} />
          </div>
          <div className="flex-1">
            <div className="label">{t("Bank sales · all analyzed businesses")}</div>
            <h1 className="font-display text-xl text-navy font-bold">{t("Deal Pipeline")}</h1>
            <p className="text-sm text-muted mt-0.5">
              {t("Loan-ready businesses from founders and partner analyses. Use this view to source qualified SME borrowers for bank relationship managers.")}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <Clock size={12} />
            <span>{t("Last refresh just now")}</span>
          </div>
        </div>

      </div>

      <div className="card p-3">
        <div className="grid grid-cols-4 gap-2">
          <StatusTab label={t("All deals")} count={counts.ALL} active={bucket === "ALL"} onClick={() => setBucket("ALL")} />
          <StatusTab label={t("Ready")} count={counts.YES} active={bucket === "YES"} onClick={() => setBucket("YES")} tone="emerald" />
          <StatusTab label={t("Conditional")} count={counts.MAYBE} active={bucket === "MAYBE"} onClick={() => setBucket("MAYBE")} tone="amber" />
          <StatusTab label={t("Decline")} count={counts.NO} active={bucket === "NO"} onClick={() => setBucket("NO")} tone="rose" />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9 pr-9 h-10"
              placeholder={t("Search business / district / ID…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={clsx(
              "h-10 px-3 rounded-lg border text-[12px] font-semibold flex items-center gap-2 transition",
              filtersOpen || filterCount > 0
                ? "border-petrol text-petrol bg-petrol/5"
                : "border-line text-navy hover:bg-navy/5",
            )}
          >
            <SlidersHorizontal size={14} />
            {t("Filters")}
            {filterCount > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-petrol text-white text-[10px] grid place-items-center">
                {filterCount}
              </span>
            )}
          </button>
          <button
            onClick={resetFilters}
            disabled={!hasFilters}
            className={clsx(
              "h-10 px-3 rounded-lg border text-[12px] font-semibold flex items-center gap-1.5 transition",
              hasFilters ? "border-line text-navy hover:bg-navy/5" : "border-line text-muted opacity-50 cursor-not-allowed",
            )}
            title={t("Reset filters")}
          >
            <RotateCcw size={13} /> {t("Reset")}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 rounded-lg border border-line bg-navy/[0.025] p-3">
            <div className="grid grid-cols-5 gap-3">
              <PanelSelect label={t("Source")} value={source} onChange={(v) => setSource(v as SourceFilter)}>
                <option value="ALL">{t("All sources")}</option>
                <option value="marketplace">{t("Marketplace")}</option>
                <option value="own">{t("My analyses")}</option>
              </PanelSelect>
              <PanelSelect label={t("Score")} value={band} onChange={(v) => setBand(v as ScoreBand)}>
                <option value="ALL">{t("Any score")}</option>
                <option value="HIGH">{t("70+ strong")}</option>
                <option value="MEDIUM">{t("50-69 conditional")}</option>
                <option value="LOW">{t("Below 50 decline")}</option>
              </PanelSelect>
              <PanelSelect label={t("Business type")} value={businessType} onChange={setBusinessType}>
                <option value="ALL">{t("All types")}</option>
                {filterOptions.businessTypes.map((x) => <option key={x} value={x}>{t(x)}</option>)}
              </PanelSelect>
              <PanelSelect label={t("District")} value={district} onChange={setDistrict}>
                <option value="ALL">{t("All districts")}</option>
                {filterOptions.districts.map((x) => <option key={x}>{x}</option>)}
              </PanelSelect>
              <PanelSelect label={t("Sort")} value={sort} onChange={(v) => setSort(v as SortKey)}>
                <option value="NEWEST">{t("Newest")}</option>
                <option value="SCORE_DESC">{t("Top score")}</option>
                <option value="SCORE_ASC">{t("Lowest score")}</option>
                <option value="REC">{t("Recommendation")}</option>
              </PanelSelect>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
          <span>{items ? `${visible.length} ${t("of")} ${items.length} ${t("deals")}` : "—"}</span>
          {hasFilters && (
            <div className="flex flex-wrap gap-1.5">
            {bucket !== "ALL" && <ActiveTag onClear={() => setBucket("ALL")}>{bucketLabel(bucket, t)}</ActiveTag>}
            {source !== "ALL" && <ActiveTag onClear={() => setSource("ALL")}>{source === "own" ? t("My analyses") : t("Marketplace")}</ActiveTag>}
            {businessType !== "ALL" && <ActiveTag onClear={() => setBusinessType("ALL")}>{t(businessType)}</ActiveTag>}
            {district !== "ALL" && <ActiveTag onClear={() => setDistrict("ALL")}>{district}</ActiveTag>}
            {band !== "ALL" && <ActiveTag onClear={() => setBand("ALL")}>{bandLabel(band, t)}</ActiveTag>}
            </div>
          )}
        </div>
      </div>

      {/* Queue list */}
      {items === null ? (
        <div className="card p-10 text-center text-muted text-[13px]">{t("Loading queue…")}</div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center text-muted text-[13px]">
          {query ? t("No matches.") : t("No applications in this bucket yet.")}
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          {/* Column header */}
          <div className="min-w-[1040px] grid grid-cols-[80px_1.4fr_1fr_110px_120px_120px_130px_90px] gap-3 px-5 py-2.5 bg-navy/[0.03] border-b border-line text-[10px] uppercase tracking-wider text-muted font-semibold">
            <span>{t("Rec.")}</span>
            <span>{t("Business")}</span>
            <span>{t("Location")}</span>
            <button onClick={() => setSort(sort === "SCORE_DESC" ? "SCORE_ASC" : "SCORE_DESC")} className="flex items-center gap-1 hover:text-navy">
              {t("Composite")} <ArrowDownUp size={10} />
            </button>
            <span>{t("Sub-scores")}</span>
            <span>{t("Source")}</span>
            <span>{t("Submitted")}</span>
            <span></span>
          </div>
          {visible.map((r) => (
            <QueueRow key={r.scenario_id} item={r} opening={opening === r.scenario_id} onOpen={() => open(r.scenario_id)} />
          ))}
        </div>
      )}

      {/* Soft KPIs row */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          icon={TrendingUp} title={t("Auto-approve rate")}
          value={items ? `${Math.round((counts.YES / Math.max(1, counts.ALL)) * 100)}%` : "—"}
          sub={`${counts.YES} ${t("of")} ${counts.ALL} ${t("flagged for launch")}`}
          tone="emerald"
        />
        <KpiCard
          icon={AlertTriangle} title={t("Conditions required")}
          value={items ? String(counts.MAYBE) : "—"}
          sub={t("Borderline — relationship-manager call")}
          tone="amber"
        />
        <KpiCard
          icon={ShieldCheck} title={t("Avoided risk")}
          value={items ? String(counts.NO) : "—"}
          sub={t("TeNa flagged before disbursement")}
          tone="rose"
        />
      </div>
    </div>
  );
}

function StatusTab({
  label, count, active, onClick, tone = "navy",
}: {
  label: string; count: number; active: boolean; onClick: () => void;
  tone?: "navy" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald" ? "text-emerald"
    : tone === "amber" ? "text-amber"
    : tone === "rose" ? "text-rose-500"
    : "text-navy";
  return (
    <button
      onClick={onClick}
      className={clsx(
        "h-16 rounded-lg border px-3 text-left transition",
        active ? "border-petrol bg-petrol/5 shadow-soft" : "border-line bg-white hover:bg-navy/[0.02]",
      )}
    >
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">{label}</div>
      <div className={clsx("font-display font-bold text-xl leading-tight mt-0.5", active ? "text-petrol" : toneClass)}>
        {count}
      </div>
    </button>
  );
}

function PanelSelect({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</span>
      <select
        className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2.5 text-[12px] font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-petrol/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function ActiveTag({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-petrol/10 text-petrol font-semibold"
    >
      {children} <X size={10} />
    </button>
  );
}

function bandLabel(band: ScoreBand, t: (key: string) => string) {
  if (band === "HIGH") return t("70+");
  if (band === "MEDIUM") return t("50-69");
  if (band === "LOW") return t("<50");
  return t("Any");
}

function bucketLabel(bucket: Bucket, t: (key: string) => string) {
  if (bucket === "YES") return t("Ready");
  if (bucket === "MAYBE") return t("Conditional");
  if (bucket === "NO") return t("Decline");
  return t("All");
}

function QueueRow({
  item, opening, onOpen,
}: { item: HistoryItem; opening: boolean; onOpen: () => void }) {
  const t = useT();
  const tone =
    item.short_label === "YES" ? "bg-emerald text-white"
  : item.short_label === "MAYBE" ? "bg-amber text-white"
  : "bg-rose-500 text-white";
  const label =
    item.short_label === "YES" ? t("Launch")
  : item.short_label === "MAYBE" ? t("Caution")
  : t("Decline");

  // Crude sub-scores derived from the composite + label so the queue row has
  // a quick at-a-glance feel. The full breakdown lives in Overview.
  const sub = item.composite_score;
  return (
    <button
      onClick={onOpen}
      className="min-w-[1040px] w-full grid grid-cols-[80px_1.4fr_1fr_110px_120px_120px_130px_90px] gap-3 px-5 py-3 items-center text-left hover:bg-navy/[0.02] border-b border-line last:border-b-0 transition"
    >
      <span className={clsx("chip text-[11px] font-bold px-2 py-1", tone)}>{label}</span>

      <div className="min-w-0">
        <div className="font-display font-semibold text-navy truncate text-[13px]">{item.business_type}</div>
        {item.contact_name ? (
          <div className="text-[11px] text-navy/70 truncate flex items-center gap-1">
            <span className="font-medium">{item.contact_name}</span>
            {item.contact_phone && <span className="text-muted font-mono">· {item.contact_phone}</span>}
          </div>
        ) : (
          <div className="text-[11px] text-muted truncate font-mono">{item.scenario_id}</div>
        )}
      </div>

      <div className="text-[12px] text-navy truncate">{item.location}</div>

      <div className="flex items-baseline gap-1">
        <span className={clsx(
          "font-display font-bold text-lg",
          sub >= 70 ? "text-emerald" : sub >= 50 ? "text-amber" : "text-rose-500",
        )}>{sub}</span>
        <span className="text-[10px] text-muted">/100</span>
      </div>

      <MiniBars score={sub} />

      <div className="min-w-0">
        <div className={clsx(
          "chip text-[10px]",
          item.source === "own" ? "bg-petrol/10 text-petrol" : "bg-navy/5 text-navy",
        )}>
          {item.source === "own" ? t("My analysis") : t("Marketplace")}
        </div>
        <div className="text-[10px] text-muted truncate mt-0.5">{item.submitted_by ?? "TeNa"}</div>
      </div>

      <span className="text-[11px] text-muted">{relTime(item.created_at, t)}</span>

      <div className="flex items-center justify-end gap-1.5">
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (item.contact_phone) {
              window.location.href = `tel:${item.contact_phone.replace(/[^\d+]/g, "")}`;
            }
          }}
          className={clsx(
            "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded",
            item.contact_phone ? "text-petrol hover:bg-petrol/10" : "text-muted opacity-50",
          )}
          title={item.contact_phone ? `${t("Call")} ${item.contact_name ?? t("owner")} · ${item.contact_phone}` : t("No contact number")}
        >
          <Phone size={11} /> {t("Call")}
        </span>
        {opening
          ? <Loader2 size={14} className="animate-spin text-petrol" />
          : <ArrowRight size={14} className="text-petrol" />}
      </div>
    </button>
  );
}

function MiniBars({ score }: { score: number }) {
  // 4 little bars suggesting per-block scores. Decorative — derived from the
  // composite for visual rhythm in the queue.
  const bars = [
    score + 5,
    score - 3,
    score + 1,
    score - 6,
  ].map((v) => Math.max(20, Math.min(95, v)));
  return (
    <div className="flex items-end gap-0.5 h-6">
      {bars.map((v, i) => (
        <span
          key={i}
          className={clsx(
            "w-1.5 rounded-sm",
            v >= 70 ? "bg-emerald" : v >= 50 ? "bg-amber" : "bg-rose-500",
          )}
          style={{ height: `${v}%` }}
        />
      ))}
    </div>
  );
}

function KpiCard({
  icon: Icon, title, value, sub, tone,
}: {
  icon: any; title: string; value: string; sub: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const colour =
    tone === "emerald" ? "bg-emerald/10 text-emerald"
  : tone === "amber"   ? "bg-amber/10 text-amber"
  :                      "bg-rose-100 text-rose-600";
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className={clsx("w-10 h-10 rounded-lg grid place-items-center", colour)}>
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="label">{title}</div>
          <div className="font-display font-bold text-navy text-2xl mt-1">{value}</div>
          <div className="text-[11px] text-muted mt-0.5">{sub}</div>
        </div>
      </div>
    </div>
  );
}

function relTime(iso: string, t: (key: string) => string): string {
  const dt = (Date.now() - new Date(iso).getTime()) / 1000;
  if (dt < 60)    return t("just now");
  if (dt < 3600)  return `${Math.round(dt / 60)} ${t("min ago")}`;
  if (dt < 86400) return `${Math.round(dt / 3600)} ${t("h ago")}`;
  return `${Math.round(dt / 86400)} ${t("d ago")}`;
}
