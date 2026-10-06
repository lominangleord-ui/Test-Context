import { useState } from "react";
import { useGame } from "../store/game";
import { SystemWindow } from "./SystemWindow";
import { RunicText } from "./common";
import type { PactStake } from "../types";

const STAKES: {
  id: PactStake;
  icon: string;
  name: string;
  tag: string;
  desc: string;
  color: string;
}[] = [
  {
    id: "witness",
    icon: "👁",
    name: "Witness Pact",
    tag: "SOCIAL",
    color: "#1e9bff",
    desc: "Keep a commitment with a real person. Failures are recorded on this device; show the ledger to your witness yourself. No automatic sharing.",
  },
  {
    id: "forfeit",
    icon: "⚖",
    name: "Forfeit Pact",
    tag: "REAL-WORLD",
    color: "#ffc53d",
    desc: "Choose a safe, voluntary real-world commitment. The System logs the terms and breaches locally. Following through is between you and your witness; nothing is charged or sent.",
  },
  {
    id: "ironvow",
    icon: "🩸",
    name: "Iron Vow",
    tag: "PERMADEATH",
    color: "#c81432",
    desc: "Commit to a fresh start after death: level, Monarch path, skills and items reset. Only your local pact ledger remains. You control your own backups.",
  },
];

export function BloodPactWindow() {
  const pact = useGame((s) => s.pact);
  const swear = useGame((s) => s.swearPact);
  const dissolve = useGame((s) => s.dissolvePact);

  const [stake, setStake] = useState<PactStake>("witness");
  const [witness, setWitness] = useState("");
  const [terms, setTerms] = useState("");
  const [confirming, setConfirming] = useState(false);

  /* ── Active pact view ── */
  if (pact.active) {
    const active = STAKES.find((s) => s.id === pact.stake)!;
    return (
      <div className="pact-seal p-4 slide-up">
        <div className="flex items-start gap-3">
          <div className="pact-glyph text-[42px] leading-none shrink-0">契</div>
          <div className="flex-1 min-w-0">
            <div className="font-wide text-[11px] tracking-[0.22em] text-[color:#ff7a8c]">
              BLOOD PACT · ACTIVE
            </div>
            <div className="font-head text-[19px] font-800 italic tracking-[0.06em] text-[color:var(--text-bright)] mt-0.5">
              {active.icon} {active.name}
            </div>
            <div className="mt-2 space-y-1.5 text-[11.5px]">
              <div>
                <span className="font-sys text-[9px] tracking-[0.2em] text-[color:var(--text-dim)]">
                  WITNESS
                </span>
                <div className="text-[color:var(--text-bright)] font-600">{pact.witness}</div>
              </div>
              {pact.terms && (
                <div>
                  <span className="font-sys text-[9px] tracking-[0.2em] text-[color:var(--text-dim)]">
                    TERMS
                  </span>
                  <div className="text-[color:var(--text-mid)] italic leading-snug">
                    “{pact.terms}”
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="text-center border border-[#ffffff12] bg-[#0a0206aa] py-2">
            <div className="font-mono text-[18px] text-[color:#ff7a8c]">{pact.breaches}</div>
            <div className="font-sys text-[8px] tracking-[0.2em] text-[color:var(--text-dim)] mt-0.5">
              BREACHES
            </div>
          </div>
          <div className="text-center border border-[#ffffff12] bg-[#0a0206aa] py-2">
            <div className="font-mono text-[18px] text-[color:var(--text-bright)]">
              {Math.max(0, Math.floor((Date.now() - pact.sworn) / 86400000))}
            </div>
            <div className="font-sys text-[8px] tracking-[0.2em] text-[color:var(--text-dim)] mt-0.5">
              DAYS BOUND
            </div>
          </div>
        </div>

        <p className="font-sys text-[10px] text-[color:var(--text)] mt-3 leading-relaxed">
          Local record only. Share with your witness yourself; the app sends nothing and enforces no real-world consequence.
        </p>

        <button
          className="sl-btn w-full py-2 mt-2.5 text-[10px]"
          onClick={() => {
            if (confirm("Dissolve the pact? The stake disappears. No penalty is applied.")) {
              dissolve();
            }
          }}
        >
          DISSOLVE PACT
        </button>
      </div>
    );
  }

  /* ── Swear a new pact ── */
  const selected = STAKES.find((s) => s.id === stake)!;
  const canSwear = witness.trim().length > 1 && (stake !== "forfeit" || terms.trim().length > 3);

  return (
    <SystemWindow title="BLOOD PACT" accent="#c81432">
      <p className="text-[11.5px] text-[color:var(--text-mid)] leading-relaxed mb-3">
        In-game penalties only sting inside the game. A Pact puts something{" "}
        <b className="text-[color:#ff7a8c]">outside</b> it on the line.
      </p>

      <div className="space-y-1.5">
        {STAKES.map((s) => {
          const on = stake === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setStake(s.id)}
              className="w-full text-left p-2.5 border transition-all flex items-start gap-2.5"
              style={{
                borderColor: on ? s.color : "#ffffff12",
                background: on ? `${s.color}12` : "#04101d66",
                boxShadow: on ? `0 0 18px ${s.color}22` : "none",
              }}
            >
              <span className="text-xl leading-none mt-0.5 shrink-0">{s.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-head text-[14px] font-800 italic tracking-[0.04em] text-[color:var(--text-bright)]">
                    {s.name}
                  </span>
                  <span
                    className="font-sys text-[7.5px] tracking-[0.2em] px-1.5 py-0.5 border"
                    style={{ color: s.color, borderColor: `${s.color}55` }}
                  >
                    {s.tag}
                  </span>
                </div>
                <div className="text-[10.5px] text-[color:var(--text)] leading-snug mt-1">
                  {s.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="font-sys text-[9px] tracking-[0.26em] text-[color:var(--text-dim)] uppercase mb-1.5">
            Your Witness — a real person
          </div>
          <input
            value={witness}
            onChange={(e) => setWitness(e.target.value)}
            maxLength={40}
            placeholder="Name or @handle…"
            className="sl-input"
          />
        </div>

        {stake === "forfeit" && (
          <div>
            <div className="font-sys text-[9px] tracking-[0.26em] text-[color:var(--text-dim)] uppercase mb-1.5">
              Declared Terms
            </div>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              maxLength={160}
              rows={2}
              placeholder="e.g. I buy Sam lunch · I donate £20 · I do their chores for a week"
              className="sl-input resize-none"
            />
            <div className="font-sys text-[9px] text-[color:var(--text-faint)] mt-1 tracking-[0.08em]">
              Honour-system. Keep it safe and voluntary. No automatic payments or reports.
            </div>
          </div>
        )}
      </div>

      {!confirming ? (
        <button
          className="sl-btn sl-btn-blood w-full py-3 mt-3 tracking-[0.3em]"
          disabled={!canSwear}
          onClick={() => setConfirming(true)}
        >
          🩸 SWEAR THE PACT
        </button>
      ) : (
        <div className="mt-3 p-3 border border-[color:var(--blood)] bg-[#c8143210] space-y-2.5">
          <div className="font-head text-[13px] font-800 italic text-[color:#ff7a8c] tracking-[0.06em]">
            <RunicText text="THE SYSTEM IS LISTENING" duration={600} />
          </div>
          <p className="text-[11px] text-[color:var(--text-mid)] leading-relaxed">
            {stake === "ironvow" ? (
              <>
                You are swearing that <b>death is final</b>. If you fall, this hunter and
                everything earned starts over. Your own exported backups remain under your control.
              </>
            ) : (
              <>
                You agree to share breaches with <b className="text-[color:var(--text-bright)]">{witness || "your witness"}</b> yourself.
                The System keeps a local record but never contacts anyone.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              className="sl-btn sl-btn-blood flex-1 py-2.5"
              onClick={() => {
                swear(stake, witness, terms || selected.name);
                setConfirming(false);
                setWitness("");
                setTerms("");
              }}
            >
              I SWEAR IT
            </button>
            <button className="sl-btn flex-1 py-2.5" onClick={() => setConfirming(false)}>
              NOT YET
            </button>
          </div>
        </div>
      )}
    </SystemWindow>
  );
}

/* ── Ledger of every breach, permanent ── */
export function PactLedger() {
  const ledger = useGame((s) => s.pactLedger);
  if (ledger.length === 0) return null;

  return (
    <SystemWindow title="PACT LEDGER" accent="#c81432">
      <p className="font-sys text-[9.5px] tracking-[0.14em] text-[color:var(--text-dim)] mb-2">
        PERMANENT RECORD — SURVIVES DEATH AND RESET
      </p>
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
        {ledger.map((e, i) => (
          <div key={i} className="p-2.5 border border-[color:#c8143240] bg-[#c8143208]">
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-sys text-[11px] font-600 tracking-[0.06em] text-[color:#ff7a8c]">
                {e.event}
              </span>
              <span className="font-mono text-[9.5px] text-[color:var(--text-faint)] shrink-0">
                {e.date}
              </span>
            </div>
            <div className="text-[10px] text-[color:var(--text)] mt-1 italic">“{e.terms}”</div>
            <div className="font-sys text-[8.5px] tracking-[0.16em] text-[color:var(--text-dim)] mt-1">
              WITNESS: {e.witness} ·{" "}
              <span className="text-[color:var(--text)]">LOCAL RECORD ONLY</span>
            </div>
          </div>
        ))}
      </div>
    </SystemWindow>
  );
}
