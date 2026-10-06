export type ReadinessId = "peak" | "steady" | "strained" | "exhausted" | "depleted";

export interface BattleReadiness {
  id: ReadinessId;
  name: string;
  color: string;
  description: string;
  hpMultiplier: number;
  atkMultiplier: number;
  defMultiplier: number;
  critPenalty: number;
}

export interface BattleStats {
  maxHP: number;
  atk: number;
  def: number;
  critChance: number;
  baseHP: number;
  baseATK: number;
  baseDEF: number;
  baseCritChance: number;
  readiness: BattleReadiness;
}

const READINESS: readonly BattleReadiness[] = [
  { id: "peak", name: "Peak Condition", color: "#2fe08a", description: "No fatigue penalty.", hpMultiplier: 1, atkMultiplier: 1, defMultiplier: 1, critPenalty: 0 },
  { id: "steady", name: "Steady", color: "#7fd0ff", description: "A minor 5% attack penalty.", hpMultiplier: 1, atkMultiplier: .95, defMultiplier: 1, critPenalty: 0 },
  { id: "strained", name: "Strained", color: "#ffc53d", description: "Reduced battle HP, attack, defense and critical focus.", hpMultiplier: .9, atkMultiplier: .85, defMultiplier: .9, critPenalty: 5 },
  { id: "exhausted", name: "Exhausted", color: "#ff8a5b", description: "Major stat penalties. Recover before challenging a high-tier Gate.", hpMultiplier: .75, atkMultiplier: .7, defMultiplier: .78, critPenalty: 10 },
  { id: "depleted", name: "Depleted", color: "#ff3b52", description: "Severe penalties. The Gate remains available, but retreat is advised.", hpMultiplier: .58, atkMultiplier: .55, defMultiplier: .62, critPenalty: 15 },
];

export function readinessFromFatigue(fatigue: number): BattleReadiness {
  if (fatigue <= 15) return READINESS[0];
  if (fatigue <= 35) return READINESS[1];
  if (fatigue <= 60) return READINESS[2];
  if (fatigue <= 80) return READINESS[3];
  return READINESS[4];
}

export function deriveBattleStats(stats: { str: number; agi: number; vit: number; fatigueLevel: number }): BattleStats {
  const readiness = readinessFromFatigue(Math.max(0, Math.min(100, stats.fatigueLevel)));
  const baseHP = 50 + stats.vit * 5;
  const baseATK = 10 + stats.str * 2;
  const baseDEF = 5 + Math.round(stats.vit * 1.5);
  const baseCritChance = Math.min(40, 5 + stats.agi * .5);
  return {
    baseHP,
    baseATK,
    baseDEF,
    baseCritChance,
    maxHP: Math.max(1, Math.round(baseHP * readiness.hpMultiplier)),
    atk: Math.max(1, Math.round(baseATK * readiness.atkMultiplier)),
    def: Math.max(0, Math.round(baseDEF * readiness.defMultiplier)),
    critChance: Math.max(0, baseCritChance - readiness.critPenalty),
    readiness,
  };
}

export function rollAttackDamage(
  atk: number,
  def: number,
  critChance: number,
  random = Math.random,
) {
  const base = Math.max(1, atk - def);
  const varied = Math.max(1, Math.round(base * (.85 + random() * .3)));
  const critical = random() * 100 < critChance;
  return { damage: critical ? Math.max(1, Math.round(varied * 1.5)) : varied, critical };
}

/** A drafted move: power scales your ATK before defence is subtracted. */
export function moveDamage(
  power: number,
  atk: number,
  def: number,
  critChance: number,
  random = Math.random,
) {
  if (power <= 0) return { damage: 0, critical: false };
  const base = Math.max(1, Math.round(atk) - def);
  const varied = Math.max(1, Math.round(base * (.85 + random() * .3)));
  const critical = random() * 100 < critChance;
  const scaled = Math.max(1, Math.round(varied * power));
  return { damage: critical ? Math.max(1, Math.round(scaled * 1.5)) : scaled, critical };
}

/** Damage a move dealt, in abstract terms, for the floating combat text. */
export function signatureDamage(atk: number, def: number) {
  return Math.max(1, atk - def) + Math.round(atk * .4);
}

/* ── Boss movesets: shared by tier, so only the numbers scale ── */
export type BossMoveId = "claw" | "wrath" | "harden";

export interface BossMove {
  id: BossMoveId;
  name: string;
  power: number;
  /** Announces itself one turn before it lands. */
  telegraph: boolean;
  description: string;
}

export const BOSS_MOVES: Record<BossMoveId, BossMove> = {
  claw: { id: "claw", name: "Claw Swipe", power: 1, telegraph: false, description: "A straightforward strike." },
  wrath: { id: "wrath", name: "Guardian's Wrath", power: 1.6, telegraph: true, description: "Heavy, and it warns you first." },
  harden: { id: "harden", name: "Harden", power: 0, telegraph: false, description: "Raises its guard once, below half health." },
};

/** Harden is a one-off, mid-fight, DEF buff the player has to punch through. */
export const HARDEN_DEF_BONUS = 0.2;

export function chooseBossMove(
  hp: number,
  maxHP: number,
  used: readonly BossMoveId[],
  last: BossMoveId | null,
  random = Math.random,
): BossMove {
  if (!used.includes("harden") && hp <= maxHP * 0.5) return BOSS_MOVES.harden;
  // Never telegraph two turns in a row: the warning must be readable.
  if (last !== "wrath" && random() < 0.45) return BOSS_MOVES.wrath;
  return BOSS_MOVES.claw;
}