import { useEffect, useState } from "react";
import type { GameClassId } from "../types";
import { useGame } from "../store/game";
import { AVATARS } from "../data";
import type { ArchetypeId } from "../types";
import { SystemWindow } from "./SystemWindow";
import { RunicText } from "./common";
import { audio } from "../lib/audio";

/**
 * The four starting Pathways — each bundles a daily-target archetype AND a
 * hunter class together, so new players make one meaningful choice instead of
 * two confusing back-to-back picks. The Monarch Pathways (all nine) stay a
 * free choice at the level-40 Job Change ceremony.
 */
const STARTING_PATHWAYS: {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  archetype: ArchetypeId;
  gameClass: GameClassId;
  blurb: string;
}[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    tagline: "Frontline · Strength & Vitality",
    icon: "⚔",
    color: "#ff8a5b",
    archetype: "monarch",
    gameClass: "fighter",
    blurb: "Push-ups start at 60 and grow to 120. Cleave, Iron Guard, Warlord's Roar — you stand in the front and outlast everything.",
  },
  {
    id: "arcanist",
    name: "Arcanist",
    tagline: "Artillery · Mind & Power",
    icon: "✧",
    color: "#a58bff",
    archetype: "balanced",
    gameClass: "mage",
    blurb: "Balanced targets with a full kit of Mana Bolt, Flame Lance, and Arcane Focus. Distance, precision, and overwhelming force.",
  },
  {
    id: "shadow",
    name: "Shadow",
    tagline: "Striker · Speed & Precision",
    icon: "◈",
    color: "#38d98a",
    archetype: "assassin",
    gameClass: "assassin",
    blurb: "Core & squats start at 60 and grow to 115. Quick Strike, Vital Strike, Assassinate — four cuts before the first one lands.",
  },
  {
    id: "ranger",
    name: "Ranger",
    tagline: "Marksman · Endurance & Control",
    icon: "⌖",
    color: "#8fdfff",
    archetype: "vanguard",
    gameClass: "ranger",
    blurb: "Runs start at 1.5km and grow to 12km. Piercing Shot, Camouflage, Eagle Eye — solve the fight from range, patiently.",
  },
];

export function Intro() {
  const awaken = useGame((s) => s.awaken);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0].src);
  const [pathwayId, setPathwayId] = useState(STARTING_PATHWAYS[0].id);
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

            <div className="font-sys text-[9.5px] tracking-[0.3em] text-[color:var(--text-dim)] uppercase mb-2">
              Choose Your Pathway
            </div>
            <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mb-3 leading-relaxed">
              Four pathways. One decides how you train AND how you fight. You can take any of the
              nine Monarch lineages at the Job Change (level 40) — your starting path does not lock that.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {STARTING_PATHWAYS.map((p) => {
                const on = pathwayId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => pick(() => setPathwayId(p.id))}
                    className="class-card"
                    style={{
                      borderColor: on ? p.color : "#ffffff12",
                      background: on ? `${p.color}14` : "#04101d80",
                      boxShadow: on ? `0 0 20px ${p.color}44` : "none",
                    }}
                    aria-pressed={on}
                  >
                    <span className="class-card-icon" style={{ color: p.color }}>{p.icon}</span>
                    <span className="min-w-0 block">
                      <span className="block font-head text-[16px] tracking-wide" style={{ color: on ? p.color : "var(--text-bright)" }}>
                        {p.name}
                      </span>
                      <span className="block font-mono text-[9px] tracking-[0.18em] mt-0.5" style={{ color: on ? p.color : "var(--text-dim)" }}>
                        {p.tagline.toUpperCase()}
                      </span>
                      <span className="block text-[11px] text-[color:var(--text)] mt-1.5 leading-snug">{p.blurb}</span>
                    </span>
                    {on && <span className="ml-2 text-lg" style={{ color: p.color }} aria-hidden="true">◆</span>}
                  </button>
                );
              })}
            </div>
          </SystemWindow>
        )}

        {ready && (
          <button
            onClick={() => {
              const chosen = STARTING_PATHWAYS.find((p) => p.id === pathwayId)!;
              if (!name.trim()) return;
              awaken(name, chosen.archetype, avatar, chosen.gameClass);
            }}
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
