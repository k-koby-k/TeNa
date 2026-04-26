// Wizard navigation shared across all agent screens.
//
//   - <WizardSteps>  : top progress indicator (4 steps + Overview)
//   - <WizardFooter> : sticky bottom Back / Next buttons
//
// The flow is fixed: Profile → Location → Market → Financials → Overview.
// "Next" is enabled when the current step is "done" (passed as a prop):
//   - Profile is done when the required identity fields are filled.
//   - Location/Market/Financials are done when their agent has produced data
//     (we read this from the scenario's completion flags).

import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Lock, ClipboardList, MapPin, BarChart3, Wallet, LayoutDashboard } from "lucide-react";
import type { ViewKey } from "./Sidebar";
import { useScenario } from "../state";

export const WIZARD_STEPS: { key: ViewKey; label: string; icon: any }[] = [
  { key: "Profile",    label: "Profile",    icon: ClipboardList },
  { key: "Location",   label: "Location",   icon: MapPin },
  { key: "Market",     label: "Market",     icon: BarChart3 },
  { key: "Financials", label: "Financials", icon: Wallet },
  { key: "Overview",   label: "Overview",   icon: LayoutDashboard },
];

function useStepStatus() {
  const { completion } = useScenario();
  return WIZARD_STEPS.map((s) => {
    const done = s.key === "Profile"    ? completion.profile
              : s.key === "Location"   ? completion.location
              : s.key === "Market"     ? completion.market
              : s.key === "Financials" ? completion.financials
              : /* Overview */          completion.anyMetric;
    const locked = s.key === "Profile" ? false
                : s.key === "Overview" ? !completion.anyMetric
                :                        !completion.profile;
    return { ...s, done, locked };
  });
}

/** Top stepper. Shows all 5 steps; the active one is highlighted, completed
 *  have a check, locked have a lock. Click to jump. */
export function WizardSteps({ active, onChange }: { active: ViewKey; onChange: (v: ViewKey) => void }) {
  const steps = useStepStatus();
  return (
    <div data-noprint className="card p-3">
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => {
          const isActive = s.key === active;
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex-1 flex items-center">
              <button
                onClick={() => !s.locked && onChange(s.key)}
                disabled={s.locked}
                className={clsx(
                  "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition text-left",
                  isActive
                    ? "bg-petrol/10 ring-1 ring-petrol/30"
                    : s.done
                      ? "bg-emerald/5 hover:bg-emerald/10"
                      : "hover:bg-navy/5",
                  s.locked && "opacity-40 cursor-not-allowed",
                )}
              >
                <span
                  className={clsx(
                    "w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold shrink-0",
                    isActive
                      ? "bg-petrol text-white"
                      : s.done
                        ? "bg-emerald text-white"
                        : s.locked
                          ? "bg-navy/5 text-muted"
                          : "bg-navy/5 text-navy",
                  )}
                >
                  {s.locked ? <Lock size={11} /> : s.done ? <Check size={13} /> : i + 1}
                </span>
                <span className="flex flex-col leading-tight min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                    {s.locked ? "Locked" : s.done ? "Done" : isActive ? "Current" : "Pending"}
                  </span>
                  <span className={clsx(
                    "text-[13px] font-semibold truncate flex items-center gap-1",
                    isActive ? "text-petrol" : s.done ? "text-emerald" : "text-navy",
                  )}>
                    <Icon size={12} /> {s.label}
                  </span>
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className={clsx(
                  "mx-1 h-0.5 w-4 rounded",
                  s.done ? "bg-emerald" : "bg-navy/10",
                )} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Sticky bottom-of-page Back / Next bar. `currentDone` is the parent
 *  screen's notion of "is the current step ready to advance" — typically the
 *  matching completion flag, or for Profile the required-fields check. */
export function WizardFooter({
  active, onChange, currentDone, doneHint, nextHint,
}: {
  active: ViewKey;
  onChange: (v: ViewKey) => void;
  currentDone: boolean;
  /** Inline message under the next button when the step isn't done yet. */
  doneHint?: string;
  /** Inline message when it IS done — usually a one-liner about what's next. */
  nextHint?: string;
}) {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === active);
  if (idx < 0) return null;
  const prev = WIZARD_STEPS[idx - 1];
  const next = WIZARD_STEPS[idx + 1];

  return (
    <div data-noprint className="sticky bottom-0 z-30 -mx-6 px-6 py-3 mt-2 bg-ivory/85 backdrop-blur border-t border-line">
      <div className="max-w-[1100px] mx-auto flex items-center gap-3">
        {prev ? (
          <button
            onClick={() => onChange(prev.key)}
            className="px-3 py-2 text-sm font-medium border border-line rounded-lg hover:bg-navy/5 flex items-center gap-1.5 text-navy"
          >
            <ArrowLeft size={14} /> Back to {prev.label}
          </button>
        ) : <span />}

        <div className="flex-1 text-center text-[12px] text-muted">
          {currentDone ? nextHint : doneHint}
        </div>

        {next ? (
          <button
            onClick={() => onChange(next.key)}
            disabled={!currentDone}
            className={clsx(
              "px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-1.5 transition",
              currentDone
                ? "bg-petrol text-white hover:bg-navy-700 shadow-soft"
                : "bg-navy/10 text-muted cursor-not-allowed",
            )}
          >
            Continue to {next.label} <ArrowRight size={14} />
          </button>
        ) : <span />}
      </div>
    </div>
  );
}
