import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useUi } from "../store/ui";
import { useGame } from "../store/game";
import { getPath, PATH_TIERS, GATE_BOSS_STATS, TIER_TO_KEY } from "../data/monarchPaths";
import {
  BOSS_MOVES,
  chooseBossMove,
  deriveBattleStats,
  HARDEN_DEF_BONUS,
  moveDamage,
  rollAttackDamage,
  type BossMoveId,
} from "../lib/battle";
import {
  applyMove,
  buildMoveGrid,
  MOVE_ROLE_COLOR,
  MOVE_ROLE_LABEL,
  MOVE_ROLES,
  moveEffect,
  moveUnlockReason,
  NO_MODIFIERS,
  pathDisplayName,
  type MoveModifiers,
} from "../lib/moves";
import { SystemWindow } from "./SystemWindow";
import { RunicText } from "./common";
import { audio } from "../lib/audio";
import { shake, flash, fctAt } from "../lib/juice";
import type { PathMove } from "../types";

/** One message-box line, matching the Awaken sequence's typed-line cadence. */
const LINE_MS = 1050;

type Phase = "busy" | "menu" | "victory" | "defeat";

interface Anim {
  hunterLunge: boolean;
  bossLunge: boolean;
  hunterHit: boolean;
  bossHit: boolean;
  bossGuard: boolean;
}

const NO_ANIM: Anim = { hunterLunge: false, bossLunge: false, hunterHit: false, bossHit: false, bossGuard: false };

/** Bold, glowing silhouettes — the same icon-driven language as the rest of the HUD. */
function HunterSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" className="battle-silhouette" style={{ color }} aria-hidden="true">
      <circle cx="32" cy="18" r="10" fill="currentColor" />
      <path d="M12 58c0-12 9-21 20-21s20 9 20 21Z" fill="currentColor" />
    </svg>
  );
}

function BossSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" className="battle-silhouette" style={{ color }} aria-hidden="true">
      <path d="M32 4 20 16 8 12l6 14-6 10 12-2 12 12 12-12 12 2-6-10 6-14-12 4Z" fill="currentColor" />
      <path d="M8 58c0-13 11-22 24-22s24 9 24 22Z" fill="currentColor" />
    </svg>
  );
}

/** Thick, segmented, colour-shifting bar: the single biggest "real RPG" cue. */
function BattleBar({ value, max, tone }: { value: number; max: number; tone: "player" | "boss" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = pct <= 20 ? "#ff3b52" : pct <= 50 ? "#ffc53d" : tone === "player" ? "#2fe08a" : "#ff8a5b";
  return (
    <div className="battle-bar">
      <div className="battle-bar-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="battle-bar-seg" aria-hidden="true" />
      <span className="battle-bar-text">{Math.max(0, Math.round(value))} / {Math.round(max)}</span>
    </div>
  );
}

export function GateBattle() {
  const tier = useUi((state) => state.activeGateBattle);
  const close = useUi((state) => state.closeGateBattle);
  const state = useGame(useShallow((game) => ({
    name: game.name,
    level: game.level,
    str: game.str,
    agi: game.agi,
    vit: game.vit,
    pts: game.pts, sp: game.sp,
    fatigueLevel: game.fatigueLevel,
    monarchPath: game.monarchPath,
    clearedGates: game.clearedGates,
    learnedMoves: game.learnedMoves,
    completeGate: game.completeGate,
    fastMode: game.settings.fastMode,
  })));
  const path = getPath(state.monarchPath);
  const band = PATH_TIERS[(tier ?? 1) - 1];
  const bossStats = GATE_BOSS_STATS[TIER_TO_KEY[tier ?? 1]];
  const stats = useMemo(() => deriveBattleStats(state), [state.str, state.agi, state.vit, state.fatigueLevel]);
  const gateName = path?.tiers[(tier ?? 1) - 1].gateName ?? "Gate Guardian";
  const replay = tier ? state.clearedGates.includes(tier) : false;

  const [playerHP, setPlayerHP] = useState(stats.maxHP);
  const [bossHP, setBossHP] = useState<number>(bossStats.hp);
  const [mods, setMods] = useState<MoveModifiers>(NO_MODIFIERS);
  const [usedBossMoves, setUsedBossMoves] = useState<BossMoveId[]>([]);
  const [lastBossMove, setLastBossMove] = useState<BossMoveId | null>(null);
  const [telegraphed, setTelegraphed] = useState(false);
  const [phase, setPhase] = useState<Phase>("busy");
  const [ending, setEnding] = useState<"victory" | "defeat" | null>(null);
  const [messages, setMessages] = useState<string[]>([
    "【 SYSTEM / GATE BATTLE 】",
    `Readiness: ${stats.readiness.name}. ${stats.readiness.description}`,
    `Guardian detected: ${gateName}. You act first.`,
  ]);
  const [messageIndex, setMessageIndex] = useState(0);
  const [anim, setAnim] = useState<Anim>(NO_ANIM);

  const hunterRef = useRef<HTMLDivElement>(null);
  const bossRef = useRef<HTMLDivElement>(null);
  const timers = useRef<Set<number>>(new Set());
  const bossHPRef = useRef<number>(bossStats.hp);
  const playerHPRef = useRef(stats.maxHP);

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, state.fastMode ? Math.min(50, delay) : delay);
    timers.current.add(timer);
  };
  const pulse = (patch: Partial<Anim>, hold = 460) => {
    setAnim((current) => ({ ...current, ...patch }));
    const keys = Object.keys(patch) as (keyof Anim)[];
    schedule(() => setAnim((current) => {
      const next = { ...current };
      for (const key of keys) next[key] = false;
      return next;
    }), hold);
  };

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  if (!tier || !path || !band) return null;

  const displayName = pathDisplayName(path, state.level);
  const bossAtkEffective = () => Math.round(bossStats.atk * (1 + mods.bossAtk));
  const bossDefEffective = () => Math.round(bossStats.def * (1 + mods.bossDef));
  const playerAtkEffective = () => Math.round(stats.atk * (1 + mods.playerAtk));
  const playerDefEffective = () => Math.round(stats.def * (1 + mods.playerDef));
  const critEffective = () => Math.min(100, stats.critChance * (1 + mods.playerCrit));
  const unlockState = { ...state, pts: state.pts, sp: state.sp };

  const beginTurn = (msgs: string[]) => {
    setMessages(msgs);
    setMessageIndex(0);
  };

  /** Tap-to-advance. The last line of a resolved fight opens the result panel. */
  const advance = () => {
    if (phase !== "busy") return;
    if (messageIndex < messages.length - 1) {
      setMessageIndex((index) => index + 1);
      return;
    }
    if (ending) setPhase(ending);
    else setPhase("menu");
  };

  const playMove = (move: PathMove) => {
    if (phase !== "menu") return;
    const nextMods = applyMove(mods, move);
    const lines: string[] = [`You use ${move.name.toUpperCase()}!`];
    let defeated = false;

    if (move.power > 0) {
      const { damage, critical } = moveDamage(move.power, playerAtkEffective(), bossDefEffective(), critEffective());
      const remaining = Math.max(0, bossHPRef.current - damage);
      bossHPRef.current = remaining;
      setBossHP(remaining);
      pulse({ hunterLunge: true }, 320);
      pulse({ bossHit: true }, 480);
      if (move.role === "ultimate") { audio.ultimateImpact(); flash(path.color, 0.34); }
      else if (move.role === "weaken") { audio.weakenBlip(); }
      else if (move.role === "drain") { audio.drainWhoosh(); }
      else audio.hitThud();
      // Screen shake mirrors the impact that actually landed, not the damage number.
      shake(move.role === "ultimate" || critical ? "lg" : "sm");
      fctAt(bossRef.current, critical ? `${damage} CRIT` : damage, critical ? "crit" : "dmg");
      lines.push(critical ? `A critical hit for ${damage} damage.` : `It deals ${damage} damage.`);
      if (move.drain) {
        const healed = Math.min(stats.maxHP - playerHPRef.current, Math.round(damage * move.drain));
        if (healed > 0) {
          playerHPRef.current += healed;
          setPlayerHP(playerHPRef.current);
          lines.push(`You recover ${healed} HP.`);
          fctAt(hunterRef.current, `+${healed}`, "heal");
        }
      }
      if (remaining <= 0) {
        setMods(nextMods);
        lines.push(replay ? "VICTORY. Replay complete; first-clear rewards were not repeated." : "VICTORY. First-clear rewards are ready.");
        setEnding("victory");
        beginTurn(lines);
        schedule(() => { audio.questComplete(); fctAt(bossRef.current, "GATE CLEARED", "crit"); }, 420);
        return;
      }
      defeated = true;
    } else if (move.buff) {
      audio.empowerRise();
      pulse({ hunterLunge: true }, 320);
      lines.push(move.buff === "crit"
        ? "Your critical focus sharpens for the rest of the fight."
        : `Your ${move.buff.toUpperCase()} rises for the rest of the fight.`);
    } else if (move.debuff) {
      audio.weakenBlip();
      pulse({ bossHit: true }, 480);
      lines.push(`The Guardian's ${move.debuff.toUpperCase()} falls for the rest of the fight.`);
    }
    setMods(nextMods);
    if (!defeated) return;

    // ── Boss turn ──
    schedule(() => {
      const bossLines: string[] = [];
      if (telegraphed) {
        const { damage } = rollAttackDamage(bossAtkEffective(), playerDefEffective(), 0);
        setTelegraphed(false);
        setLastBossMove("wrath");
        bossLines.push(`${BOSS_MOVES.wrath.name.toUpperCase()} lands.`, `The Guardian deals ${damage} damage.`);
        audio.ultimateImpact();
        pulse({ bossLunge: true, hunterHit: true }, 520);
        shake("lg"); flash("#ff3b52", 0.3);
        fctAt(hunterRef.current, damage, "dmg");
        playerHPRef.current = Math.max(0, playerHPRef.current - damage);
        setPlayerHP(playerHPRef.current);
      } else {
        const chosen = chooseBossMove(bossHPRef.current, bossStats.hp, usedBossMoves, lastBossMove);
        if (chosen.id === "harden") {
          setUsedBossMoves((used) => [...used, "harden"]);
          setMods((current) => ({ ...current, bossDef: current.bossDef + HARDEN_DEF_BONUS }));
          setLastBossMove("harden");
          bossLines.push("The Guardian HARDENS. Its defense rises for the rest of the fight.");
          audio.hardenClink();
          pulse({ bossGuard: true }, 560);
        } else if (chosen.id === "wrath") {
          setTelegraphed(true);
          setLastBossMove("wrath");
          bossLines.push("The Guardian is gathering power...");
          audio.telegraph();
        } else {
          const { damage } = rollAttackDamage(bossAtkEffective(), playerDefEffective(), 0);
          setLastBossMove("claw");
          bossLines.push(`The Guardian uses ${BOSS_MOVES.claw.name}.`, `It deals ${damage} damage.`);
          audio.error();
          pulse({ bossLunge: true, hunterHit: true }, 460);
          shake("lg"); flash("#ff3b52", 0.24);
          fctAt(hunterRef.current, damage, "dmg");
          playerHPRef.current = Math.max(0, playerHPRef.current - damage);
          setPlayerHP(playerHPRef.current);
        }
      }
      if (playerHPRef.current <= 0) {
        bossLines.push("DEFEAT. Retreat and prepare. Try again anytime.");
        setEnding("defeat");
        beginTurn([...lines, ...bossLines]);
        return;
      }
      beginTurn([...lines, ...bossLines]);
    }, LINE_MS);
  };

  const finish = () => {
    if (phase === "victory" && !replay) state.completeGate(tier);
    close();
  };

  const grid = buildMoveGrid(path, state.learnedMoves);
  const lastLine = messages[Math.min(messageIndex, messages.length - 1)] ?? "";

  return createPortal(
    <div className="fixed inset-0 z-[86] sys-backdrop gate-battle-overlay flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${gateName} Gate Battle`} style={{ ["--path-color" as string]: path.color }}>
      <div className="camera-shell max-w-[680px] relative">
        <header className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-head text-[16px] font-bold tracking-wider uppercase" style={{ color: path.color, textShadow: `0 0 12px ${path.color}` }}>
              {path.icon} {displayName} / {band.name} Gate
            </div>
            <div className="font-mono text-[9px] text-[color:var(--text-dim)] mt-1">{replay ? "REPLAY / NO REPEAT REWARDS" : "FIRST CLEAR / SKILL + TITLE + LOOT"}</div>
          </div>
          {phase === "menu" && <button className="sl-btn sl-btn-danger px-3 text-[10px]" onClick={close}>RETREAT</button>}
        </header>

        <SystemWindow title={gateName.toUpperCase()} accent={path.color}>
          <div className="battle-readiness" style={{ borderColor: stats.readiness.color }}>
            <div>
              <div className="font-sys text-[10px] tracking-wider" style={{ color: stats.readiness.color }}>{stats.readiness.name.toUpperCase()} / FATIGUE {Math.round(state.fatigueLevel)}%</div>
              <div className="text-[11px] text-[color:var(--text)] mt-1">{stats.readiness.description}</div>
            </div>
            {stats.readiness.id !== "peak" && <span className="font-mono text-[9px] text-[color:var(--gold)]">RECOVERY RECOMMENDED</span>}
          </div>

          {/* ── Arena: boss upper-right, hunter lower-left ── */}
          <div className="battle-arena">
            <div ref={bossRef} className={`battle-side boss ${anim.bossLunge ? "lunge" : ""} ${anim.bossHit ? "hit" : ""} ${anim.bossGuard ? "guard" : ""}`}>
              <div className="battle-infobox">
                <div className="battle-name" style={{ color: "var(--red)" }}>GATE GUARDIAN · {band.name.toUpperCase()}</div>
                <BattleBar value={bossHP} max={bossStats.hp} tone="boss" />
                <div className="battle-stat-row"><span>ATK {bossAtkEffective()}</span><span>DEF {bossDefEffective()}</span></div>
              </div>
              <BossSilhouette color={path.color} />
            </div>

            <div ref={hunterRef} className={`battle-side hunter ${anim.hunterLunge ? "lunge" : ""} ${anim.hunterHit ? "hit" : ""}`}>
              <HunterSilhouette color="var(--cyan-bright)" />
              <div className="battle-infobox">
                <div className="battle-name">{state.name.toUpperCase()}</div>
                <BattleBar value={playerHP} max={stats.maxHP} tone="player" />
                <div className="battle-stat-row">
                  <span>ATK {playerAtkEffective()}</span><span>DEF {playerDefEffective()}</span><span>CRIT {Math.round(critEffective())}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Message box, then the move grid, then the result ── */}
          {phase === "victory" || phase === "defeat" ? (
            <div className="space-y-3 mt-3">
              <div className={`battle-result ${phase}`}>{phase === "victory" ? "GATE CONQUERED" : "HUNTER DEFEATED"}</div>
              <button className="sl-btn sl-btn-solid w-full" onClick={finish}>
                {phase === "victory" ? replay ? "FINISH REPLAY" : "CLAIM FIRST-CLEAR REWARDS" : "RETREAT & PREPARE"}
              </button>
            </div>
          ) : phase === "menu" ? (
            <div className="battle-messagebox">
              <div className="battle-message-prompt">
                <span className="font-mono text-[9px] tracking-[0.2em] text-[color:var(--text-dim)]">CHOOSE A MOVE</span>
                <span className="battle-cursor" aria-hidden="true">▼</span>
              </div>
              <div className="battle-movegrid" role="group" aria-label="Moves">
                {grid.map(({ move, unlocked }) => {
                  const color = MOVE_ROLE_COLOR[move.role];
                  return (
                    <button
                      key={move.id}
                      className={`battle-move ${unlocked ? "" : "locked"}`}
                      disabled={!unlocked}
                      title={unlocked ? `${move.name} — ${moveEffect(move)}` : moveUnlockReason(unlockState, move) ?? undefined}
                      onClick={() => playMove(move)}
                    >
                      <span className="battle-move-head">
                        <span className="battle-move-name">{unlocked ? move.name : `🔒 ${move.name}`}</span>
                        <span className="battle-move-tag" style={{ color, borderColor: `${color}66` }}>{MOVE_ROLE_LABEL[move.role]}</span>
                      </span>
                      <span className="battle-move-effect">{moveEffect(move)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="battle-legend" aria-hidden="true">
                {MOVE_ROLES.map((role) => (
                  <span key={role} style={{ color: MOVE_ROLE_COLOR[role] }}>{MOVE_ROLE_LABEL[role]}</span>
                ))}
              </div>
            </div>
          ) : (
            <button className="battle-messagebox dialogue" onClick={advance} type="button">
              <span className="font-mono text-[11.5px] leading-relaxed" aria-live="polite">
                <span className="text-[color:var(--text-faint)]">&gt;&nbsp;</span>
                <RunicText text={lastLine} duration={300} />
              </span>
              <span className="battle-cursor" aria-hidden="true">▼</span>
              <span className="battle-tap-hint font-mono text-[8.5px] tracking-[0.2em] text-[color:var(--text-faint)]">TAP TO CONTINUE</span>
            </button>
          )}
        </SystemWindow>
      </div>
    </div>,
    document.body,
  );
}
