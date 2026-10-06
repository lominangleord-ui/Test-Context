import { useEffect, useState } from "react";
import type { GameClassId } from "../types";
import { useGame } from "../store/game";
import { ARCHETYPES, AVATARS } from "../data";
import { HUNTER_CLASSES } from "../data/classes";
import type { ArchetypeId } from "../types";
import { SystemWindow } from "./SystemWindow";
import { RunicText } from "./common";
import { audio } from "../lib/audio";

export function Intro() {
  const awaken = useGame((s) => s.awaken);
  const [name, setName] = useState("");
  const [arch, setArch] = useState<ArchetypeId>("balanced");
  const [gameClass, setGameClass] = useState<GameClassId>("fighter");
  const [avatar, setAvatar] = useState(AVATARS[0].src);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(t);
  }, []);

  const pick = (fn: () => void) => {
    audio.unlock();
    audio.repBeep();
    fn();
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 relative z-[2]">
      {!ready && (
        <div className="gate-portal">
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
        </div>
      )}

      <div
        className="w-full max-w-[520px] space-y-5"
        style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Masthead */}
        <div className="text-center">
          <div className="font-kr text-xl text-[color:var(--cyan-bright)] tracking-[0.5em] glow-text">
            시스템
          </div>
          <h1
            className="font-head text-[54px] sm:text-[68px] leading-[0.9] font-black tracking-[0.14em] text-[color:var(--text-bright)] mt-1"
            style={{ textShadow: "0 0 50px var(--cyan), 0 0 100px var(--cyan-glow), 0 0 6px #fff4" }}
          >
            THE SYSTEM
          </h1>
          <div className="font-sys text-[9.5px] tracking-[0.42em] text-[color:var(--text-dim)] uppercase mt-1.5">
            Hunter Awakening Protocol
          </div>
          <div className="mx-auto mt-3 w-40 h-px bg-gradient-to-r from-transparent via-[color:var(--cyan)] to-transparent" />
        </div>

        {ready && (
          <SystemWindow title="REGISTRATION" titleSize="sm">
            {/* Portrait selection */}
            <div className="font-sys text-[9.5px] tracking-[0.3em] text-[color:var(--text-dim)] uppercase mb-2">
              Select Portrait
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pick(() => setAvatar(a.src))}
                  className={`pfp-pick aspect-[4/5] ${avatar === a.src ? "on" : ""}`}
                  title={a.name}
                >
                  <img src={a.src} alt={a.name} />
                  {avatar === a.src && (
                    <span className="absolute inset-x-0 bottom-0 bg-[#020a14e6] font-sys text-[8px] tracking-[0.18em] text-[color:var(--cyan-bright)] py-0.5 text-center">
                      ◆
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Name */}
            <div className="font-sys text-[9.5px] tracking-[0.3em] text-[color:var(--text-dim)] uppercase mb-2">
              Player Name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="Enter designation…"
              autoFocus
              className="sl-input mb-4"
            />

            {/* Specialty: what you train, not what you fight with */}
            <div className="font-sys text-[9.5px] tracking-[0.3em] text-[color:var(--text-dim)] uppercase mb-2">
              Choose Specialty
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {(Object.values(ARCHETYPES) as (typeof ARCHETYPES)[ArchetypeId][]).map((a) => {
                const on = arch === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => pick(() => setArch(a.id))}
                    className="text-left p-2.5 border transition-all flex items-start gap-2.5"
                    style={{
                      borderColor: on ? "var(--cyan)" : "#ffffff12",
                      background: on ? "#1e9bff12" : "#04101d66",
                      boxShadow: on ? "0 0 18px var(--cyan-glow)" : "none",
                    }}
                  >
                    <span className="text-xl leading-none mt-0.5">{a.icon}</span>
                    <div className="min-w-0">
                      <div className="font-sys text-[12px] font-600 tracking-[0.1em] text-[color:var(--text-bright)]">
                        {a.name}
                      </div>
                      <div className="text-[10px] text-[color:var(--text)] leading-snug mt-0.5">
                        {a.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hunter class: the kit you fight the story with */}
            <div className="font-sys text-[9.5px] tracking-[0.3em] text-[color:var(--text-dim)] uppercase mt-4 mb-2">
              Choose Hunter Class
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {HUNTER_CLASSES.map((entry) => {
                const on = gameClass === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => pick(() => setGameClass(entry.id))}
                    className="text-left p-2.5 border transition-all flex items-start gap-2.5"
                    style={{
                      borderColor: on ? entry.color : "#ffffff12",
                      background: on ? `${entry.color}14` : "#04101d66",
                      boxShadow: on ? `0 0 18px ${entry.color}44` : "none",
                    }}
                  >
                    <span className="text-xl leading-none mt-0.5" style={{ color: entry.color }}>{entry.icon}</span>
                    <div className="min-w-0">
                      <div className="font-sys text-[12px] font-600 tracking-[0.1em]" style={{ color: on ? entry.color : "var(--text-bright)" }}>
                        {entry.name}
                      </div>
                      <div className="text-[10px] text-[color:var(--text)] leading-snug mt-0.5">
                        {entry.role} · leans {entry.stats.map((stat) => stat.toUpperCase()).join(" / ")}. Eight-skill tree, all of it by level 30.
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[9px] text-[color:var(--text-dim)] mt-2">
              YOUR SPECIALTY SETS DAILY TARGETS. YOUR CLASS SETS THE SKILL TREE YOU FIGHT WITH.
            </p>
          </SystemWindow>
        )}

        {ready && (
          <button
            onClick={() => name.trim() && awaken(name, arch, avatar, gameClass)}
            disabled={!name.trim()}
            className="sl-btn sl-btn-solid w-full py-4 text-lg font-head tracking-[0.5em]"
          >
            AWAKEN
          </button>
        )}
      </div>
    </div>
  );
}

export function Awaken() {
  const name = useGame((s) => s.name);
  const avatar = useGame((s) => s.avatar);
  const finishAwakening = useGame((s) => s.finishAwakening);
  const fastMode = useGame((s) => s.settings.fastMode);
  const [lines, setLines] = useState<string[]>([]);
  const [showGate, setShowGate] = useState(true);

  const script = [
    "Awakening…",
    "Scanning Player…",
    `Player Found: ${name}`,
    "Assigning Rank… E",
    "Daily Quest Loaded.",
    "The System is now active.",
  ];

  useEffect(() => {
    audio.unlock();
    if (fastMode) {
      setShowGate(false);
      setLines(script);
      const quick = window.setTimeout(finishAwakening, 80);
      return () => window.clearTimeout(quick);
    }
    const t0 = setTimeout(() => setShowGate(false), 1100);
    let i = 0;
    const timers: number[] = [];
    const add = () => {
      if (i < script.length) {
        const line = script[i];
        setLines((p) => [...p, line]);
        audio.repBeep();
        i++;
        timers.push(window.setTimeout(add, 500));
      } else {
        audio.levelUp();
        timers.push(
          window.setTimeout(() => {
            finishAwakening();
          }, 900),
        );
      }
    };
    timers.push(window.setTimeout(add, 1300));
    return () => {
      clearTimeout(t0);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fastMode]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-5 relative z-[2]">
      {showGate && (
        <div className="gate-portal">
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
        </div>
      )}
      <div className="w-full max-w-[500px]">
        <SystemWindow title="SYSTEM BOOT" titleSize="sm">
          <div className="flex gap-4 items-start">
            <div className="pfp-frame w-[78px] h-[96px] shrink-0">
              <span className="pfp-scan" />
              <img src={avatar} alt="" />
            </div>
            <div className="flex-1 min-w-0">
              {lines.map((l, idx) => (
                <div key={idx} className="font-mono text-[12.5px] tracking-[0.05em] mb-1.5 slide-up">
                  <span className="text-[color:var(--text-faint)]">&gt;&nbsp;</span>
                  {idx === lines.length - 1 ? (
                    <RunicText text={l} className="typing-caret text-[color:var(--cyan-bright)]" duration={280} />
                  ) : (
                    <span className="text-[color:var(--cyan)]">{l}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}
