import { useState } from "react";
import { Sidebar, type ViewKey, type Mode } from "./components/Sidebar";
import { CenterWorkspace } from "./components/CenterWorkspace";
import { Assistant } from "./components/Assistant";
import { ScenarioProvider } from "./state";

export default function App() {
  const [view, setView] = useState<ViewKey>("Profile");
  const [mode, setMode] = useState<Mode>("founder");

  return (
    <ScenarioProvider>
      <div className="h-full flex bg-ivory">
        <Sidebar active={view} onChange={setView} mode={mode} onModeChange={setMode} />
        <CenterWorkspace view={view} onChange={setView} mode={mode} />
        <aside className="w-[380px] shrink-0 border-l border-line bg-white/60 backdrop-blur flex flex-col">
          <Assistant />
        </aside>
      </div>
    </ScenarioProvider>
  );
}
