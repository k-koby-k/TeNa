// Location screen — INPUT ONLY. Pin + site facts are captured here; the
// agent itself runs from the Overview "Run full analysis" button.
//
// Real interactive Leaflet map with Nominatim search + click-to-pin.

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, X, Target, Info } from "lucide-react";
import clsx from "clsx";
import { api, type PlaceHit } from "../api";
import { useScenario } from "../state";
import type { ViewKey } from "./Sidebar";
import { WizardSteps, WizardFooter } from "./Wizard";

const TASHKENT_CENTRE: [number, number] = [41.2995, 69.2401];

const pinIcon = L.divIcon({
  className: "site-pin",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#1B4965;box-shadow:0 0 0 3px white,0 2px 6px rgba(0,0,0,.3);"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});

export function LocationAgent({ onChange }: { onChange: (v: ViewKey) => void }) {
  const { inputs, setInput } = useScenario();

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const siteMarker = useRef<L.Marker | null>(null);
  const radiusLayer = useRef<L.LayerGroup | null>(null);

  const [coords, setCoords] = useState<[number, number] | null>(
    inputs.pin_lat && inputs.pin_lng ? [inputs.pin_lat, inputs.pin_lng] : null,
  );

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true })
      .setView(coords ?? TASHKENT_CENTRE, coords ? 15 : 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19,
    }).addTo(map);
    radiusLayer.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => placePin(e.latlng.lat, e.latlng.lng));
    if (coords) placePin(coords[0], coords[1], false);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placePin(lat: number, lng: number, recenter = true) {
    setCoords([lat, lng]);
    setInput("pin_lat", lat);
    setInput("pin_lng", lng);
    if (!mapRef.current) return;
    if (siteMarker.current) siteMarker.current.remove();
    siteMarker.current = L.marker([lat, lng], { icon: pinIcon }).addTo(mapRef.current);
    radiusLayer.current?.clearLayers();
    L.circle([lat, lng], { radius: 500, color: "#1B4965", weight: 1, fillOpacity: 0.04 }).addTo(radiusLayer.current!);
    L.circle([lat, lng], { radius: 1000, color: "#1B4965", weight: 1, dashArray: "4 6", fillOpacity: 0 }).addTo(radiusLayer.current!);
    if (recenter) mapRef.current.setView([lat, lng], 16);
  }

  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) { setHits([]); setSearchOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.geocodeSearch(q);
        setHits(r.items);
        // Always show results when they arrive — covers cases where input lost
        // focus during the in-flight request.
        if (r.items.length > 0) setSearchOpen(true);
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const ready = coords !== null;

  return (
    <div className="space-y-5">
      <WizardSteps active="Location" onChange={onChange} />

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
            <MapPin size={20} />
          </div>
          <div className="flex-1">
            <div className="label">Step 2 · Location & site</div>
            <h1 className="font-display text-xl text-navy font-bold">Where will it open?</h1>
            <p className="text-sm text-muted mt-0.5">
              Search or click the map to pin the candidate site, then add the lease facts you know.
              The Location agent will run from the Overview to fetch real competitors and synthesise the score.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Map column */}
        <div className="col-span-2 space-y-3">
          {/* Search bar — proper input field, can't be missed */}
          <div className="card p-4">
            <label className="label flex items-center gap-1.5 mb-2">
              <Search size={11} /> Search a place in Tashkent
            </label>
            <div className="relative">
              <input
                className="input pl-3 pr-9 text-[14px]"
                placeholder="Type a place name — 'Magic City', 'Chilonzor metro', 'Mustaqillik'…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => hits.length && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              />
              {query && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); setQuery(""); setHits([]); setSearchOpen(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
                ><X size={14} /></button>
              )}
              {searchOpen && hits.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-soft max-h-72 overflow-y-auto z-[1000]">
                  {hits.map((h, i) => (
                    <button
                      key={i}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        placePin(h.lat, h.lng);
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
            <div className="text-[11px] text-muted mt-2">
              Pick from the results, or click anywhere on the map below to drop a pin manually.
            </div>
          </div>

          <div className="card overflow-hidden">
            <div ref={mapEl} className="w-full h-[460px]" />
            <div className="px-4 py-3 border-t border-line flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-2 text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-petrol ring-2 ring-white" /> Site
                </span>
                <span>· 500 m solid · 1 km dashed</span>
              </div>
              <div className="text-navy font-mono text-[11px]">
                {coords ? `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}` : "click map or search to pin"}
              </div>
            </div>
          </div>
        </div>

        {/* Site facts */}
        <div className="card p-5 space-y-4">
          <div className="label">Site facts</div>
          <Field label="Site size" hint="sqm">
            <input className="input" placeholder="e.g. 75"
              value={inputs.site_size_sqm || ""}
              onChange={(e) => setInput("site_size_sqm", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Monthly rent" hint="UZS">
            <input className="input" placeholder="e.g. 14 000 000"
              value={inputs.monthly_rent_uzs ? inputs.monthly_rent_uzs.toLocaleString("en-US").replace(/,/g, " ") : ""}
              onChange={(e) => setInput("monthly_rent_uzs", Number(e.target.value.replace(/[^\d]/g, "")) || 0)} />
          </Field>
          <Field label="Lease term" hint="months">
            <Seg
              options={["6", "12", "24", "36", "60"]}
              value={String(inputs.lease_term_months || 12)}
              onChange={(v) => setInput("lease_term_months", Number(v))}
            />
          </Field>
          <Field label="Rent deposit" hint="months">
            <Seg
              options={["0", "1", "2", "3"]}
              value={String(inputs.rent_deposit_months ?? 0)}
              onChange={(v) => setInput("rent_deposit_months", Number(v))}
            />
          </Field>
          <Field label="Operating hours">
            <select className="input"
              value={inputs.operating_hours}
              onChange={(e) => setInput("operating_hours", e.target.value as any)}>
              <option value="">Select…</option>
              <option value="short">Short (≤ 8h)</option>
              <option value="standard">Standard (8–12h)</option>
              <option value="long">Long (12–18h)</option>
              <option value="24h">24 hours</option>
            </select>
          </Field>
          <Field label="Site type" hint="affects visibility">
            <select className="input"
              value={inputs.site_type}
              onChange={(e) => setInput("site_type", e.target.value as any)}>
              <option value="">Select…</option>
              <option value="street_front">Street-front</option>
              <option value="inside_building">Inside an office building</option>
              <option value="mall">Mall / shopping centre</option>
              <option value="basement">Basement / underground</option>
            </select>
          </Field>
          <Field label="Parking nearby">
            <Seg options={["None","Limited","Good"]}
              value={inputs.parking ? inputs.parking[0].toUpperCase() + inputs.parking.slice(1) : ""}
              onChange={(v) => setInput("parking", v.toLowerCase() as any)} />
          </Field>
          <div className="flex items-start gap-1.5 text-[11px] text-muted">
            <Info size={11} className="mt-0.5 shrink-0" />
            All site facts are optional but improve the agent's score.
          </div>
        </div>
      </div>

      {/* Quick jumps */}
      <div className="card p-4 flex items-center gap-3 text-[12px] flex-wrap">
        <Target size={14} className="text-petrol" />
        <span className="text-muted">Quick jump:</span>
        {[
          { name: "Chilonzor metro",  c: [41.2756, 69.2036] as [number, number] },
          { name: "Yunusobod metro",  c: [41.3637, 69.2879] as [number, number] },
          { name: "Mirzo Ulugbek",    c: [41.3251, 69.3361] as [number, number] },
          { name: "Sergeli",          c: [41.2225, 69.2253] as [number, number] },
          { name: "Magic City",       c: [41.3019, 69.2682] as [number, number] },
        ].map((p) => (
          <button key={p.name}
            onClick={() => { mapRef.current?.setView(p.c, 15); placePin(p.c[0], p.c[1]); }}
            className="px-2.5 py-1 rounded-md border border-line hover:bg-navy/5">
            {p.name}
          </button>
        ))}
      </div>

      <WizardFooter
        active="Location"
        onChange={onChange}
        currentDone={ready}
        doneHint="Pin a site on the map to continue."
        nextHint="Site captured. Next: tell the Market agent your commercial plan."
      />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-semibold text-navy">{label}</label>
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
        <div key={o} className={clsx("seg-btn", value === o && "seg-btn-active")} onClick={() => onChange(o)}>
          {o}
        </div>
      ))}
    </div>
  );
}
