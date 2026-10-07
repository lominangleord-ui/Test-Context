import { classSkills, getClass } from "../data/classes";
import { STORY_EPISODES } from "../data/story";
import { deriveBattleStats, type BattleStats } from "./battle";
import type { BasicSkill, GameClassId, GameState, StatKey, StoryEpisode } from "../types";

/**
 * Pre-Job Change story logic. Everything here is pure: the store applies patches,
 * components read forecasts, and the tests assert the act stays winnable and
 * affordable at every level.
 */

/** The stat line a hunter holding their own is expected to have at a level.
 *  Auto-growth gives +1 to each stat per level up (so 9/10/11 at level 2 etc).
 *  A hunter who clears dailies and spends about 60% of their earned points on
 *  STR+VIT/AGI sits roughly where `expectedStatSpread` models them.
 */
export function expectedStatSpread(level: number): [number, number, number] {
  const base = 10 + Math.max(0, level - 1); // auto +1/level
  const spend = Math.max(0, level - 1) * 3; // ~3 pts/level spent into combat stats
  return [base + Math.round(spend * 0.5), base + Math.round(spend * 0.2), base + Math.round(spend * 0.3)];
}

/** The same spread run through the real battle math, at zero fatigue. */
export function expectedCombat(level: number): { combat: BattleStats; spread: [number, number, number] } {
  const spread = expectedStatSpread(level);
  return { combat: deriveBattleStats({ str: spread[0], agi: spread[1], vit: spread[2], fatigueLevel: 0 }), spread };
}

export interface EnemyTemplate {
  name: string;
  hp: number;
  atk: number;
  def: number;
  /** Bosses telegraph and harden; field enemies mostly just swing. */
  boss: boolean;
  art?: string;
}

/**
 * Enemy stats are derived from the expected hunter at the episode's level rather
 * than hand-tuned per tile. Tuned to the economy where stat points (dailies and
 * level-ups) make the hunter noticeably stronger — an investing hunter wins in
 * about half the turns the enemy needs — while a baseline hunter who only takes
 * auto-growth scrapes through early tiles and must spend eventually.
 */
export function enemyFor(episode: StoryEpisode): EnemyTemplate {
  const { combat } = expectedCombat(episode.level);
  const expectedHP = combat.maxHP;
  const expectedATK = combat.baseATK;
  const expectedDEF = combat.baseDEF;
  // Tuned so an investing hunter wins in ~4 turns and survives ~8 (2:1 ratio),
  // while a fresh 0-pts-spent hunter still survives 5-6 turns at L1 so the first
  // tile is winnable via basic skills alone. Bosses scale 1.3× HP, 1.1× ATK.
  const fieldDef = Math.round(expectedATK * 0.30);
  const fieldHP = Math.round(expectedATK * 2.6);
  const fieldATK = expectedDEF + Math.round(expectedHP / 8.5);
  return {
    name: episode.enemy,
    hp: Math.round(fieldHP * episode.hpScale),
    atk: Math.round(fieldATK * episode.atkScale),
    def: Math.round(fieldDef * episode.defScale),
    boss: episode.kind === "boss" || episode.kind === "job",
    art: episode.enemyArt,
  };
}

export interface Forecast {
  turnsToKill: number;
  turnsToSurvive: number;
  verdict: "favoured" | "even" | "desperate";
  note: string;
}

/**
 * An analytic forecast rather than a simulation.
 */
export function forecastFight(enemy: EnemyTemplate, combat: BattleStats, hasKit: boolean): Forecast {
  const power = hasKit ? 1.25 : 1;
  const buffedATK = combat.atk * (hasKit ? 1.15 : 1);
  const playerDef = hasKit ? combat.def * 1.1 : combat.def;
  const playerDamage = Math.max(1, Math.round(buffedATK - enemy.def) * power);
  const enemyATK = hasKit ? enemy.atk * 0.92 : enemy.atk;
  const enemyDamage = Math.max(1, Math.round(enemyATK - playerDef));
  const turnsToKill = Math.max(1, Math.ceil(enemy.hp / Math.max(1, playerDamage)));
  const turnsToSurvive = Math.max(1, Math.ceil(combat.maxHP / enemyDamage));
  const margin = turnsToSurvive - turnsToKill;
  const verdict = margin >= 3 ? "favoured" : margin >= 1 ? "even" : "desperate";
  return {
    turnsToKill, turnsToSurvive, verdict,
    note: verdict === "favoured"
      ? "You finish this comfortably."
      : verdict === "even"
        ? "Close. Learn and use your whole kit."
        : "It outlasts you on a straight trade. Spend skill points on your kit or stat points on your stats.",
  };
}

export type EpisodeStatus = "cleared" | "locked" | "needs-path" | "ready";

export interface EpisodeAvailability {
  status: EpisodeStatus;
  reason: string;
  enemy: EnemyTemplate;
  forecast: Forecast;
}

interface StoryState {
  level: number;
  sp: number;
  storyCleared: number[];
  gameClass: GameClassId | null;
  basicSkills: string[];
  monarchPath: GameState["monarchPath"];
  str: number;
  agi: number;
  vit: number;
  fatigueLevel: number;
}

/** The previous tile in the map must be cleared to enter a new tile. */
export function prevEpisodeCleared(cleared: number[], level: number): boolean {
  if (level <= 1) return true;
  return cleared.includes(level - 1);
}

export function episodeAvailability(state: StoryState, episode: StoryEpisode): EpisodeAvailability {
  const combat = deriveBattleStats(state);
  const enemy = enemyFor(episode);
  const hasKit = state.basicSkills.length > 0;
  const forecast = forecastFight(enemy, combat, hasKit);
  const cleared = state.storyCleared.includes(episode.level);
  if (cleared) return { status: "cleared", reason: "Cleared. Replay for practice; no extra rewards.", enemy, forecast };
  if (state.level < episode.level) return { status: "locked", reason: `Unlocks at hunter level ${episode.level}.`, enemy, forecast };
  if (!prevEpisodeCleared(state.storyCleared, episode.level)) return { status: "locked", reason: "Clear the previous tile first.", enemy, forecast };
  if (episode.kind === "job" && !state.monarchPath) return { status: "needs-path", reason: "Report to the Association for the Job Change ceremony first.", enemy, forecast };
  return { status: "ready", reason: "Ready to enter.", enemy, forecast };
}

/** The tile the hunter is standing on: the lowest uncleared level they have reached. */
export function currentEpisode(state: Pick<StoryState, "storyCleared">): StoryEpisode {
  const target = STORY_EPISODES.find((episode) => !state.storyCleared.includes(episode.level));
  return target ?? STORY_EPISODES[STORY_EPISODES.length - 1];
}

export function storyTotals(cleared: number[]): { clears: number; gold: number; spEarned: number } {
  const episodes = STORY_EPISODES.filter((episode) => cleared.includes(episode.level));
  return {
    clears: episodes.length,
    gold: episodes.reduce((total, episode) => total + episode.gold, 0),
    spEarned: episodes.reduce((total, ep) => total + (ep.kind === "job" ? 0 : ep.kind === "field" ? 1 : 2), 0),
  };
}

/* ── Class skill tree ── */
export function isSkillLearned(state: Pick<GameState, "basicSkills">, skill: BasicSkill): boolean {
  return state.basicSkills.includes(skill.id) || skill.starter === true;
}

export function skillLockReason(
  state: Pick<GameState, "basicSkills" | "sp" | "level">,
  skill: BasicSkill,
): string | null {
  if (skill.starter) return "Granted with your class.";
  if (isSkillLearned(state, skill)) return "Already learned.";
  if (state.level < skill.level) return `Unlocks at level ${skill.level}.`;
  if (state.sp < skill.cost) return `Needs ${skill.cost} skill points (you have ${state.sp}).`;
  return null;
}

export function canLearnSkill(
  state: Pick<GameState, "basicSkills" | "sp" | "level">,
  skill: BasicSkill,
): boolean {
  return skillLockReason(state, skill) === null;
}

export function spendSkillPoints(
  state: Pick<GameState, "basicSkills" | "sp" | "level" | "gameClass">,
  id: string,
): { basicSkills: string[]; sp: number } | null {
  const skill = classSkills(state.gameClass).find((entry) => entry.id === id);
  if (!skill || !canLearnSkill(state, skill)) return null;
  return { basicSkills: [...state.basicSkills, skill.id], sp: state.sp - skill.cost };
}

/**
 * Economy guarantee: every class can own its entire kit out of SP earned
 * from the tiles available by level 30.
 */
export function kitGuarantee(id: GameClassId): { cost: number; levelCap: number; spByLevel30: number; affordable: boolean } {
  const kit = classSkills(id);
  const cost = kit.reduce((total, skill) => total + (skill.starter ? 0 : skill.cost), 0);
  const levelCap = kit.reduce((highest, skill) => Math.max(highest, skill.level), 1);
  // SP earned by level 30: tiles 1-30 include all beats at 1, 5, 10, 15, 20, 25, 30 (7 beats at 2 SP = 14)
  // plus 23 field tiles at 1 SP = 23, total 37.
  const spByLevel30 = 37;
  return { cost, levelCap, spByLevel30, affordable: cost <= spByLevel30 && levelCap <= 30 };
}

/** SP still obtainable in Act I (40 with nothing cleared). For balancing checks. */
export function actOneSPRemaining(cleared: number[] = []): number {
  return STORY_EPISODES
    .filter((ep) => ep.level <= 40 && !cleared.includes(ep.level))
    .reduce((total, ep) => total + (ep.kind === "job" ? 0 : ep.kind === "field" ? 1 : 2), 0);
}

/** Stat keys a class leans on, for the tree's header. */
export function classStatKeys(id: GameClassId | null): [StatKey, StatKey] {
  return getClass(id)?.stats ?? ["str", "vit"];
}
