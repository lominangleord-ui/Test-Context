import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useUi } from "../store/ui";
import { useGame } from "../store/game";
import { getPath, PATH_TIERS, GATE_BOSS_STATS, TIER_TO_KEY } from "../data/monarchPaths";
import { deriveBattleStats, rollAttackDamage, signatureDamage } from "../lib/battle";
import { SystemWindow } from "./SystemWindow";
import { Bar } from "./common";
import { audio } from "../lib/audio";
import { shake, flash, fct } from "../lib/juice";

interface LogEntry {
  id: number;
  text: string;
  type: "player" | "boss" | "system" | "crit" | "special";
}

export function GateBattle() {
  const tier = useUi((state) => state.activeGateBattle);
  const close = useUi((state) => state.closeGateBattle);
  const state = useGame(useShallow((game) => ({
    name: game.name,
    str: game.str,
    agi: game.agi,
    vit: game.vit,
    fatigueLevel: game.fatigueLevel,
    monarchPath: game.monarchPath,
    clearedGates: game.clearedGates,
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
  const [signatureUsed, setSignatureUsed] = useState(false);
  const [phase, setPhase] = useState<"ready" | "animating" | "victory" | "defeat">("ready");
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    { id: 0, text: "【 SYSTEM / GATE BATTLE 】", type: "system" },
    { id: 1, text: `Readiness: ${stats.readiness.name}. ${stats.readiness.description}`, type: "system" },
    { id: 2, text: `Guardian detected: ${gateName}. You act first.`, type: "system" },
  ]);
  const nextLog = useRef(3);
  const logEnd = useRef<HTMLDivElement>(null);
  const timers = useRef<Set<number>>(new Set());

  const addLog = (text: string, type: LogEntry["type"]) => {
    const id = nextLog.current++;
    setLogs((current) => [...current, { id, text, type }].slice(-80));
  };
  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, state.fastMode ? Math.min(60, delay) : delay);
    timers.current.add(timer);
  };

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: state.fastMode ? "auto" : "smooth" });
  }, [logs, state.fastMode]);
  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  if (!tier || !path || !band) return null;

  const attack = (signature: boolean) => {
    if (phase !== "ready" || (signature && signatureUsed)) return;
    setPhase("animating");
    const result = signature
      ? { damage: signatureDamage(stats.atk, bossStats.def), critical: false }
      : rollAttackDamage(stats.atk, bossStats.def, stats.critChance);

    if (signature) {
      setSignatureUsed(true);
      addLog(`${path.icon} ${path.battleMove.toUpperCase()} tears through the Gate for ${result.damage} damage.`, "special");
      audio.repBeep(); shake("lg"); flash(path.color, .32); fct(`${result.damage} DMG`, "hit");
    } else if (result.critical) {
      addLog(`CRITICAL STRIKE. ${result.damage} damage.`, "crit");
      audio.repBeep(); shake("lg"); flash("#ffd700", .22); fct(`${result.damage} CRIT`, "crit");
    } else {
      addLog(`You attack for ${result.damage} damage.`, "player");
      audio.buy(); shake("sm"); fct(`${result.damage} DMG`, "hit");
    }

    const remainingBossHP = Math.max(0, bossHP - result.damage);
    setBossHP(remainingBossHP);
    if (remainingBossHP === 0) {
      schedule(() => {
        addLog(replay ? "VICTORY. Replay complete; first-clear rewards were not repeated." : "VICTORY. First-clear rewards are ready.", "system");
        setPhase("victory");
        audio.questComplete();
        fct("GATE CLEARED", "crit");
      }, 700);
      return;
    }

    schedule(() => {
      addLog("The Guardian retaliates.", "system");
      schedule(() => {
        const result = rollAttackDamage(bossStats.atk, stats.def, 0);
        const remainingPlayerHP = Math.max(0, playerHP - result.damage);
        setPlayerHP(remainingPlayerHP);
        addLog(`The Guardian deals ${result.damage} damage.`, "boss");
        audio.error(); shake("lg"); flash("#ff3b52", .3); fct(result.damage, "dmg");
        if (remainingPlayerHP === 0) {
          addLog("DEFEAT. Retreat and prepare. Try again anytime.", "system");
          setPhase("defeat");
        } else setPhase("ready");
      }, 520);
    }, 650);
  };

  const finish = () => {
    if (phase === "victory" && !replay) state.completeGate(tier);
    close();
  };

  return createPortal(
    <div className="fixed inset-0 z-[86] sys-backdrop gate-battle-overlay flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${gateName} Gate Battle`} style={{ ["--path-color" as string]: path.color }}>
      <div className="camera-shell max-w-[680px] relative">
        <header className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-head text-[16px] font-bold tracking-wider uppercase" style={{ color: path.color, textShadow: `0 0 12px ${path.color}` }}>
              {path.icon} {path.name} / {band.name} Gate
            </div>
            <div className="font-mono text-[9px] text-[color:var(--text-dim)] mt-1">{replay ? "REPLAY / NO REPEAT REWARDS" : "FIRST CLEAR / SKILL + TITLE + LOOT"}</div>
          </div>
          {phase === "ready" && <button className="sl-btn sl-btn-danger px-3 text-[10px]" onClick={close}>RETREAT</button>}
        </header>

        <SystemWindow title={gateName.toUpperCase()} accent={path.color}>
          <div className="battle-readiness" style={{ borderColor: stats.readiness.color }}>
            <div>
              <div className="font-sys text-[10px] tracking-wider" style={{ color: stats.readiness.color }}>{stats.readiness.name.toUpperCase()} / FATIGUE {Math.round(state.fatigueLevel)}%</div>
              <div className="text-[11px] text-[color:var(--text)] mt-1">{stats.readiness.description}</div>
            </div>
            {stats.readiness.id !== "peak" && <span className="font-mono text-[9px] text-[color:var(--gold)]">RECOVERY RECOMMENDED</span>}
          </div>

          <div className="battle-fighters">
            <div className="battle-fighter hunter">
              <div className="font-sys text-[11px] font-bold text-[color:var(--text-bright)]">{state.name.toUpperCase()}</div>
              <Bar value={playerHP} max={stats.maxHP} color="var(--green)" label="BATTLE HP" />
              <div className="battle-stat-row"><span>ATK {stats.atk}</span><span>DEF {stats.def}</span><span>CRIT {Math.round(stats.critChance)}%</span></div>
              {(stats.atk !== stats.baseATK || stats.def !== stats.baseDEF) && <div className="font-mono text-[8px] text-[color:var(--text-dim)] mt-1">RESTED BASE / HP {stats.baseHP} · ATK {stats.baseATK} · DEF {stats.baseDEF}</div>}
            </div>
            <div className="battle-versus">VS</div>
            <div className="battle-fighter boss">
              <div className="font-sys text-[11px] font-bold text-[color:var(--red)]">GATE GUARDIAN</div>
              <Bar value={bossHP} max={bossStats.hp} color="var(--red)" label="BOSS HP" />
              <div className="battle-stat-row"><span>ATK {bossStats.atk}</span><span>DEF {bossStats.def}</span><span>{band.name.toUpperCase()}</span></div>
            </div>
          </div>

          <div className="battle-log" aria-live="polite">
            {logs.map((log) => <div key={log.id} className={`battle-log-${log.type}`}>{log.text}</div>)}
            <div ref={logEnd} />
          </div>

          {phase === "ready" && <div className="battle-actions">
            <button className="sl-btn sl-btn-solid" onClick={() => attack(false)}>ATTACK</button>
            <button className="sl-btn sl-btn-gold" disabled={signatureUsed} onClick={() => attack(true)}>
              <span>{path.battleMove.toUpperCase()}</span>
              <small>{signatureUsed ? "USED" : "ONCE PER BATTLE"}</small>
            </button>
          </div>}
          {phase === "animating" && <div className="battle-wait">RESOLVING TURN...</div>}
          {(phase === "victory" || phase === "defeat") && <div className="space-y-3 mt-3">
            <div className={`battle-result ${phase}`}>{phase === "victory" ? "GATE CONQUERED" : "HUNTER DEFEATED"}</div>
            <button className="sl-btn sl-btn-solid w-full" onClick={finish}>
              {phase === "victory" ? replay ? "FINISH REPLAY" : "CLAIM FIRST-CLEAR REWARDS" : "RETREAT & PREPARE"}
            </button>
          </div>}
        </SystemWindow>
      </div>
    </div>,
    document.body,
  );
}