import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useUi } from "../store/ui";
import { useGame } from "../store/game";
import { getEpisode, STORY_NPCS } from "../data/story";
import { classSkills } from "../data/classes";
import { BOSS_MOVES, chooseBossMove, deriveBattleStats, HARDEN_DEF_BONUS, moveDamage, rollAttackDamage, type BossMoveId } from "../lib/battle";
import { applyMove, MOVE_ROLE_COLOR, MOVE_ROLE_LABEL, moveEffect, NO_MODIFIERS, type MoveModifiers } from "../lib/moves";
import { enemyFor } from "../lib/story";
import { SystemWindow } from "./SystemWindow";
import { BattleStage, type Anim, type StageMove, NO_ANIM } from "./BattleStage";
import { audio } from "../lib/audio";
import { shake, flash, fctAt } from "../lib/juice";
import type { BasicSkill } from "../types";

const LINE_MS = 1050;

/**
 * Story encounter: one tile of the act, fought with the class kit the hunter
 * built from stat points. Same engine, same maths and same presentation as the
 * Gate battles, but the enemy comes from the map instead of the path.
 */
export function StoryBattle() {
  const level = useUi((s) => s.activeStoryLevel);
  const close = useUi((s) => s.closeStoryBattle);
  const state = useGame(useShallow((game) => ({
    name: game.name,
    level: game.level,
    str: game.str,
    agi: game.agi,
    vit: game.vit,
    fatigueLevel: game.fatigueLevel,
    gameClass: game.gameClass,
    basicSkills: game.basicSkills,
    storyCleared: game.storyCleared,
    clearEpisode: game.clearEpisode,
    fastMode: game.settings.fastMode,
  })));
  const episode = level ? getEpisode(level) : null;
  const enemy = useMemo(() => (episode ? enemyFor(episode) : null), [level]);
  const stats = useMemo(() => deriveBattleStats(state), [state.str, state.agi, state.vit, state.fatigueLevel]);
  const npc = episode?.npc ? STORY_NPCS[episode.npc] : null;
  const replay = episode ? state.storyCleared.includes(episode.level) : false;

  const kit = useMemo<BasicSkill[]>(() => [...classSkills(state.gameClass)], [state.gameClass]);

  const [playerHP, setPlayerHP] = useState(stats.maxHP);
  const [enemyHP, setEnemyHP] = useState<number>(enemy?.hp ?? 1);
  const [mods, setMods] = useState<MoveModifiers>(NO_MODIFIERS);
  const [usedOnce, setUsedOnce] = useState<string[]>([]);
  const [usedBossMoves, setUsedBossMoves] = useState<BossMoveId[]>([]);
  const [lastBossMove, setLastBossMove] = useState<BossMoveId | null>(null);
  const [telegraphed, setTelegraphed] = useState(false);
  const [phase, setPhase] = useState<"busy" | "menu" | "victory" | "defeat">("busy");
  const [ending, setEnding] = useState<"victory" | "defeat" | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [anim, setAnim] = useState<Anim>(NO_ANIM);
  const [messages, setMessages] = useState<string[]>(() => [
    `【 ${episode?.title.toUpperCase() ?? "ENCOUNTER"} 】`,
    episode?.briefing ?? "",
    npc ? `${npc.name}: "${npc.line}"` : `${enemy?.name} blocks the way. You act first.`,
  ]);

  const hunterRef = useRef<HTMLDivElement>(null);
  const enemyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<Set<number>>(new Set());
  const enemyHPRef = useRef<number>(enemy?.hp ?? 1);
  const playerHPRef = useRef(stats.maxHP);
  const onceRef = useRef<string[]>([]);

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

  if (!episode || !enemy) return null;

  const learnedKit = kit.filter((skill) => skill.starter || state.basicSkills.includes(skill.id));
  const enemyAtkEffective = () => Math.round(enemy.atk * (1 + mods.bossAtk));
  const enemyDefEffective = () => Math.round(enemy.def * (1 + mods.bossDef));
  const playerAtkEffective = () => Math.round(stats.atk * (1 + mods.playerAtk));
  const playerDefEffective = () => Math.round(stats.def * (1 + mods.playerDef));
  const critEffective = () => Math.min(100, stats.critChance * (1 + mods.playerCrit));

  const beginTurn = (lines: string[]) => {
    setMessages(lines);
    setMessageIndex(0);
    setPhase("busy");
  };

  const advance = () => {
    if (phase !== "busy") return;
    if (messageIndex < messages.length - 1) {
      setMessageIndex((index) => index + 1);
      return;
    }
    if (ending) setPhase(ending);
    else setPhase("menu");
  };

  const playMove = (id: string) => {
    if (phase !== "menu") return;
    const move = learnedKit.find((skill) => skill.id === id);
    if (!move) return;
    const lines: string[] = [`You use ${move.name.toUpperCase()}!`];
    const nextMods = applyMove(mods, move);
    if (move.once) {
      onceRef.current = [...onceRef.current, move.id];
      setUsedOnce(onceRef.current);
    }
    // Healing is self-only, so it cannot end the fight and still lets the enemy act.
    if (move.heal) {
      const healed = Math.min(stats.maxHP - playerHPRef.current, Math.round(stats.maxHP * move.heal));
      playerHPRef.current += healed;
      setPlayerHP(playerHPRef.current);
      lines.push(`You recover ${healed} HP.`);
      audio.empowerRise();
      if (healed > 0) fctAt(hunterRef.current, `+${healed}`, "heal");
      setMods(nextMods);
      return actAfter(lines);
    }
    if (move.power > 0) {
      const { damage, critical } = moveDamage(move.power, playerAtkEffective(), enemyDefEffective(), critEffective());
      const remaining = Math.max(0, enemyHPRef.current - damage);
      enemyHPRef.current = remaining;
      setEnemyHP(remaining);
      pulse({ hunterLunge: true }, 320);
      pulse({ bossHit: true }, 480);
      if (move.role === "finisher") { audio.ultimateImpact(); flash(episode.enemyArt ? "#ff8a5b" : "var(--path-color)", 0.24); }
      else if (move.role === "weaken") audio.weakenBlip();
      else if (move.role === "drain") audio.drainWhoosh();
      else audio.hitThud();
      shake(move.role === "finisher" || critical ? "lg" : "sm");
      fctAt(enemyRef.current, critical ? `${damage} CRIT` : damage, critical ? "crit" : "dmg");
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
        lines.push(replay ? "Cleared again. The tile pays nothing a second time." : "The tile is cleared.");
        setEnding("victory");
        beginTurn(lines);
        schedule(() => { audio.questComplete(); fctAt(enemyRef.current, "CLEARED", "crit"); }, 420);
        return;
      }
    } else if (move.buff) {
      audio.empowerRise();
      pulse({ hunterLunge: true }, 320);
      lines.push(move.buff === "crit"
        ? "Your focus sharpens for the rest of the fight."
        : `Your ${move.buff.toUpperCase()} rises for the rest of the fight.`);
    } else if (move.debuff) {
      audio.weakenBlip();
      pulse({ bossHit: true }, 480);
      lines.push(`Its ${move.debuff.toUpperCase()} falls for the rest of the fight.`);
    }
    setMods(nextMods);
    actAfter(lines);
  };

  /** The enemy's answer. Field enemies swing; bosses telegraph, harden and hit harder. */
  const actAfter = (lines: string[]) => {
    schedule(() => {
      const enemyLines: string[] = [];
      if (telegraphed) {
        const { damage } = rollAttackDamage(enemyAtkEffective(), playerDefEffective(), 0);
        setTelegraphed(false);
        setLastBossMove("wrath");
        enemyLines.push(`${BOSS_MOVES.wrath.name.toUpperCase()} lands.`, `It deals ${damage} damage.`);
        audio.ultimateImpact();
        pulse({ bossLunge: true, hunterHit: true }, 520);
        shake("lg"); flash("#ff3b52", 0.3);
        fctAt(hunterRef.current, damage, "dmg");
        playerHPRef.current = Math.max(0, playerHPRef.current - damage);
        setPlayerHP(playerHPRef.current);
      } else if (enemy.boss) {
        const chosen = chooseBossMove(enemyHPRef.current, enemy.hp, usedBossMoves, lastBossMove);
        if (chosen.id === "harden") {
          setUsedBossMoves((used) => [...used, "harden"]);
          setMods((current) => ({ ...current, bossDef: current.bossDef + HARDEN_DEF_BONUS }));
          setLastBossMove("harden");
          enemyLines.push("It HARDENS. Its defense rises for the rest of the fight.");
          audio.hardenClink();
          pulse({ bossGuard: true }, 560);
        } else if (chosen.id === "wrath") {
          setTelegraphed(true);
          setLastBossMove("wrath");
          enemyLines.push(`${enemy.name} is gathering power...`);
          audio.telegraph();
        } else {
          const { damage } = rollAttackDamage(enemyAtkEffective(), playerDefEffective(), 0);
          setLastBossMove("claw");
          enemyLines.push(`It strikes back.`, `It deals ${damage} damage.`);
          audio.error();
          pulse({ bossLunge: true, hunterHit: true }, 460);
          shake("sm"); flash("#ff3b52", 0.2);
          fctAt(hunterRef.current, damage, "dmg");
          playerHPRef.current = Math.max(0, playerHPRef.current - damage);
          setPlayerHP(playerHPRef.current);
        }
      } else {
        const { damage } = rollAttackDamage(enemyAtkEffective(), playerDefEffective(), 0);
        enemyLines.push(`It strikes back.`, `It deals ${damage} damage.`);
        audio.error();
        pulse({ bossLunge: true, hunterHit: true }, 460);
        shake("sm");
        fctAt(hunterRef.current, damage, "dmg");
        playerHPRef.current = Math.max(0, playerHPRef.current - damage);
        setPlayerHP(playerHPRef.current);
      }
      if (playerHPRef.current <= 0) {
        enemyLines.push(
          "DEFEAT. You retreat with nothing lost but the attempt.",
          "SYSTEM: It was stronger than you — that is the point. Clear a workout, spend your STAT points, buy a node in the ✦ Skill Tree. Then come back.",
        );
        setEnding("defeat");
        beginTurn([...lines, ...enemyLines]);
        return;
      }
      beginTurn([...lines, ...enemyLines]);
    }, LINE_MS);
  };

  const finish = () => {
    if (phase === "victory" && !replay) state.clearEpisode(episode.level);
    close();
  };

  const moveEntries: StageMove[] = learnedKit.map((skill) => ({
    move: skill,
    unlocked: true,
    spent: skill.once ? usedOnce.includes(skill.id) : false,
    effect: moveEffect(skill),
    tagLabel: MOVE_ROLE_LABEL[skill.role],
    tagColor: MOVE_ROLE_COLOR[skill.role],
    lockReason: skill.once && usedOnce.includes(skill.id) ? "Already used this fight." : `${skill.name} — ${moveEffect(skill)}`,
  }));

  return createPortal(
    <div className="fixed inset-0 z-[86] sys-backdrop gate-battle-overlay flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${episode.title} story battle`} style={{ ["--path-color" as string]: "#1e9bff" }}>
      <div className="camera-shell max-w-[680px] relative">
        <header className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-head text-[16px] font-bold tracking-wider uppercase" style={{ color: "var(--cyan-bright)" }}>
              LEVEL {episode.level} · {episode.title}
            </div>
            <div className="font-mono text-[9px] text-[color:var(--text-dim)] mt-1">
              {replay ? "REPLAY / NO REPEAT REWARDS" : `${episode.kind.toUpperCase()} ENCOUNTER · REQ LV ${episode.level}${episode.level > 1 ? " · PREV TILE" : ""} · +${episode.kind === "job" ? "JOB CHANGE" : episode.kind === "field" ? "1 SP" : "2 SP"}`}
            </div>
          </div>
          {phase === "menu" && <button className="sl-btn sl-btn-danger px-3 text-[10px]" onClick={close}>RETREAT</button>}
        </header>

        <SystemWindow title={episode.enemy.toUpperCase()} accent="#1e9bff">
          <div className="battle-readiness" style={{ borderColor: stats.readiness.color }}>
            <div>
              <div className="font-sys text-[10px] tracking-wider" style={{ color: stats.readiness.color }}>
                {stats.readiness.name.toUpperCase()} / FATIGUE {Math.round(state.fatigueLevel)}%
              </div>
              <div className="text-[11px] text-[color:var(--text)] mt-1">{episode.prose}</div>
            </div>
            {stats.readiness.id !== "peak" && <span className="font-mono text-[9px] text-[color:var(--gold)]">RECOVERY RECOMMENDED</span>}
          </div>

          <BattleStage
            accent="#1e9bff"
            enemyName={episode.enemy.toUpperCase()}
            enemySubtitle={episode.kind.toUpperCase()}
            enemyHP={enemyHP}
            enemyMaxHP={enemy.hp}
            enemyStats={{ atk: enemyAtkEffective(), def: enemyDefEffective() }}
            enemyArt={enemy.boss ? enemy.art : undefined}
            playerName={state.name.toUpperCase()}
            playerHP={playerHP}
            playerMaxHP={stats.maxHP}
            playerStats={{ atk: playerAtkEffective(), def: playerDefEffective(), crit: Math.round(critEffective()) }}
            anim={anim}
            enemyRef={enemyRef}
            hunterRef={hunterRef}
            phase={phase}
            message={messages[Math.min(messageIndex, messages.length - 1)] ?? ""}
            onAdvance={advance}
            moves={moveEntries}
            onMove={playMove}
            legend={learnedKit.map((skill) => ({ label: MOVE_ROLE_LABEL[skill.role], color: MOVE_ROLE_COLOR[skill.role] }))}
            onFinish={phase === "victory" || phase === "defeat" ? finish : undefined}
            finishLabel={phase === "victory" ? replay ? "FINISH REPLAY" : "CLAIM THE TILE" : "RETREAT & PREPARE"}
          >
            {phase === "victory" && (
              <div className="story-reward">
                {replay ? (
                  <p className="font-mono text-[10px] text-[color:var(--text-dim)]">
                    Rewards were banked on the first clear. Replays exist to see the fight again.
                  </p>
                ) : (
                  <>
                    <div className="font-sys text-[10px] tracking-[0.2em] text-[color:var(--green)]">FIRST CLEAR</div>
                    <p className="text-[12px] text-[color:var(--text-bright)] mt-1">
                      +{episode.gold} gold · +{episode.kind === "job" ? "Job Change ceremony" : `${episode.kind === "field" ? 1 : 2} skill point${episode.kind === "field" ? "" : "s"}`}
                    </p>
                    <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mt-1">{episode.rewardNote}</p>
                  </>
                )}
              </div>
            )}
          </BattleStage>
        </SystemWindow>
      </div>
    </div>,
    document.body,
  );
}
