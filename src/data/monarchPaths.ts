import type { GameClassId, MonarchPath, PathId, PathSkill, TierNumber } from "../types";

/*
 * The four Monarch lineages — one per starting class. When the Job Change
 * ceremony hits at level 40, your class hardens into one Monarch lineage
 * instead of offering a separate pick. That keeps "Fighter → Shadow Monarch"
 * and the rest of Sung Jinwoo's canonical feel, and collapses the old nine
 * paths down to four options balanced by the same move roles.
 *
 * Tier floors remain the public rank curve:
 *   Tier 1 (Nascent)     B-Rank  · levels 40-54
 *   Tier 2 (Ascendant)   A-Rank  · levels 55-74
 *   Tier 3 (Dominion)    S-Rank  · levels 75-99
 *   Tier 4 (Sovereign)   National · levels 100-119
 *   Tier 5 (Transcendent) Monarch · levels 120+
 */

export const PATH_TIERS = [
  { number: 1, name: "Nascent", min: 40, max: 54, multiplier: 1.5 },
  { number: 2, name: "Ascendant", min: 55, max: 74, multiplier: 1.75 },
  { number: 3, name: "Dominion", min: 75, max: 99, multiplier: 2 },
  { number: 4, name: "Sovereign", min: 100, max: 119, multiplier: 2.5 },
  { number: 5, name: "Transcendent", min: 120, max: Infinity, multiplier: 3 },
] as const;

export const GATE_BOSS_STATS = {
  nascent:      { hp: 300, atk: 92, def: 50 },
  ascendant:    { hp: 500, atk: 128, def: 78 },
  dominion:     { hp: 720, atk: 166, def: 108 },
  sovereign:    { hp: 920, atk: 212, def: 142 },
  transcendent: { hp: 1180, atk: 278, def: 188 },
} as const;

export const TIER_TO_KEY: Record<number, keyof typeof GATE_BOSS_STATS> = {
  1: "nascent",
  2: "ascendant",
  3: "dominion",
  4: "sovereign",
  5: "transcendent",
};

/** Each starting class maps directly to one Monarch lineage. */
export const CLASS_TO_PATH: Record<GameClassId, PathId> = {
  fighter: "shadows",
  mage: "destruction",
  assassin: "fangs",
  ranger: "frost",
};

/**
 * The four Monarch lineages. Role spread is identical across all four, so
 * balance holds by construction — only names, flavor and primary stat differ.
 *
 * Primary stat split:
 *   Shadows (Fighter)   → VIT  (tank / army build)
 *   Destruction (Mage)  → STR  (raw magic power)
 *   Fangs (Assassin)    → AGI  (speed / crits)
 *   Frost (Ranger)      → VIT  (control / endurance)
 */
export const MONARCH_PATHS: readonly MonarchPath[] = [
  {
    id: "shadows", name: "Shadow Monarch", monarchTitle: "Shadow Monarch", jobClass: "Necromancer",
    icon: "♛", color: "#a58bff", primaryStat: "vit",
    flavor: "The Fighter's destiny. You raise an army from every enemy that falls to you.",
    signatureExercise: "squat",
    moves: [
      { id: "shadows:1", tier: 1, role: "opener", name: "Army of the Dead", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "shadows:2", tier: 2, role: "weaken", name: "Shadow Exchange", power: 0.8, cost: 4, requiresTrial: 2, debuff: "atk" },
      { id: "shadows:3", tier: 3, role: "empower", name: "Monarch's Resolve", power: 0, cost: 5, requiresTrial: 3, buff: "atk" },
      { id: "shadows:4", tier: 4, role: "drain", name: "Soul Drain", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "shadows:5", tier: 5, role: "ultimate", name: "Ruler's Authority", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "vit", amount: 40 } },
    ],
    tiers: [
      { gateName: "Shadow Extraction", title: "Shadow Initiate", skills: [{ kind: "fatigueResist", amount: 0.08, label: "The dead do not tire: 8% less fatigue" }] },
      { gateName: "Shadow Exchange", title: "Shadow Commander", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Elite Knight's Vow", title: "Knight of Shadows", skills: [{ kind: "lootLuck", amount: 0.08, label: "8% chance of an extra loot roll" }] },
      { gateName: "Beru's Trial", title: "Beru's Equal", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Ashborn's Throne", title: "Ashborn's Heir", skills: [{ kind: "signatureMove", action: "clearFatigue", name: "Army of the Dead", label: "Clear all fatigue once per day" }] },
    ],
  },
  {
    id: "destruction", name: "Monarch of Destruction", monarchTitle: "Monarch of Destruction", jobClass: "Dragon Mage",
    icon: "△", color: "#ff6f66", primaryStat: "str",
    flavor: "The Mage's destiny. You wield dragonfire; the world burns in your wake.",
    signatureExercise: "push",
    moves: [
      { id: "destruction:1", tier: 1, role: "opener", name: "Draconification", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "destruction:2", tier: 2, role: "weaken", name: "Wing Buffet", power: 0.8, cost: 4, requiresTrial: 2, debuff: "def" },
      { id: "destruction:3", tier: 3, role: "empower", name: "Dragon's Pride", power: 0, cost: 5, requiresTrial: 3, buff: "atk" },
      { id: "destruction:4", tier: 4, role: "drain", name: "Devouring Flame", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "destruction:5", tier: 5, role: "ultimate", name: "Antares' Reckoning", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "str", amount: 40 } },
    ],
    tiers: [
      { gateName: "Draconification", title: "Dragonblood", skills: [{ kind: "goldBonus", amount: 0.08, label: "Dragons hoard: +8% gold earned" }] },
      { gateName: "Dragon's Breath", title: "Breathbearer", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Wyrmscale Awakening", title: "Wyrmscale", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Ruin's Wingspan", title: "Ruinwing", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Antares' Reckoning", title: "Heir of Antares", skills: [{ kind: "signatureMove", action: "loot", name: "Scorched Earth", label: "One bonus loot roll per day" }] },
    ],
  },
  {
    id: "fangs", name: "Monarch of Fangs", monarchTitle: "Monarch of Fangs", jobClass: "Berserker",
    icon: "⋇", color: "#dfac7b", primaryStat: "agi",
    flavor: "The Assassin's destiny. The pack answers your call; the hunt never ends.",
    signatureExercise: "sit",
    moves: [
      { id: "fangs:1", tier: 1, role: "opener", name: "Beast Call", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "fangs:2", tier: 2, role: "weaken", name: "Bloodfang Rite", power: 0.8, cost: 4, requiresTrial: 2, debuff: "def" },
      { id: "fangs:3", tier: 3, role: "empower", name: "Pack Instinct", power: 0, cost: 5, requiresTrial: 3, buff: "atk" },
      { id: "fangs:4", tier: 4, role: "drain", name: "Feral Drain", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "fangs:5", tier: 5, role: "ultimate", name: "Rakan's Hunt", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "agi", amount: 40 } },
    ],
    tiers: [
      { gateName: "Beast Call", title: "Beastcaller", skills: [{ kind: "fatigueResist", amount: 0.1, label: "Pack instinct: 10% less fatigue" }] },
      { gateName: "Bloodfang Rite", title: "Bloodfang", skills: [{ kind: "goldBonus", amount: 0.05, label: "+5% gold earned" }] },
      { gateName: "Pack Alpha's Howl", title: "Pack Alpha", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Feral Ascendance", title: "Feral Sovereign", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Rakan's Hunt", title: "Rakan's Heir", skills: [{ kind: "signatureMove", action: "token", name: "Alpha's Howl", label: "+1 Relapse Token once per day" }] },
    ],
  },
  {
    id: "frost", name: "Monarch of Frost", monarchTitle: "Monarch of Frost", jobClass: "Cryomancer",
    icon: "✳", color: "#8fdfff", primaryStat: "vit",
    flavor: "The Ranger's destiny. The ice answers to you; nothing moves you.",
    signatureExercise: "squat",
    moves: [
      { id: "frost:1", tier: 1, role: "opener", name: "Glacial Entombment", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "frost:2", tier: 2, role: "weaken", name: "Frostbite Ward", power: 0.8, cost: 4, requiresTrial: 2, debuff: "atk" },
      { id: "frost:3", tier: 3, role: "empower", name: "Permafrost Focus", power: 0, cost: 5, requiresTrial: 3, buff: "def" },
      { id: "frost:4", tier: 4, role: "drain", name: "Winter's Embrace", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "frost:5", tier: 5, role: "ultimate", name: "Sillad's Eternal Winter", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "vit", amount: 40 } },
    ],
    tiers: [
      { gateName: "Glacial Entombment", title: "Glacial Adept", skills: [{ kind: "recoveryBoost", mode: "potionFatigue", amount: 20, label: "Recovery Potions also clear 20 fatigue" }] },
      { gateName: "Frostbite Ward", title: "Frostwarden", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Permafrost Dominion", title: "Permafrost", skills: [{ kind: "lootLuck", amount: 0.08, label: "8% chance of an extra loot roll" }] },
      { gateName: "Blizzard Sovereignty", title: "Blizzard Sovereign", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Sillad's Eternal Winter", title: "Sillad's Heir", skills: [{ kind: "signatureMove", action: "clearFatigue", name: "Deep Freeze", label: "Clear all fatigue once per day" }] },
    ],
  },
];

export const PATH_FLOURISH_IDS = MONARCH_PATHS.map((_, index) => 200 + index);

export function getPath(id: PathId | null): MonarchPath | null {
  if (!id) return null;
  return MONARCH_PATHS.find((path) => path.id === id) ?? null;
}

/** The Monarch lineage a given class hardens into at the Job Change. */
export function pathForClass(classId: GameClassId | null): MonarchPath | null {
  if (!classId) return null;
  return getPath(CLASS_TO_PATH[classId]);
}

export function getTier(level: number) {
  return PATH_TIERS.find((tier) => level >= tier.min && level <= tier.max)?.number ?? 0;
}

export function gateTitleId(pathId: PathId, tier: TierNumber) {
  return `path:${pathId}:${tier}`;
}

export function getClearedSkills(path: MonarchPath | null, gates: readonly number[]): PathSkill[] {
  if (!path) return [];
  return path.tiers.flatMap((tier, index) => gates.includes(index + 1) ? tier.skills : []);
}
