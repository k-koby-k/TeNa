import { useState } from "react";
import { Sidebar, type ViewKey } from "./components/Sidebar";
import { CenterWorkspace } from "./components/CenterWorkspace";
import { Assistant } from "./components/Assistant";
import { ScenarioProvider } from "./state";

export default function App() {
  const [view, setView] = useState<ViewKey>("Profile");

  return (
    <ScenarioProvider>
      <div className="h-full flex bg-ivory">
        <Sidebar active={view} onChange={setView} />
        <CenterWorkspace view={view} onChange={setView} />
        <aside className="w-[380px] shrink-0 border-l border-line bg-white/60 backdrop-blur flex flex-col">
          <Assistant />
        </aside>
      </div>
    </ScenarioProvider>
  );
}
