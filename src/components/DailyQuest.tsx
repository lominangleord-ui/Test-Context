import { useEffect, useState } from "react";
import { useGame } from "../store/game";
import { useUi } from "../store/ui";
import { EXERCISES, computeTargets } from "../data";
import { SystemWindow } from "./SystemWindow";
import { fmtCountdown, getMsUntilMidnight } from "../lib/utils";
import type { ExerciseKey } from "../types";

function MidnightTimer() {
  const [ms, setMs] = useState(getMsUntilMidnight());
  useEffect(() => {
    const id = setInterval(() => setMs(getMsUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  const urgent = ms < 3600_000;
  return (
    <span
      className="font-mono text-[11px] tracking-wider"
      style={{ color: urgent ? "var(--red)" : "var(--text-dim)" }}
    >
      {fmtCountdown(ms)}
    </span>
  );
}

function QuestRow({ ex }: { ex: (typeof EXERCISES)[number] }) {
  const key = ex.key as ExerciseKey;
  const value = useGame((s) => s[key] as number);
  const done = useGame((s) => s[`${key}Done` as const] as boolean);
  const archetype = useGame((s) => s.archetype);
  const dayMode = useGame((s) => s.dayMode);
  const level = useGame((s) => s.dailyTargetLevel ?? s.level);
  const dailyCompleted = useGame((s) => s.dailyCompleted);
  const log = useGame((s) => s.logExercise);
  const toggle = useGame((s) => s.toggleCheck);
  const openCamera = useUi((s) => s.openCamera);
  const [amt, setAmt] = useState("");

  const targets = computeTargets(archetype, dayMode, level);
  const target = targets[key];
  const pct = Math.min(100, (value / target) * 100);
  const isRun = key === "run";

  const submit = () => {
    const n = parseFloat(amt);
    if (!isNaN(n) && n > 0) log(key, n);
    setAmt("");
  };

  return (
    <div className={`quest-item p-2.5 ${done ? "done" : ""}`}>
      <div className="flex items-center gap-2.5">
        <button
          className={`quest-check ${done ? "done" : ""} ${dailyCompleted ? "locked" : ""}`}
          onClick={() => toggle(key)}
          role="checkbox"
          aria-checked={done}
          aria-label={`Mark ${ex.name} complete`}
          disabled={dailyCompleted}
        >
          {done ? "✓" : ""}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="font-sys text-[13px] font-600 tracking-[0.1em] text-[color:var(--text-bright)] truncate">
              {ex.name}
            </span>
            <span
              className="font-sys text-[8px] tracking-[0.24em] px-1.5 py-0.5 border shrink-0"
              style={{
                color: done ? "var(--green)" : "var(--cyan-bright)",
                borderColor: done ? "var(--green-dim)" : "#ffffff16",
                background: done ? "#2fe08a10" : "transparent",
              }}
            >
              {ex.label}
            </span>
          </div>

          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${pct}%`,
                background: done
                  ? "linear-gradient(90deg,#2fe08a66,#2fe08a)"
                  : "linear-gradient(90deg,#1e9bff55,#1e9bff)",
                color: done ? "var(--green)" : "var(--cyan)",
                boxShadow: done
                  ? "0 0 12px #2fe08a88, inset 0 0 10px #2fe08a55"
                  : "0 0 12px #1e9bff88, inset 0 0 10px #1e9bff55",
              }}
            />
          </div>

          <div className="flex justify-between font-mono text-[10.5px] mt-1">
            <span className="text-[color:var(--text)]">
              {isRun ? `${value}` : value}
              <span className="text-[color:var(--text-faint)]"> / </span>
              {target} {ex.unit}
            </span>
            <span style={{ color: done ? "var(--green)" : "var(--text-dim)" }}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      </div>

      {!done && !dailyCompleted && (
        <div className="flex gap-1.5 mt-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step={isRun ? "0.5" : "1"}
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={ex.unit}
            className="sl-input flex-1 w-0 py-1.5 text-[12px]"
          />
          <button className="sl-btn px-3 py-1.5 text-[10px]" onClick={submit}>
            LOG
          </button>
          {ex.hasCam && (
            <button
              className="sl-btn px-2.5 py-1.5 text-[10px]"
              onClick={() => openCamera(key as Exclude<ExerciseKey, "run">)}
              title="AI pose verification"
            >
              CAM
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DailyQuest() {
  const dailyCompleted = useGame((s) => s.dailyCompleted);
  const dayMode = useGame((s) => s.dayMode);

  return (
    <SystemWindow title="DAILY QUEST">
      <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed mb-3">
        A daily total, not a single set. Start small, rest between sets, and build toward A-Rank. Stop if you feel pain.
      </p>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {dayMode === "overdrive" && (
            <span className="font-sys text-[8.5px] tracking-[0.2em] px-2 py-0.5 border border-[color:var(--gold)] text-[color:var(--gold)] animate-pulse">
              ⚡ OVERDRIVE
            </span>
          )}
          {dayMode === "recovery" && (
            <span className="font-sys text-[8.5px] tracking-[0.2em] px-2 py-0.5 border border-[color:var(--green)] text-[color:var(--green)]">
              🩹 RECOVERY
            </span>
          )}
          {dayMode === "classic" && (
            <span className="font-sys text-[8.5px] tracking-[0.2em] text-[color:var(--text-dim)]">
              GOAL — TRAIN TO BECOME STRONG
            </span>
          )}
        </div>
        <MidnightTimer />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {EXERCISES.map((ex) => (
          <QuestRow key={ex.key} ex={ex} />
        ))}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-[#ffffff0f] text-center font-sys text-[10px] tracking-[0.14em]"
           style={{ color: dailyCompleted ? "var(--green)" : "var(--red)" }}>
        {dailyCompleted
          ? "✓ ALL OBJECTIVES CLEARED"
          : "WARNING: FAILURE TO COMPLETE INCURS THE PENALTY"}
      </div>
    </SystemWindow>
  );
}
