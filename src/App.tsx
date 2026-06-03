import { useState } from "react";
import { Sidebar, type ViewKey, type Mode } from "./components/Sidebar";
import { CenterWorkspace } from "./components/CenterWorkspace";
import { Assistant } from "./components/Assistant";
import { ScenarioProvider } from "./state";
import { LanguageProvider } from "./i18n";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

// Which product is this?
//   • ?role=banker / ?role=founder in the URL wins (and is remembered)
//   • otherwise the last choice saved in localStorage
//   • otherwise a `platform.` host → banker
//   • otherwise founder (business owner, no login)
// This makes banker mode reachable on the deployed site (e.g. tena…/?role=banker)
// where there's no `platform.` subdomain.
const MODE_KEY = "tena.mode";
function detectMode(): Mode {
  if (typeof window === "undefined") return "founder";
  const q = new URLSearchParams(window.location.search).get("role");
  if (q === "banker" || q === "founder") {
    try { localStorage.setItem(MODE_KEY, q); } catch { /* ignore */ }
    return q;
  }
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === "banker" || saved === "founder") return saved;
  return window.location.hostname.startsWith("platform.") ? "banker" : "founder";
}

export default function App() {
  const [mode, setMode] = useState<Mode>(detectMode);
  const [view, setView] = useState<ViewKey>(mode === "banker" ? "Queue" : "Profile");
  const [assistantOpen, setAssistantOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1440
  );
  // Allow the in-app founder/banker switch everywhere (the audience is a known
  // group), and remember the choice so a reload keeps the role.
  const allowModeSwitch = true;
  const handleModeChange = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  };

  return (
    <LanguageProvider>
      <ScenarioProvider>
        <div className="h-full flex bg-ivory">
          <Sidebar active={view} onChange={setView} mode={mode} onModeChange={handleModeChange} allowModeSwitch={allowModeSwitch} />
          <CenterWorkspace view={view} onChange={setView} mode={mode} />
          <button
            onClick={() => setAssistantOpen((v) => !v)}
            title={assistantOpen ? "Hide assistant" : "Show assistant"}
            className="fixed right-4 top-4 z-[60] w-9 h-9 rounded-lg bg-white border border-line shadow-soft text-navy grid place-items-center hover:bg-navy/5"
          >
            {assistantOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <aside className={[
            "shrink-0 border-l border-line bg-white/60 backdrop-blur flex flex-col transition-[width] duration-200 overflow-hidden",
            assistantOpen ? "w-[380px]" : "w-0 border-l-0",
          ].join(" ")}>
            <Assistant />
          </aside>
        </div>
      </ScenarioProvider>
    </LanguageProvider>
  );
}
