import { classSkills, getClass } from "../data/classes";
import { STORY_EPISODES } from "../data/story";
import { deriveBattleStats, type BattleStats } from "./battle";
import type { BasicSkill, GameClassId, GameState, StatKey, StoryEpisode } from "../types";

/**
 * Pre-Job Change story logic. Everything here is pure: the store applies patches,
 * components read forecasts, and the tests assert the act stays winnable and
 * affordable at every level.
 */

/** The stat line a hunter holding their own is expected to have at a level. */
export function expectedStatSpread(level: number): [number, number, number] {
  // 10 in each stat at level 1, plus 3 points per level split evenly.
  const perStat = 10 + Math.max(0, level - 1);
  return [perStat, perStat, perStat];
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
 * than hand-tuned per tile, so the whole 40-level act stays in the same band:
 * roughly five turns to kill a field enemy while surviving seven.
 */
export function enemyFor(episode: StoryEpisode): EnemyTemplate {
  const { combat } = expectedCombat(episode.level);
  const expectedHP = combat.maxHP;
  const expectedATK = combat.baseATK;
  const expectedDEF = combat.baseDEF;
  const fieldDef = Math.round(expectedATK * 0.35);
  const fieldHP = Math.round(expectedATK * 2.95);
  const fieldATK = expectedDEF + Math.round(expectedHP / 6.5);
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
  /** Turns for you to kill it, and for it to kill you, playing sensibly. */
  turnsToKill: number;
  turnsToSurvive: number;
  verdict: "favoured" | "even" | "desperate";
  note: string;
}

/**
 * An analytic forecast rather than a simulation: assume a sensible opening
 * (weaken, then guard) and then repeat your best damage move. It exists so the
 * map can tell a hunter whether they are ready before they spend the points.
 */
export function forecastFight(enemy: EnemyTemplate, combat: BattleStats, hasKit: boolean): Forecast {
  const power = hasKit ? 1.28 : 1;
  const buffedATK = combat.atk * (hasKit ? 1.15 : 1);
  const playerDef = hasKit ? combat.def * 1.15 : combat.def;
  const playerDamage = Math.max(1, Math.round(buffedATK - enemy.def) * power);
  const enemyATK = hasKit ? enemy.atk * 0.9 : enemy.atk;
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
        : "It outlasts you on a straight trade. Prepare first.",
  };
}

export type EpisodeStatus = "cleared" | "locked" | "unaffordable" | "needs-path" | "ready";

export interface EpisodeAvailability {
  status: EpisodeStatus;
  reason: string;
  enemy: EnemyTemplate;
  forecast: Forecast;
}

interface StoryState {
  level: number;
  pts: number;
  storyCleared: number[];
  gameClass: GameClassId | null;
  basicSkills: string[];
  monarchPath: GameState["monarchPath"];
  str: number;
  agi: number;
  vit: number;
  fatigueLevel: number;
}

export function episodeAvailability(state: StoryState, episode: StoryEpisode): EpisodeAvailability {
  const combat = deriveBattleStats(state);
  const enemy = enemyFor(episode);
  const hasKit = state.basicSkills.length > 0;
  const forecast = forecastFight(enemy, combat, hasKit);
  const cleared = state.storyCleared.includes(episode.level);
  if (cleared) return { status: "cleared", reason: "Cleared. Replaying costs nothing and pays nothing.", enemy, forecast };
  if (state.level < episode.level) return { status: "locked", reason: `Unlocks at hunter level ${episode.level}.`, enemy, forecast };
  if (episode.kind === "job" && !state.monarchPath) return { status: "needs-path", reason: "Report to the Association for the Job Change ceremony first.", enemy, forecast };
  if (state.pts < episode.cost) return { status: "unaffordable", reason: `Costs ${episode.cost} unspent stat points (you have ${state.pts}).`, enemy, forecast };
  return { status: "ready", reason: `Costs ${episode.cost} stat point${episode.cost === 1 ? "" : "s"}.`, enemy, forecast };
}

/** The tile the hunter is standing on: the lowest uncleared level they have reached. */
export function currentEpisode(state: Pick<StoryState, "storyCleared">): StoryEpisode {
  const target = STORY_EPISODES.find((episode) => !state.storyCleared.includes(episode.level));
  return target ?? STORY_EPISODES[STORY_EPISODES.length - 1];
}

export function storyTotals(cleared: number[]): { pointsSpent: number; clears: number; gold: number } {
  const episodes = STORY_EPISODES.filter((episode) => cleared.includes(episode.level));
  return {
    pointsSpent: episodes.reduce((total, episode) => total + episode.cost, 0),
    clears: episodes.length,
    gold: episodes.reduce((total, episode) => total + episode.gold, 0),
  };
}

/* ── Class skill tree ── */
export function isSkillLearned(state: Pick<GameState, "basicSkills">, skill: BasicSkill): boolean {
  return state.basicSkills.includes(skill.id) || skill.starter === true;
}

export function skillLockReason(
  state: Pick<GameState, "basicSkills" | "pts" | "level">,
  skill: BasicSkill,
): string | null {
  if (skill.starter) return "Granted with your class.";
  if (isSkillLearned(state, skill)) return "Already learned.";
  if (state.level < skill.level) return `Unlocks at level ${skill.level}.`;
  if (state.pts < skill.cost) return `Needs ${skill.cost} unspent stat points (you have ${state.pts}).`;
  return null;
}

export function canLearnSkill(state: Pick<GameState, "basicSkills" | "pts" | "level">, skill: BasicSkill): boolean {
  return skillLockReason(state, skill) === null;
}

export function spendSkillPoints(
  state: Pick<GameState, "basicSkills" | "pts" | "level" | "gameClass">,
  id: string,
): { basicSkills: string[]; pts: number } | null {
  const skill = classSkills(state.gameClass).find((entry) => entry.id === id);
  if (!skill || !canLearnSkill(state, skill)) return null;
  return { basicSkills: [...state.basicSkills, skill.id], pts: state.pts - skill.cost };
}

/** First unlearned node in the class tree, for story rewards that grant skills. */
export function nextSkillReward(state: Pick<GameState, "gameClass" | "basicSkills">): BasicSkill | null {
  return classSkills(state.gameClass).find((skill) => !skill.starter && !state.basicSkills.includes(skill.id)) ?? null;
}

/**
 * The economy guarantee the brief asks for: every class must be able to own its
 * entire kit by level 30, out of the 3 points a level pays.
 */
export function kitGuarantee(id: GameClassId): { cost: number; levelCap: number; pointsByLevel30: number; affordable: boolean } {
  const kit = classSkills(id);
  const cost = kit.reduce((total, skill) => total + (skill.starter ? 0 : skill.cost), 0);
  const levelCap = kit.reduce((highest, skill) => Math.max(highest, skill.level), 1);
  const pointsByLevel30 = 3 * 29;
  return { cost, levelCap, pointsByLevel30, affordable: cost <= pointsByLevel30 && levelCap <= 30 };
}

/** Act I's point cost, so the act and the class kit can be checked against income. */
export function actOneCost(cleared: number[] = []): number {
  const through30 = STORY_EPISODES.filter((episode) => episode.level <= 30 && !cleared.includes(episode.level));
  return through30.reduce((total, episode) => total + episode.cost, 0);
}

/** Stat keys a class leans on, for the tree's header. */
export function classStatKeys(id: GameClassId | null): [StatKey, StatKey] {
  return getClass(id)?.stats ?? ["str", "vit"];
}
