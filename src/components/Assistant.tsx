import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Send, Sparkles, Bot, User, ShieldCheck, RefreshCw,
  Mic, MicOff, Loader2, AlertCircle,
} from "lucide-react";
import { api, type VoiceResult } from "../api";
import { useScenario, renderScenarioContext, type ScenarioInputs } from "../state";

type Msg = { role: "user" | "assistant"; text: string; pending?: boolean };

const SUGGESTED = [
  "Why is the recommendation 'Proceed with caution'?",
  "What are the biggest risks for this Chilonzor coffee shop?",
  "How can I improve the credit readiness score?",
  "Compare Chilonzor vs Yunusobod for this concept.",
];

// Context tags are computed live from the scenario inside the component.

const CANNED: Record<string, string> = {
  "Why is the recommendation 'Proceed with caution'?":
    "The recommendation is **Proceed with caution** because demand and location signals are strong (Demand 74, Location 79), but viability and saturation pull the composite down. Rent burden is ~22% of projected revenue (above the 18% safe threshold) and 7 competitors sit within 500m — including 3 in the premium niche. Confidence is 78%; the engine recommends a smaller initial loan and a 3-month performance review.",
  "What are the biggest risks for this Chilonzor coffee shop?":
    "Top three risks driving the score down:\n• **Rent burden** (-17 contribution) — sensitive to a 10% revenue miss\n• **Saturation** (-12) — premium competitor density elevated within 250m\n• **Seasonality** (-8) — Ramazon dampens weekday morning peaks ~18%\nMitigation: phased rollout, 3-month working capital buffer, and a covenant tied to monthly turnover.",
  "How can I improve the credit readiness score?":
    "Credit Readiness (M-F1) is 71. Three levers move it fastest:\n1. Reduce loan ticket from 140M → 120M UZS (DTI improves ~6 pts)\n2. Add partial collateral or a co-borrower (risk class shift)\n3. Provide 6 months of POS turnover data — recency lifts confidence band by ~0.08.\nAfter all three, model projects 79–82.",
  "Compare Chilonzor vs Yunusobod for this concept.":
    "Yunusobod scores higher on Location (84 vs 79) and lower on Saturation (52 vs 61) — fewer premium competitors and stronger evening foot traffic near the business district. However, rent benchmarks are 18% higher, which neutralizes the viability gain. Net: Yunusobod = **Recommend Launch** at 81% confidence; Chilonzor stays at **Proceed with caution**, 78%.",
};

function reply(q: string): string {
  if (CANNED[q]) return CANNED[q];
  return `Based on the current Chilonzor coffee shop analysis: ${q.replace(/\?$/, "")} — the recommendation engine weighs market (20%), demand (20%), location (20%), viability (20%), competition (10%), and credit (10%). Adjust inputs in the Inputs tab and I'll re-explain against the new scores.`;
}

export function Assistant() {
  const { result, setInput: setScenarioInput } = useScenario();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text:
        "Hi — I'm your **Business Case Assistant**. Type a question, or hit the mic and tell me about your business in Uzbek, Russian or English — I'll fill the form for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // --- Mic / voice intake ---
  const [recState, setRecState] = useState<"idle" | "recording" | "uploading" | "error">("idle");
  const [recError, setRecError] = useState<string>("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  async function startRecording() {
    setRecError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecState("error"); setRecError("Microphone API not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: pickMimeType() });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        await sendAudio(blob);
      };
      mr.start();
      recorderRef.current = mr;
      setRecState("recording");
      // Drop a placeholder "🎤 Recording…" bubble in the chat so the user sees
      // their input is being captured even before transcription comes back.
      setMsgs((m) => [...m, { role: "user", text: "🎤 …", pending: true }]);
    } catch (e: any) {
      setRecState("error"); setRecError(e?.message ?? "Microphone permission denied.");
    }
  }

  function stopRecording() {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") {
      setRecState("uploading");
      // Update the placeholder bubble while we wait for Gemini.
      setMsgs((m) => m.map((msg, i) => i === m.length - 1 && msg.pending
        ? { ...msg, text: "🎤 transcribing…" } : msg));
      mr.stop();
    }
    recorderRef.current = null;
  }

  async function sendAudio(blob: Blob) {
    try {
      const res = await api.voice(blob);
      const transcript = res.transcript?.trim() || "(no speech detected — try again)";
      const filled = applyVoiceToInputs(res, setScenarioInput);
      const reply = res.reply?.trim() || (filled.length
        ? `Got it — captured ${filled.length} field${filled.length === 1 ? "" : "s"}: ${filled.join(", ")}.`
        : "Got it, but I didn't catch any specific business details. Try repeating with more detail (business type, district, capital).");
      // Replace the placeholder bubble with the real transcript, then append
      // the assistant's reply — both in one functional update so React renders
      // them together.
      setMsgs((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.pending) {
          next[next.length - 1] = { role: "user", text: transcript };
        } else {
          next.push({ role: "user", text: transcript });
        }
        next.push({ role: "assistant", text: reply });
        return next;
      });
      setRecState("idle");
    } catch (e: any) {
      // Drop the placeholder + surface the error in the chat too.
      setMsgs((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.pending) next.pop();
        next.push({ role: "assistant", text: `Voice transcription failed: ${String(e?.message ?? e).slice(0, 160)}` });
        return next;
      });
      setRecState("error"); setRecError(String(e?.message ?? e).slice(0, 200));
    }
  }

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  async function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const next = [...msgs, { role: "user" as const, text: q }];
    setMsgs(next);
    setInput("");
    setThinking(true);
    try {
      const res = await api.chat({
        scenario_id: result?.scenario_id ?? "new",
        history: msgs,
        message: q,
        scenario_context: renderScenarioContext(result),
      });
      setMsgs((m) => [...m, { role: "assistant", text: res.reply }]);
    } catch (err) {
      // Backend unreachable — fall back to local canned reply so the demo
      // doesn't dead-end if the dev server is off.
      console.warn("chat api failed, using local fallback", err);
      setMsgs((m) => [...m, { role: "assistant", text: reply(q) }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-line">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display font-bold text-navy flex items-center gap-2">
              <Bot size={16} className="text-petrol" />
              Business Case Assistant
            </div>
            <div className="text-[11px] text-muted mt-0.5">Ask the AI · grounded in this analysis</div>
          </div>
          <span className="chip bg-emerald/15 text-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" /> Online
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(result
            ? [
                result.business_type,
                result.location.split(",")[0],
                `${result.credit.suggested_loan_m_uzs}M UZS loan`,
                `${result.verdict.confidence}% confidence`,
                "6 flagship models",
              ]
            : ["No analysis yet — fill the form and recompute"]
          ).map((t) => (
            <span key={t} className="chip bg-navy/5 text-navy">{t}</span>
          ))}
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Bot size={13} className="text-petrol" />
            <span className="flex gap-1">
              <Dot /> <Dot delay={150} /> <Dot delay={300} />
            </span>
            <span>thinking…</span>
          </div>
        )}

        {msgs.length === 1 && (
          <div className="pt-2">
            <div className="label mb-2">Suggested questions</div>
            <div className="space-y-1.5">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-[12px] text-navy/85 px-3 py-2 rounded-lg border border-line bg-white hover:border-petrol hover:bg-petrol/5 transition flex items-start gap-2"
                >
                  <Sparkles size={12} className="mt-0.5 text-petrol shrink-0" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={
              recState === "recording" ? "Listening… speak in Uzbek, Russian or English"
              : "Ask a question, or hit the mic to fill the form"
            }
            rows={2}
            disabled={recState === "recording" || recState === "uploading"}
            className="input flex-1 resize-none text-[13px] leading-snug disabled:bg-navy/[0.02]"
          />
          <button
            onClick={recState === "recording" ? stopRecording : startRecording}
            disabled={recState === "uploading"}
            title={recState === "recording" ? "Stop recording" : "Speak — I'll fill the form"}
            className={clsx(
              "w-9 h-9 rounded-lg grid place-items-center transition shrink-0",
              recState === "recording" ? "bg-rose-500 text-white animate-pulse"
              : recState === "uploading" ? "bg-navy/10 text-muted cursor-wait"
              : "bg-white text-navy border border-line hover:bg-navy/5",
            )}
          >
            {recState === "uploading"
              ? <Loader2 size={15} className="animate-spin" />
              : recState === "recording"
                ? <MicOff size={15} />
                : <Mic size={15} />}
          </button>
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || recState === "recording" || recState === "uploading"}
            className="w-9 h-9 rounded-lg bg-petrol text-white grid place-items-center disabled:opacity-40 hover:bg-navy-700 transition shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
        {recState === "error" && (
          <div className="mt-2 text-[11px] text-rose-600 flex items-start gap-1.5">
            <AlertCircle size={11} className="mt-0.5 shrink-0" /> {recError}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-1.5"><ShieldCheck size={10} /> Grounded · uz / ru / en voice supported</span>
          <button
            onClick={() => setMsgs(msgs.slice(0, 1))}
            className="flex items-center gap-1 hover:text-navy"
          >
            <RefreshCw size={10} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="w-1 h-1 rounded-full bg-petrol animate-bounce"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function renderText(text: string) {
  // tiny **bold** + bullet support
  const lines = text.split("\n");
  return lines.map((ln, i) => {
    const parts = ln.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={j} className="text-navy">{p.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{p}</span>
      )
    );
    return (
      <p key={i} className={clsx(i > 0 && "mt-1")}>
        {parts}
      </p>
    );
  });
}

/**
 * Pick the best supported audio mime type for MediaRecorder.
 * Chrome/Edge default to webm/opus; Safari needs audio/mp4.
 */
function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const c of candidates) if (MediaRecorder.isTypeSupported(c)) return c;
  return "audio/webm";
}

/** Apply the voice-extracted fields into the scenario. Returns the friendly
 *  list of field names that were set, for the assistant's confirmation. */
function applyVoiceToInputs(
  v: VoiceResult,
  setInput: <K extends keyof ScenarioInputs>(k: K, v: ScenarioInputs[K]) => void,
): string[] {
  const friendly: Record<string, string> = {
    business_name: "name", business_type: "type", format: "format", stage: "stage",
    description: "description", target_audience: "audience", owner_experience: "experience",
    district: "district", niche: "niche",
    budget_uzs: "capital", monthly_rent_uzs: "rent", loan_uzs: "loan",
    average_ticket_uzs: "ticket", customers_per_day: "customers/day",
  };
  const filled: string[] = [];
  const set = <K extends keyof ScenarioInputs>(k: K, val: ScenarioInputs[K], label = String(k)) => {
    setInput(k, val);
    filled.push(friendly[label] ?? label);
  };
  if (v.business_name)    set("business_name", v.business_name, "business_name");
  if (v.business_type)    set("business_type", v.business_type, "business_type");
  if (v.format)           set("format", v.format, "format");
  if (v.stage)            set("stage", v.stage, "stage");
  if (v.description)      set("description", v.description, "description");
  if (v.target_audience)  set("target_audience", v.target_audience, "target_audience");
  if (v.owner_experience) set("owner_experience", v.owner_experience, "owner_experience");
  if (v.district)         set("district", v.district, "district");
  if (v.niche)            set("niche", v.niche, "niche");
  if (v.budget_uzs)       set("budget_uzs", v.budget_uzs, "budget_uzs");
  if (v.monthly_rent_uzs) set("monthly_rent_uzs", v.monthly_rent_uzs, "monthly_rent_uzs");
  if (v.loan_uzs)         set("loan_uzs", v.loan_uzs, "loan_uzs");
  if (v.average_ticket_uzs) set("average_ticket_uzs", v.average_ticket_uzs, "average_ticket_uzs");
  if (v.customers_per_day)  set("customers_per_day", v.customers_per_day, "customers_per_day");
  return filled;
}

function Bubble({ m }: { m: Msg }) {
  const isUser = m.role === "user";
  return (
    <div className={clsx("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={clsx(
          "w-6 h-6 rounded-full grid place-items-center shrink-0 mt-0.5",
          isUser ? "bg-navy text-white" : "bg-petrol/10 text-petrol",
          m.pending && "animate-pulse",
        )}
      >
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>
      <div
        className={clsx(
          "max-w-[80%] text-[13px] leading-relaxed px-3 py-2 rounded-xl2",
          isUser
            ? "bg-navy text-white rounded-tr-sm"
            : "bg-white border border-line text-navy/90 rounded-tl-sm",
          m.pending && "italic opacity-80",
        )}
      >
        {renderText(m.text)}
      </div>
    </div>
  );
}
