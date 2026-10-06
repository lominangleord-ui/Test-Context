import { useEffect, useState } from "react";
import { MONARCH_PATHS, pathForClass } from "../data/monarchPaths";
import { getClass } from "../data/classes";
import { useGame } from "../store/game";
import { audio } from "../lib/audio";
import { RunicText } from "./common";
import { SystemWindow } from "./SystemWindow";

export function JobChange() {
  const hunter = useGame((state) => state.name);
  const gameClass = useGame((state) => state.gameClass);
  const choose = useGame((state) => state.chooseMonarchPath);
  const fastMode = useGame((state) => state.settings.fastMode);
  const [phase, setPhase] = useState<"boot" | "reveal" | "confirm">("boot");
  const [lines, setLines] = useState<string[]>([]);
  const [showRings, setShowRings] = useState(true);

  const cls = getClass(gameClass);
  const destiny = pathForClass(gameClass);

  useEffect(() => {
    if (!destiny) return;
    const script = [
      "LEVEL THRESHOLD: 40 REACHED",
      `HUNTER RECOGNIZED: ${hunter.toUpperCase()}`,
      "ASSOCIATION CLASSIFICATION: B-RANK",
      "SYSTEM EVALUATION COMPLETE",
      `YOUR PATH: ${destiny.jobClass.toUpperCase()}`,
    ];
    if (fastMode) {
      setLines(script);
      setShowRings(false);
      setPhase("reveal");
      return;
    }
    let index = 0;
    const timer = window.setInterval(() => {
      if (index >= script.length) { window.clearInterval(timer); setPhase("reveal"); return; }
      const line = script[index];
      index += 1;
      setLines((current) => (current.includes(line) ? current : [...current, line]));
      audio.repBeep();
    }, 460);
    audio.rankUp();
    const rings = window.setTimeout(() => setShowRings(false), 1400);
    return () => { window.clearInterval(timer); window.clearTimeout(rings); };
  }, [hunter, fastMode, destiny]);

  if (!destiny || !cls) return null;
  const booting = lines.length < 5;

  return (
    <div className="job-overlay" role="dialog" aria-modal="true" aria-label="Job Change Quest">
      <div className="job-aura" aria-hidden="true" />
      {showRings && (
        <div className="gate-portal" aria-hidden="true">
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
        </div>
      )}
      <div className="job-inner">
        <div className="text-center mb-5">
          <div className="font-kr text-[12px] tracking-[.36em] text-[color:var(--cyan-bright)]">시스템</div>
          <div className="font-wide text-[18px] sm:text-[27px] tracking-[.2em] text-[color:var(--text-bright)] job-heading">JOB CHANGE QUEST</div>
          <p className="font-mono text-[11px] tracking-[.2em] text-[color:var(--gold)] mt-2">B-RANK (LEVEL 40) · MONARCH AWAKENING</p>
        </div>

        {phase === "boot" ? (
          <SystemWindow title="SYSTEM TRANSMISSION" titleSize="sm">
            <div className="min-h-[190px] flex flex-col justify-center gap-3 font-mono text-[11px] sm:text-[13px] tracking-wider">
              {lines.map((line, i) => <div key={i} className="slide-up"><span className="text-[color:var(--text-dim)]">&gt; </span><RunicText text={line} duration={340} /></div>)}
            </div>
            <button className="sl-btn w-full mt-3" onClick={() => setPhase("reveal")}>
              {booting ? "SKIP TRANSMISSION" : "CONTINUE"}
            </button>
          </SystemWindow>
        ) : (
          <SystemWindow title="YOUR DESTINED PATH" accent={destiny.color}>
            <p className="text-[12px] text-[color:var(--text-mid)] mb-4 leading-relaxed text-center">
              Every choice you've made has led here. The System recognizes the class you forged,
              and the Monarch lineage that answers to it. The path is sealed once accepted.
            </p>
            <div className="job-destiny-card" style={{ ["--path-color" as string]: destiny.color }}>
              <div className="job-destiny-art">
                <div className="job-destiny-emblem" style={{ color: destiny.color }}>{destiny.icon}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="job-destiny-class" style={{ color: destiny.color }}>
                  {cls.icon} {cls.name.toUpperCase()} → {destiny.jobClass.toUpperCase()}
                </div>
                <div className="job-destiny-name">{destiny.name}</div>
                <div className="job-destiny-flavor">{destiny.flavor}</div>
              </div>
            </div>
            {phase === "confirm" ? (
              <div className="slide-up mt-4">
                <p className="font-mono text-[10px] text-[color:var(--gold)] text-center tracking-wider">
                  "THE NASCENT TRIALS BEGIN NOW."
                </p>
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button className="sl-btn flex-1" onClick={() => setPhase(phase === "confirm" ? "reveal" : "reveal")}>
                {phase === "confirm" ? "CONSIDER AGAIN" : "STUDY YOUR LINEAGE"}
              </button>
              <button
                className="sl-btn sl-btn-solid flex-1"
                onClick={() => {
                  if (phase === "reveal") setPhase("confirm");
                  else choose(destiny.id);
                }}
              >
                {phase === "confirm" ? `RISE, ${destiny.jobClass.toUpperCase()}` : "ACCEPT THE PATH"}
              </button>
            </div>
            {phase === "reveal" && (
              <div className="mt-4">
                <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] leading-relaxed">
                  Four classes harden into four Monarch lineages. Your {cls.name} training determines
                  yours — there is no picking another. Five trials lie between you and the throne.
                </p>
                <div className="job-mini-paths mt-2">
                  {MONARCH_PATHS.map((path) => (
                    <div key={path.id} className="job-mini-path" style={{ color: path.color, opacity: path.id === destiny.id ? 1 : 0.45 }}>
                      <span>{path.icon}</span><span>{path.jobClass}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SystemWindow>
        )}
      </div>
    </div>
  );
}
