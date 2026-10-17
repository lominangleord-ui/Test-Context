import { useEffect, useState } from "react";
import { MONARCH_PATHS } from "../data/monarchPaths";
import { useGame } from "../store/game";
import { audio } from "../lib/audio";
import { RunicText } from "./common";
import { SystemWindow } from "./SystemWindow";
import type { PathId } from "../types";

export function JobChange() {
  const hunter = useGame((state) => state.name);
  const choose = useGame((state) => state.chooseMonarchPath);
  const fastMode = useGame((state) => state.settings.fastMode);
  const [phase, setPhase] = useState<"boot" | "choose" | "confirm">("boot");
  const [lines, setLines] = useState<string[]>([]);
  const [selected, setSelected] = useState<PathId | null>(null);
  const [showRings, setShowRings] = useState(true);

  useEffect(() => {
    const script = [
      "LEVEL THRESHOLD: 40 REACHED",
      `HUNTER RECOGNIZED: ${hunter.toUpperCase()}`,
      "ASSOCIATION CLASSIFICATION: B-RANK",
      "MONARCH POTENTIAL DETECTED",
      "JOB CHANGE QUEST: CHOOSE YOUR PATH",
    ];
    if (fastMode) {
      setLines(script);
      setShowRings(false);
      setPhase("choose");
      return;
    }
    let index = 0;
    const timer = window.setInterval(() => {
      if (index >= script.length) { window.clearInterval(timer); setPhase("choose"); return; }
      const line = script[index];
      index += 1;
      setLines((current) => (current.includes(line) ? current : [...current, line]));
      audio.repBeep();
    }, 460);
    audio.rankUp();
    const rings = window.setTimeout(() => setShowRings(false), 1400);
    return () => { window.clearInterval(timer); window.clearTimeout(rings); };
  }, [hunter, fastMode]);

  const selection = MONARCH_PATHS.find((path) => path.id === selected);
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
          <p className="font-mono text-[11px] tracking-[.2em] text-[color:var(--gold)] mt-2">B-RANK (LEVEL 40) · NINE MONARCH PATHWAYS</p>
        </div>

        {phase === "boot" ? (
          <SystemWindow title="SYSTEM TRANSMISSION" titleSize="sm">
            <div className="min-h-[190px] flex flex-col justify-center gap-3 font-mono text-[11px] sm:text-[13px] tracking-wider">
              {lines.map((line, i) => <div key={i} className="slide-up"><span className="text-[color:var(--text-dim)]">&gt; </span><RunicText text={line} duration={340} /></div>)}
            </div>
            <button className="sl-btn w-full mt-3" onClick={() => setPhase("choose")}>
              {booting ? "SKIP TRANSMISSION" : "CONTINUE TO PATH SELECTION"}
            </button>
          </SystemWindow>
        ) : (
          <SystemWindow title={phase === "confirm" ? "CONFIRM JOB CHANGE" : "NINE MONARCH PATHWAYS"}>
            <p className="text-[12px] text-[color:var(--text-mid)] mb-4 leading-relaxed text-center">
              Nine lineages. One life. No path grants extra XP. Every Gate is a player-initiated,
              untimed battle powered by the stats earned through training. Your starting class does
              not restrict which lineage you can take.
            </p>
            <div className="job-path-grid">
              {MONARCH_PATHS.map((path) => {
                const active = path.id === selected;
                return <button
                  key={path.id}
                  className={`job-path ${active ? "selected" : ""}`}
                  style={{ ["--path-color" as string]: path.color }}
                  onClick={() => { setSelected(path.id); setPhase("confirm"); }}
                  aria-pressed={active}
                >
                  <span className="job-path-icon" aria-hidden="true">{path.icon}</span>
                  <span className="min-w-0 block">
                    <span className="job-path-name">{path.name}</span>
                    <span className="job-path-class">{path.jobClass}</span>
                    <span className="job-path-flavor">{path.flavor}</span>
                  </span>
                  {active && <span className="job-path-mark" aria-hidden="true">◆</span>}
                </button>;
              })}
            </div>
            {phase === "confirm" && selection && <div className="job-confirm slide-up">
              <p className="font-wide text-[11px] tracking-wider" style={{ color: selection.color }}>{selection.name.toUpperCase()} · {selection.jobClass.toUpperCase()}</p>
              <p className="text-[12px] text-[color:var(--text-mid)] mt-2">This choice is permanent for this hunter. No mid-run respec. You can still browse all nine paths above before confirming.</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <button className="sl-btn flex-1" onClick={() => { setSelected(null); setPhase("choose"); }}>REVIEW ALL NINE</button>
                <button className="sl-btn sl-btn-solid flex-1" onClick={() => choose(selection.id)}>CONFIRM {selection.jobClass.toUpperCase()}</button>
              </div>
            </div>}
          </SystemWindow>
        )}
      </div>
    </div>
  );
}
