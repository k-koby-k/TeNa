import { useState } from "react";
import { Sidebar, type ViewKey, type Mode } from "./components/Sidebar";
import { CenterWorkspace } from "./components/CenterWorkspace";
import { Assistant } from "./components/Assistant";
import { ScenarioProvider } from "./state";
import { LanguageProvider } from "./i18n";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

export default function App() {
  const [view, setView] = useState<ViewKey>("Profile");
  const [mode, setMode] = useState<Mode>("founder");
  const [assistantOpen, setAssistantOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1440
  );

  return (
    <LanguageProvider>
      <ScenarioProvider>
        <div className="h-full flex bg-ivory">
          <Sidebar active={view} onChange={setView} mode={mode} onModeChange={setMode} />
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
