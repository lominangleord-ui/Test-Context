import { getPath, PATH_TIERS } from "../data/monarchPaths";
import type { GameState, MonarchPath, MoveLike, MoveRole, PathMove } from "../types";

/**
 * Gate battles use a drafted moveset instead of the old single signature move.
 * Clearing a trial only unlocks the *option* to learn its move; the move itself
 * costs skill points (SP), the quest currency — stat points buy only STR/AGI/VIT.
 */

/** Everyone owns this from the first Gate. Free, never learned, always shown. */
export const BASIC_MOVE: PathMove = {
  id: "strike",
  tier: 1,
  role: "basic",
  name: "Strike",
  power: 1,
  cost: 0,
  requiresTrial: null,
};

export const MOVE_ROLE_COLOR: Record<MoveRole, string> = {
  basic: "#8ba8c4",
  opener: "#38d98a",
  weaken: "#9b59f7",
  empower: "#ffaa00",
  drain: "#1e9bff",
  heal: "#2fe08a",
  finisher: "#ff8a5b",
  ultimate: "#cc1a30",
};

export const MOVE_ROLE_LABEL: Record<MoveRole, string> = {
  basic: "BASIC",
  opener: "OPENER",
  weaken: "WEAKEN",
  empower: "EMPOWER",
  drain: "DRAIN",
  heal: "HEAL",
  finisher: "FINISHER",
  ultimate: "ULTIMATE",
};

/** Legend order matches the drafted tiers, so the grid reads top-to-bottom. */
export const MOVE_ROLES: MoveRole[] = ["opener", "weaken", "empower", "drain", "ultimate"];

/** The class name shows through Tiers 1–4; the Monarch title is earned at Tier 5. */
export function pathDisplayName(path: MonarchPath | null, level: number): string {
  if (!path) return "";
  return level >= PATH_TIERS[4].min ? path.monarchTitle : path.jobClass;
}

/** Only your own path's moves exist for you; other lineages' moves are never listed. */
export function pathMoves(path: MonarchPath | null): PathMove[] {
  return path ? [BASIC_MOVE, ...path.moves] : [BASIC_MOVE];
}

export function findMove(path: MonarchPath | null, id: string): PathMove | undefined {
  return pathMoves(path).find((move) => move.id === id);
}

export function isMoveLearned(state: Pick<GameState, "learnedMoves">, move: PathMove): boolean {
  return move.role === "basic" || state.learnedMoves.includes(move.id);
}

/** Why a move is not learnable yet — drives both the lock tooltip and the button. */
export function moveUnlockReason(
  state: Pick<GameState, "clearedGates" | "learnedMoves" | "str" | "agi" | "vit" | "sp">,
  move: PathMove,
): string | null {
  if (move.role === "basic") return "Always available.";
  if (isMoveLearned(state, move)) return "Already learned.";
  if (move.requiresTrial !== null && !state.clearedGates.includes(move.requiresTrial)) {
    return `Clear the Tier ${move.requiresTrial} Gate to unlock ${move.name}.`;
  }
  if (move.requiresStat && state[move.requiresStat.stat] < move.requiresStat.amount) {
    return `Needs ${move.requiresStat.amount} ${move.requiresStat.stat.toUpperCase()} (you have ${state[move.requiresStat.stat]}).`;
  }
  if (state.sp < move.cost) return `Needs ${move.cost} skill points (you have ${state.sp}).`;
  return null;
}

export function canLearnMove(
  state: Pick<GameState, "clearedGates" | "learnedMoves" | "str" | "agi" | "vit" | "sp">,
  move: PathMove,
): boolean {
  return move.role !== "basic" && moveUnlockReason(state, move) === null;
}

/** Pure spend: the caller applies the returned patch. Never auto-grants. */
export function spendMovePoints(
  state: Pick<GameState, "clearedGates" | "learnedMoves" | "str" | "agi" | "vit" | "sp" | "monarchPath">,
  id: string,
): { learnedMoves: string[]; sp: number; isUltimate: boolean } | null {
  const move = findMove(getPath(state.monarchPath), id);
  if (!move || !canLearnMove(state, move)) return null;
  return {
    learnedMoves: [...state.learnedMoves, move.id],
    sp: state.sp - move.cost,
    isUltimate: move.role === "ultimate",
  };
}

/** One-line mechanical summary, shared by both skill trees and the battle grid. */
export function moveEffect(move: MoveLike): string {
  const parts: string[] = [];
  const scale = move.scale ?? (move.role === "empower" ? 0.25 : 0.2);
  const percent = Math.round(scale * 100);
  if (move.power > 0) parts.push(`${move.power.toFixed(1)}x ATK`);
  if (move.debuff === "atk") parts.push(`ENEMY ATK -${percent}%`);
  if (move.debuff === "def") parts.push(`ENEMY DEF -${percent}%`);
  if (move.buff) parts.push(`${move.buff === "crit" ? "YOUR CRIT" : `YOUR ${move.buff.toUpperCase()}`} +${percent}%`);
  if (move.drain) parts.push(`HEAL ${Math.round(move.drain * 100)}% OF DAMAGE`);
  if (move.heal) parts.push(`HEAL ${Math.round(move.heal * 100)}% MAX HP`);
  if (move.once) parts.push("ONCE PER FIGHT");
  return parts.join(" · ") || "No direct damage";
}

/** The battle move grid: the free basic attack plus any learned path moves. */
export function buildMoveGrid(path: MonarchPath | null, learned: string[]): { move: PathMove; unlocked: boolean }[] {
  const basic = { move: BASIC_MOVE, unlocked: true };
  if (!path) return [basic];
  return [basic, ...path.moves.map((move) => ({ move, unlocked: learned.includes(move.id) }))];
}

/**
 * Running battle modifiers. Debuffs and buffs last the rest of the fight, so
 * they stack with each other but never stack with themselves (one action per turn).
 */
export interface MoveModifiers {
  bossAtk: number;
  bossDef: number;
  playerAtk: number;
  playerDef: number;
  playerCrit: number;
}

export const NO_MODIFIERS: MoveModifiers = {
  bossAtk: 0,
  bossDef: 0,
  playerAtk: 0,
  playerDef: 0,
  playerCrit: 0,
};

export const WEAKEN_SCALE = 0.2;
export const EMPOWER_SCALE = 0.25;

export function applyMove(mods: MoveModifiers, move: MoveLike): MoveModifiers {
  const next = { ...mods };
  if (move.debuff === "atk") next.bossAtk -= move.scale ?? WEAKEN_SCALE;
  if (move.debuff === "def") next.bossDef -= move.scale ?? WEAKEN_SCALE;
  if (move.buff === "atk") next.playerAtk += move.scale ?? EMPOWER_SCALE;
  if (move.buff === "def") next.playerDef += move.scale ?? EMPOWER_SCALE;
  if (move.buff === "crit") next.playerCrit += move.scale ?? EMPOWER_SCALE;
  return next;
}
