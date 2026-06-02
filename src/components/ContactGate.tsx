// The contact gate — shown once, right before a founder sees their results.
// This is what replaces login on the client side: instead of an account, we
// ask for a name + phone so (a) the analysis can be tied to a person and
// (b) a banker can call the owner about the deal. Lowest-friction spot is
// the very end, after the work is done and the payoff is one tap away.

import { useState } from "react";
import { Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { useScenario, isContactComplete } from "../state";
import { useT } from "../i18n";

export function ContactGate({ onContinue }: { onContinue: () => void }) {
  const { inputs, setInput } = useScenario();
  const t = useT();
  const [name, setName] = useState(inputs.contact_name);
  const [phone, setPhone] = useState(inputs.contact_phone);
  const [touched, setTouched] = useState(false);

  const valid = isContactComplete({ ...inputs, contact_name: name, contact_phone: phone });

  function submit() {
    setTouched(true);
    if (!valid) return;
    setInput("contact_name", name.trim());
    setInput("contact_phone", phone.trim());
    onContinue();
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="card p-7">
        <div className="w-12 h-12 rounded-xl2 bg-petrol/10 text-petrol grid place-items-center mb-4">
          <Phone size={22} />
        </div>
        <h1 className="font-display text-2xl text-navy font-bold">
          {t("Almost there — how do we reach you?")}
        </h1>
        <p className="text-sm text-muted mt-1.5">
          {t("Your analysis is ready. Leave a name and number so a banker can call you about it — no account needed.")}
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="label">{t("Your name")}</span>
            <input
              autoFocus
              className="input mt-1"
              placeholder={t("e.g. Sardor Aliyev")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <label className="block">
            <span className="label">{t("Phone number")}</span>
            <input
              className="input mt-1"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>

          {touched && !valid && (
            <div className="text-[12px] text-rose-500">
              {t("Enter your name and a valid phone number to continue.")}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!valid}
            className="w-full px-4 py-3 rounded-lg bg-petrol text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-navy-700 transition shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("Show my analysis")} <ArrowRight size={15} />
          </button>

          <div className="flex items-start gap-2 text-[11px] text-muted">
            <ShieldCheck size={13} className="text-emerald mt-0.5 shrink-0" />
            <span>{t("We only share your contact with the bank reviewing this deal.")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
