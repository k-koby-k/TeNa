// Profile setup — first thing the user sees after "+ New analysis".
// Asks identity + concept ONLY. Location/site facts live on the Location screen
// (map decides the district). Asks 7 fields; 3 required.

import { useRef, useState } from "react";
import {
  ClipboardList, ArrowRight, Briefcase, MapPin, Sparkles,
  Upload, Loader2, AlertCircle, FileText, X, Wand2,
} from "lucide-react";
import clsx from "clsx";
import type { ViewKey } from "./Sidebar";
import { useScenario, isProfileComplete, type ScenarioInputs } from "../state";
import { WizardSteps, WizardFooter } from "./Wizard";
import { api, type ExtractedProfile } from "../api";

const TYPES = [
  "Coffee shop", "Restaurant", "Bakery", "Pharmacy", "Beauty salon",
  "Mini-market", "Gym", "Dental clinic", "Pet shop", "Bookstore",
];

export function ProfileSetup({ onContinue }: { onContinue: (v: ViewKey) => void }) {
  const { inputs, setInput } = useScenario();
  const complete = isProfileComplete(inputs);

  return (
    <div className="space-y-5">
      <WizardSteps active="Profile" onChange={onContinue} />

      <DeckUpload />


      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center">
            <ClipboardList size={20} />
          </div>
          <div className="flex-1">
            <div className="label">Step 1 of 4 · Business profile</div>
            <h1 className="font-display text-xl text-navy font-bold">Tell the agents about the business</h1>
            <p className="text-sm text-muted mt-0.5">
              Identity and concept only. The Location agent picks the district from your map pin.
              The clearer the description, the sharper the Market agent's TAM/SAM/SOM.
            </p>
          </div>
          <span className={clsx("chip", complete ? "bg-emerald/15 text-emerald" : "bg-amber/15 text-amber")}>
            {complete ? "Profile complete" : "Profile incomplete"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left card: identity */}
        <div className="card p-5 space-y-4">
          <Field label="Business name" req hint="how it'll show up on the dashboard">
            <input
              autoFocus
              className="input"
              placeholder="e.g. Black Bean Co."
              value={inputs.business_name}
              onChange={(e) => setInput("business_name", e.target.value)}
            />
          </Field>

          <Field label="Business type" req>
            <select
              className="input"
              value={inputs.business_type}
              onChange={(e) => setInput("business_type", e.target.value)}
            >
              <option value="">Select type…</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Format" hint="positioning across the category">
            <Seg
              options={["Kiosk", "Standard", "Premium"]}
              value={cap(inputs.format)}
              onChange={(v) => setInput("format", v.toLowerCase() as any)}
            />
          </Field>

          <Field label="Stage">
            <Seg
              options={["Idea", "Pilot", "Scale"]}
              value={cap(inputs.stage || "")}
              onChange={(v) => setInput("stage", v.toLowerCase() as any)}
            />
          </Field>
        </div>

        {/* Right card: concept */}
        <div className="card p-5 flex flex-col gap-4">
          <Field label="Concept description" req
            hint="1–4 sentences — niche, customer, what makes it different">
            <textarea
              className="input min-h-[160px] text-[13px] leading-relaxed"
              placeholder="e.g. Premium specialty coffee shop targeting young professionals near a metro. On-site roasting, evening dessert pairings, work-friendly seating with fast wifi."
              value={inputs.description}
              onChange={(e) => setInput("description", e.target.value)}
            />
          </Field>

          <Field label="Target audience">
            <select
              className="input"
              value={inputs.target_audience}
              onChange={(e) => setInput("target_audience", e.target.value as any)}
            >
              <option value="">Pick the primary audience…</option>
              <option value="office">Office workers / commuters</option>
              <option value="residents">Local residents</option>
              <option value="students">Students</option>
              <option value="tourists">Tourists</option>
              <option value="mixed">Mixed</option>
            </select>
          </Field>

          <Field label="Owner experience" hint="materially shifts credit risk">
            <Seg
              options={["None", "Some", "Established"]}
              value={cap(inputs.owner_experience || "")}
              onChange={(v) => setInput("owner_experience", v.toLowerCase() as any)}
            />
          </Field>
        </div>
      </div>

      {/* Next-step hand-offs */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="label">Next steps</div>
          {!complete && (
            <span className="text-[11px] text-muted">Fill the required fields to unlock the agents.</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <NextStep
            icon={MapPin} label="Location" enabled={complete}
            onClick={() => onContinue("Location")}
            blurb="Pin the site on a real map; agent fetches competitors + anchors and derives the district."
          />
          <NextStep
            icon={Briefcase} label="Market" enabled={complete}
            onClick={() => onContinue("Market")}
            blurb="Provide the commercial inputs (ticket, customers/day, reach) — agent sizes TAM/SAM/SOM."
          />
          <NextStep
            icon={Sparkles} label="Financials" enabled={complete}
            onClick={() => onContinue("Financials")}
            blurb="Capital, loan and horizon — agent infers the rest from sector benchmarks."
          />
        </div>
      </div>

      <WizardFooter
        active="Profile"
        onChange={onContinue}
        currentDone={complete}
        doneHint="Fill business name, type, and concept description to continue."
        nextHint="Profile complete. Pin the site on a real map next."
      />
    </div>
  );
}

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : "";

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
        <div key={o} className={clsx("seg-btn", value === o && "seg-btn-active")} onClick={() => onChange(o)}>
          {o}
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Pitch-deck upload --------------------------- */

function DeckUpload() {
  const { setInput } = useScenario();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [filename, setFilename] = useState<string>("");
  const [extracted, setExtracted] = useState<ExtractedProfile | null>(null);
  const [err, setErr] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  async function handle(file: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setState("error"); setErr("File is over 20 MB.");
      return;
    }
    setState("uploading"); setErr(""); setFilename(file.name);
    try {
      const res = await api.extractProfile(file);
      applyToInputs(res, setInput);
      setExtracted(res);
      setState("done");
    } catch (e: any) {
      setState("error"); setErr(String(e?.message ?? e).slice(0, 200));
    }
  }

  function reset() {
    setState("idle"); setExtracted(null); setFilename(""); setErr("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div
      className={clsx(
        "card p-5 transition",
        dragOver && "border-petrol bg-petrol/5",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber/10 text-amber grid place-items-center shrink-0">
          <Wand2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-navy">Got a pitch deck?</span>
            <span className="chip bg-navy/5 text-navy text-[10px]">Optional</span>
          </div>
          <p className="text-[12px] text-muted mt-0.5">
            Drop a PDF (deck, business plan, one-pager) and the agent pre-fills as much of the
            profile as it can. You can edit anything afterwards.
          </p>

          {state === "idle" && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 text-[12px] font-semibold border border-petrol text-petrol rounded-lg hover:bg-petrol hover:text-white transition flex items-center gap-1.5"
              >
                <Upload size={13} /> Upload a PDF
              </button>
              <span className="text-[11px] text-muted">…or drag-and-drop here · max 20 MB</span>
            </div>
          )}

          {state === "uploading" && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-petrol">
              <Loader2 size={13} className="animate-spin" /> Reading <span className="font-semibold">{filename}</span> with Gemini…
            </div>
          )}

          {state === "done" && extracted && (
            <ExtractedSummary file={filename} extracted={extracted} onReset={reset} />
          )}

          {state === "error" && (
            <div className="mt-3 text-[12px] text-rose-600 flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {err}
              <button onClick={reset} className="ml-2 underline">try again</button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
    </div>
  );
}

function ExtractedSummary({
  file, extracted, onReset,
}: { file: string; extracted: ExtractedProfile; onReset: () => void }) {
  const friendly: Record<string, string> = {
    business_name: "Name", business_type: "Type", format: "Format", stage: "Stage",
    description: "Description", target_audience: "Audience", owner_experience: "Experience",
    district: "District", niche: "Niche",
    budget_uzs: "Capital", monthly_rent_uzs: "Rent", loan_uzs: "Loan",
    average_ticket_uzs: "Avg ticket", customers_per_day: "Customers/day",
  };
  return (
    <div className="mt-3 p-3 bg-emerald/5 border border-emerald/30 rounded-lg">
      <div className="flex items-start gap-2">
        <FileText size={13} className="text-emerald mt-0.5" />
        <div className="flex-1 text-[12px] text-navy/85 leading-relaxed">
          <span className="font-semibold">{file}</span> — {extracted.source_summary
            ?? `${extracted.filled_fields.length} field${extracted.filled_fields.length === 1 ? "" : "s"} pre-filled.`}
        </div>
        <button onClick={onReset} className="text-muted hover:text-navy" title="Remove">
          <X size={13} />
        </button>
      </div>
      {extracted.filled_fields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {extracted.filled_fields.map((f) => (
            <span key={f} className="chip bg-white text-emerald border border-emerald/30">
              {friendly[f] ?? f}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted">
        Edit any field below — the deck is just a starting point.
      </div>
    </div>
  );
}

/** Apply only the fields the deck actually contained. Skip blanks. */
function applyToInputs(
  e: ExtractedProfile,
  setInput: <K extends keyof ScenarioInputs>(k: K, v: ScenarioInputs[K]) => void,
) {
  if (e.business_name)    setInput("business_name", e.business_name);
  if (e.business_type)    setInput("business_type", e.business_type);
  if (e.format)           setInput("format", e.format);
  if (e.stage)            setInput("stage", e.stage);
  if (e.description)      setInput("description", e.description);
  if (e.target_audience)  setInput("target_audience", e.target_audience);
  if (e.owner_experience) setInput("owner_experience", e.owner_experience);
  if (e.district)         setInput("district", e.district);
  if (e.niche)            setInput("niche", e.niche);
  if (e.budget_uzs)       setInput("budget_uzs", e.budget_uzs);
  if (e.monthly_rent_uzs) setInput("monthly_rent_uzs", e.monthly_rent_uzs);
  if (e.loan_uzs)         setInput("loan_uzs", e.loan_uzs);
  if (e.average_ticket_uzs) setInput("average_ticket_uzs", e.average_ticket_uzs);
  if (e.customers_per_day)  setInput("customers_per_day", e.customers_per_day);
}

function NextStep({ icon: Icon, label, enabled, onClick, blurb }: { icon: any; label: string; enabled: boolean; onClick: () => void; blurb: string }) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      className={clsx(
        "text-left p-4 rounded-xl2 border transition",
        enabled
          ? "border-line bg-white hover:border-petrol hover:bg-petrol/5 cursor-pointer"
          : "border-line bg-navy/[0.02] cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-center justify-between">
        <div className={clsx("w-8 h-8 rounded-lg grid place-items-center", enabled ? "bg-petrol/10 text-petrol" : "bg-navy/5 text-muted")}>
          <Icon size={15} />
        </div>
        {enabled && <ArrowRight size={14} className="text-petrol" />}
      </div>
      <div className="mt-2 font-display font-semibold text-navy">{label} agent</div>
      <div className="text-[11px] text-muted mt-1 leading-relaxed">{blurb}</div>
    </button>
  );
}
