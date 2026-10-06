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

export function signatureDamage(atk: number, def: number) {
  return Math.max(1, atk - def) + Math.round(atk * .4);
}