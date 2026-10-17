import { classSkills, getClass } from "../data/classes";
import { STORY_EPISODES } from "../data/story";
import { deriveBattleStats, type BattleStats } from "./battle";
import type { BasicSkill, GameClassId, GameState, StatKey, StoryEpisode } from "../types";

/**
 * Pre-Job Change story logic. Everything here is pure: the store applies patches,
 * components read forecasts, and the tests assert the act stays winnable and
 * affordable at every level.
 */

/** The stat line a hunter who trains consistently is expected to have at a level.
 *  Auto-growth gives +1 to each stat per level up. A hunter who clears dailies
 *  earns ~6 stat points a level (level-ups + daily stipend) and spends nearly
 *  all of them on combat stats (45% STR, 35% VIT, 20% AGI). Enemies are tuned to
 *  THIS line — skip the training or bank your points, and the same monster that
 *  a diligent hunter claws past at 50% HP becomes a wall.
 */
export function expectedStatSpread(level: number): [number, number, number] {
  const base = 10 + Math.max(0, level - 1); // auto +1/level
  const spend = Math.max(0, level - 1) * 6; // ~6 pts/level earned from training, spent
  return [base + Math.round(spend * 0.45), base + Math.round(spend * 0.2), base + Math.round(spend * 0.35)];
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
 * Enemy stats derive from the expected hunter at the tile's level — the hunter
 * who trains every day AND spends their points — and bosses are then pushed
 * past that line, per act band. The design targets, verified by sim:
 *  - field tiles: a real fight; the trained hunter wins having lost most of
 *    their HP (margin grows from a coin-flip at L2 to comfort by L20 as they
 *    actually get strong);
 *  - boss/beat tiles: always stronger on paper. Trained+allocated hunters win
 *    on a knife's edge and lean on their kit and potions; an unallocated or
 *    untrained hunter is outmatched and must go earn the difference IRL;
 *  - L1 tutorial: unspent stats = a loss; spending the 3 awakening points on
 *    STR/VIT turns it into a scraped-past win. The System grades, the gym fixes.
 */
/** Kit progression the tuning assumes: one class node learned roughly every
 *  four levels, all eight owned by 30 (the SP economy forces this pace).
 */
export function expectedKitAt(level: number): number {
  return Math.min(8, 1 + Math.floor(Math.max(0, level - 1) / 4.2));
}

export function enemyFor(episode: StoryEpisode): EnemyTemplate {
  const { combat } = expectedCombat(episode.level);
  const expectedHP = combat.maxHP;
  const expectedATK = combat.baseATK;
  const expectedDEF = combat.baseDEF;
  const band = episode.level <= 10 ? 0 : episode.level <= 29 ? 1 : 2;
  const boss = episode.kind === "boss" || episode.kind === "job";
  const story = episode.kind === "story";
  // The expected hunter arrives with a growing kit. Enemy lines absorb that
  // growth (normalized to a level-1 novice's starter skill) so a tile stays
  // the fight it was designed to be: a hunter LEARNING FASTER than the model
  // wins with more to spare, one dragging behind eats the difference.
  const t = expectedKitAt(episode.level) / 8;
  const t0 = 1 / 8;
  const kitDmg = ((1 + 0.15 * t) * (1 + 0.25 * t)) / ((1 + 0.15 * t0) * (1 + 0.25 * t0));
  const kitTank = ((1 + 0.1 * t) / (1 - 0.08 * t)) / ((1 + 0.1 * t0) / (1 - 0.08 * t0));
  // Base line = the model hunter's own numbers: ~5 hits to put down, and it
  // answers with roughly a sixth of their HP per swing. The field divisor is
  // gentler in the first ten levels — a novice should edge fights, not draw them.
  const hpMult = boss ? [1.12, 1.22, 1.28][band] : story ? [1.06, 1.16, 1.24][band] : 1;
  const atkDiv = boss ? [5.5, 5.15, 5.0][band] : story ? [5.6, 5.3, 5.15][band] : [5.9, 5.7, 5.6][band];
  const defMult = boss || story ? 1.12 : 1;
  return {
    name: episode.enemy,
    hp: Math.round(expectedATK * 4.8 * hpMult * kitDmg),
    atk: expectedDEF + Math.round(expectedHP * kitTank / atkDiv),
    def: Math.round(expectedATK * 0.15 * defMult),
    boss,
    art: episode.enemyArt,
  };
}

export interface Forecast {
  turnsToKill: number;
  turnsToSurvive: number;
  /** What the enemy lands on the hunter per turn in this forecast. */
  enemyDamage: number;
  verdict: "favoured" | "even" | "desperate";
  note: string;
}

/**
 * An analytic forecast rather than a simulation. The kit bonus scales with how
 * many nodes the hunter has actually learned: one starter skill does not hit
 * like a full eight-node tree, and the System says so.
 */
export function forecastFight(enemy: EnemyTemplate, combat: BattleStats, kitCount: number): Forecast {
  const t = Math.min(8, Math.max(0, kitCount)) / 8;
  const power = 1 + 0.25 * t;
  const buffedATK = combat.atk * (1 + 0.15 * t);
  const playerDef = combat.def * (1 + 0.1 * t);
  const playerDamage = Math.max(1, Math.round(buffedATK - enemy.def) * power);
  const enemyATK = enemy.atk * (1 - 0.08 * t);
  const enemyDamage = Math.max(1, Math.round(enemyATK - playerDef));
  const turnsToKill = Math.max(1, Math.ceil(enemy.hp / Math.max(1, playerDamage)));
  const turnsToSurvive = Math.max(1, Math.ceil(combat.maxHP / enemyDamage));
  const margin = turnsToSurvive - turnsToKill;
  const verdict = margin >= 3 ? "favoured" : margin >= 1 ? "even" : "desperate";
  return {
    turnsToKill, turnsToSurvive, enemyDamage, verdict,
    note: verdict === "favoured"
      ? "You outmatch it. Save the potion."
      : verdict === "even"
        ? "Close. Train hard, spend your points, use the whole kit."
        : "It is stronger than you. Go work out, allocate stat points, learn skills — then come back.",
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
  const forecast = forecastFight(enemy, combat, state.basicSkills.length);
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
