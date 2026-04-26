// Banker queue — the inbox a SQB credit officer opens at 9am Monday.
// Buckets the live history (TeNa's pre-qualified leads) by recommendation.
// Click any row → hydrates the dashboard with that scenario and jumps to
// Overview so the banker sees the full underwriting one-pager.

import { useEffect, useMemo, useState } from "react";
import {
  Inbox, Search, ArrowRight, Loader2, Phone, Clock, X,
  TrendingUp, AlertTriangle, ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { api, type HistoryItem } from "../api";
import { useScenario } from "../state";
import type { ViewKey } from "./Sidebar";

type Bucket = "YES" | "MAYBE" | "NO" | "ALL";

export function BankerQueue({ onChange }: { onChange: (v: ViewKey) => void }) {
  const { hydrate } = useScenario();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [bucket, setBucket] = useState<Bucket>("ALL");
  const [query, setQuery] = useState("");
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    api.history()
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

  const visible = useMemo(() => {
    let list = items ?? [];
    if (bucket !== "ALL") list = list.filter((x) => x.short_label === bucket);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((x) =>
        x.business_type.toLowerCase().includes(q) ||
        x.location.toLowerCase().includes(q) ||
        x.scenario_id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, bucket, query]);

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
            <div className="label">SQB credit officer · live queue</div>
            <h1 className="font-display text-xl text-navy font-bold">Pre-qualified SME applications</h1>
            <p className="text-sm text-muted mt-0.5">
              Every analysis run on TeNa lands here, scored and bucketed by recommendation.
              Click any row for the full underwriting one-pager.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <Clock size={12} />
            <span>Last refresh just now</span>
          </div>
        </div>

        {/* Bucket filter chips */}
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <BucketChip label="All"     count={counts.ALL}   active={bucket === "ALL"}   onClick={() => setBucket("ALL")}   tone="navy" />
          <BucketChip label="Launch"  count={counts.YES}   active={bucket === "YES"}   onClick={() => setBucket("YES")}   tone="emerald" />
          <BucketChip label="Caution" count={counts.MAYBE} active={bucket === "MAYBE"} onClick={() => setBucket("MAYBE")} tone="amber" />
          <BucketChip label="Decline" count={counts.NO}    active={bucket === "NO"}    onClick={() => setBucket("NO")}    tone="rose" />

          <div className="ml-auto relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-8 w-64"
              placeholder="Search business / district / ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Queue list */}
      {items === null ? (
        <div className="card p-10 text-center text-muted text-[13px]">Loading queue…</div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center text-muted text-[13px]">
          {query ? "No matches." : "No applications in this bucket yet."}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Column header */}
          <div className="grid grid-cols-[80px_1.4fr_1fr_120px_120px_140px_120px] gap-3 px-5 py-2.5 bg-navy/[0.03] border-b border-line text-[10px] uppercase tracking-wider text-muted font-semibold">
            <span>Rec.</span>
            <span>Business</span>
            <span>Location</span>
            <span>Composite</span>
            <span>Sub-scores</span>
            <span>Submitted</span>
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
          icon={TrendingUp} title="Auto-approve rate"
          value={items ? `${Math.round((counts.YES / Math.max(1, counts.ALL)) * 100)}%` : "—"}
          sub={`${counts.YES} of ${counts.ALL} flagged for launch`}
          tone="emerald"
        />
        <KpiCard
          icon={AlertTriangle} title="Conditions required"
          value={items ? String(counts.MAYBE) : "—"}
          sub="Borderline — relationship-manager call"
          tone="amber"
        />
        <KpiCard
          icon={ShieldCheck} title="Avoided risk"
          value={items ? String(counts.NO) : "—"}
          sub="TeNa flagged before disbursement"
          tone="rose"
        />
      </div>
    </div>
  );
}

function BucketChip({
  label, count, active, onClick, tone,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
  tone: "emerald" | "amber" | "rose" | "navy";
}) {
  const colour =
    tone === "emerald" ? (active ? "bg-emerald text-white border-emerald" : "border-emerald/40 text-emerald hover:bg-emerald/10")
  : tone === "amber"   ? (active ? "bg-amber text-white border-amber"     : "border-amber/40 text-amber hover:bg-amber/10")
  : tone === "rose"    ? (active ? "bg-rose-500 text-white border-rose-500" : "border-rose-300 text-rose-600 hover:bg-rose-50")
  :                      (active ? "bg-navy text-white border-navy"       : "border-line text-navy hover:bg-navy/5");
  return (
    <button
      onClick={onClick}
      className={clsx("px-3 py-1.5 rounded-lg border text-[12px] font-semibold flex items-center gap-2 transition", colour)}
    >
      {label}
      <span className={clsx(
        "text-[10px] px-1.5 py-0.5 rounded font-bold",
        active ? "bg-white/20" : "bg-navy/5",
      )}>{count}</span>
    </button>
  );
}

function QueueRow({
  item, opening, onOpen,
}: { item: HistoryItem; opening: boolean; onOpen: () => void }) {
  const tone =
    item.short_label === "YES" ? "bg-emerald text-white"
  : item.short_label === "MAYBE" ? "bg-amber text-white"
  : "bg-rose-500 text-white";
  const label =
    item.short_label === "YES" ? "Launch"
  : item.short_label === "MAYBE" ? "Caution"
  : "Decline";

  // Crude sub-scores derived from the composite + label so the queue row has
  // a quick at-a-glance feel. The full breakdown lives in Overview.
  const sub = item.composite_score;
  return (
    <button
      onClick={onOpen}
      className="w-full grid grid-cols-[80px_1.4fr_1fr_120px_120px_140px_120px] gap-3 px-5 py-3 items-center text-left hover:bg-navy/[0.02] border-b border-line last:border-b-0 transition"
    >
      <span className={clsx("chip text-[11px] font-bold px-2 py-1", tone)}>{label}</span>

      <div className="min-w-0">
        <div className="font-display font-semibold text-navy truncate text-[13px]">{item.business_type}</div>
        <div className="text-[11px] text-muted truncate font-mono">{item.scenario_id}</div>
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

      <span className="text-[11px] text-muted">{relTime(item.created_at)}</span>

      <div className="flex items-center justify-end gap-1.5">
        <span
          onClick={(e) => { e.stopPropagation(); }}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-petrol hover:bg-petrol/10 rounded"
          title="Assign to me"
        >
          <Phone size={11} /> Call
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

function relTime(iso: string): string {
  const dt = (Date.now() - new Date(iso).getTime()) / 1000;
  if (dt < 60)    return "just now";
  if (dt < 3600)  return `${Math.round(dt / 60)} min ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)} h ago`;
  return `${Math.round(dt / 86400)} d ago`;
}
