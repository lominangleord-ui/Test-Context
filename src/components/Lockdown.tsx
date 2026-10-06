import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store/game";
import { useUi } from "../store/ui";
import { SystemWindow } from "./SystemWindow";
import { Bar } from "./common";
import { fmtCountdown } from "../lib/utils";
import { computePenaltyTargets, computeTargets } from "../data";

/** Hoisted so React keeps the input mounted (otherwise typing loses focus). */
function PenaltyLeg({
  label,
  done,
  val,
  setVal,
  cam,
  unit,
  goal,
  onCam,
}: {
  label: string;
  done: number | boolean;
  val: string;
  setVal: (v: string) => void;
  cam?: "push" | "sit";
  unit: string;
  goal: number;
  onCam?: (k: "push" | "sit") => void;
}) {
  return (
    <div>
      <div className="font-sys text-[10.5px] tracking-[0.18em] text-[color:var(--text-mid)] mb-1.5">
        {label}
        <span className="text-[color:var(--text-dim)]"> — </span>
        <span className="font-mono text-[color:#ff8b9c]">
          {typeof done === "boolean" ? (done ? "COMPLETE" : `0 / ${goal}`) : `${done} / ${goal}`}
        </span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={unit}
          className="sl-input flex-1 w-0 py-1.5"
        />
        {cam && onCam && (
          <button
            className="sl-btn sl-btn-danger px-3 py-1.5 text-[10px]"
            onClick={() => onCam(cam)}
          >
            CAM
          </button>
        )}
      </div>
    </div>
  );
}

export function Lockdown() {
  const s = useGame(useShallow((state) => ({
    penaltyEnd: state.penaltyEnd, hp: state.hp, hpMax: state.hpMax,
    penPushDone: state.penPushDone, penSitDone: state.penSitDone,
    penRunDone: state.penRunDone, relapseTokens: state.relapseTokens,
    penaltyTargets: state.penaltyTargets, archetype: state.archetype,
    dayMode: state.dayMode, level: state.dailyTargetLevel ?? state.level,
  })));
  const targets = s.penaltyTargets ?? computePenaltyTargets(computeTargets(s.archetype, s.dayMode, s.level));
  const consumeToken = useGame((st) => st.consumeToken);
  const submitPenalty = useGame((st) => st.submitPenalty);
  const openCamera = useUi((st) => st.openCamera);
  const [push, setPush] = useState("");
  const [sit, setSit] = useState("");
  const [run, setRun] = useState("");
  const [ms, setMs] = useState(s.penaltyEnd - Date.now());

  useEffect(() => {
    const id = setInterval(() => setMs(useGame.getState().penaltyEnd - Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "The System does not allow escape during Lockdown.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] p-4 pb-16 relative z-[2]">
      <div className="max-w-[560px] mx-auto space-y-4">
        <div className="lockdown-banner p-3.5 text-center text-[13px]">
          🔒 LOCKDOWN — COMPLETE PENALTY TO ESCAPE
        </div>

        <div className="text-center">
          <div className="font-sys text-[9px] tracking-[0.3em] text-[color:var(--text-dim)]">
            NEXT HP LOSS IN
          </div>
          <div className="font-head text-[36px] font-black tracking-[0.1em] text-[color:var(--red)]"
               style={{ textShadow: "0 0 24px var(--red)" }}>
            {fmtCountdown(Math.max(0, ms))}
          </div>
        </div>

        {s.relapseTokens > 0 && (
          <button className="sl-btn sl-btn-gold w-full py-3 tracking-[0.2em]" onClick={consumeToken}>
            🎴 CONSUME RELAPSE TOKEN ({s.relapseTokens}) — INSTANT ESCAPE
          </button>
        )}

        <SystemWindow title="PUNISHMENT QUEST" accent="#ff3b52">
          <p className="text-[11.5px] text-center text-[color:var(--text)] mb-3 leading-snug">
            Twice the missed day's targets, scaled to your rank. Split them into sets and rest as needed. HP is restored on completion.
          </p>

          <div className="mb-3">
            <Bar value={s.hp} max={s.hpMax} color="var(--red)" label="HP" />
          </div>

          <div className="space-y-3">
            <PenaltyLeg label="PUSH-UPS" done={s.penPushDone} val={push} setVal={setPush} cam="push" unit="total reps so far" goal={targets.push} onCam={(k) => openCamera(k, true)} />
            <PenaltyLeg label="SIT-UPS" done={s.penSitDone} val={sit} setVal={setSit} cam="sit" unit="total reps so far" goal={targets.sit} onCam={(k) => openCamera(k, true)} />
            <PenaltyLeg label="RUN" done={s.penRunDone} val={run} setVal={setRun} unit="total km so far" goal={targets.run} />
          </div>

          <button
            className="sl-btn sl-btn-danger w-full py-3 mt-4 tracking-[0.25em]"
            onClick={() =>
              submitPenalty(parseInt(push) || 0, parseInt(sit) || 0, parseFloat(run) || 0)
            }
          >
            SUBMIT PENALTY
          </button>
        </SystemWindow>
      </div>
    </div>
  );
}
