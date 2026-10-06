import type { GameClassId, MonarchPath, PathId, PathSkill, TierNumber } from "../types";

/*
 * The nine Monarch lineages — chosen freely at the Job Change ceremony
 * (level 40). Each class can take any of the nine paths; the four starter
 * classes are balanced so no single path is locked to a single class.
 *
 * Tier floors follow the corrected public rank curve:
 *   Tier 1 (Nascent)     B-Rank       levels 40-54
 *   Tier 2 (Ascendant)   A-Rank       levels 55-74
 *   Tier 3 (Dominion)    S-Rank       levels 75-99
 *   Tier 4 (Sovereign)   National     levels 100-119
 *   Tier 5 (Transcendent) Monarch     levels 120+
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

/**
 * A reasonable default for which path each class tends toward (display only;
 * does not lock selection). Any class can take any path at Job Change.
 */
export const CLASS_TO_PATH: Record<GameClassId, PathId> = {
  fighter: "shadows",
  mage: "destruction",
  assassin: "fangs",
  ranger: "frost",
};

export const MONARCH_PATHS: readonly MonarchPath[] = [
  {
    id: "shadows", name: "Shadow Monarch", monarchTitle: "Shadow Monarch", jobClass: "Necromancer", icon: "♛", color: "#a58bff", primaryStat: "vit",
    flavor: "You don't fight alone anymore. Raise an army from every battle you win.", signatureExercise: "squat",
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
    id: "destruction", name: "Monarch of Destruction", monarchTitle: "Monarch of Destruction", jobClass: "Dragon Mage", icon: "△", color: "#ff6f66", primaryStat: "str",
    flavor: "Antares's line. You don't out-train your limits; you incinerate them.", signatureExercise: "push",
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
    id: "white-flames", name: "Monarch of White Flames", monarchTitle: "Monarch of White Flames", jobClass: "Pyromancer", icon: "✧", color: "#ffb180", primaryStat: "agi",
    flavor: "Baran's line. Burn through fatigue; forge yourself in black fire.", signatureExercise: "push",
    moves: [
      { id: "white-flames:1", tier: 1, role: "opener", name: "Hellfire Summoning", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "white-flames:2", tier: 2, role: "weaken", name: "Black Flame Rite", power: 0.8, cost: 4, requiresTrial: 2, debuff: "atk" },
      { id: "white-flames:3", tier: 3, role: "empower", name: "Demonic Focus", power: 0, cost: 5, requiresTrial: 3, buff: "crit" },
      { id: "white-flames:4", tier: 4, role: "drain", name: "Infernal Thirst", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "white-flames:5", tier: 5, role: "ultimate", name: "Baran's Inferno", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "agi", amount: 40 } },
    ],
    tiers: [
      { gateName: "Hellfire Summoning", title: "Hellfire Adept", skills: [{ kind: "recoveryBoost", mode: "staminaDiscount", amount: 0.2, label: "Stamina Draft costs 20% less gold" }] },
      { gateName: "Black Flame Rite", title: "Black Flame Knight", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Demon Blade Communion", title: "Demonblade", skills: [{ kind: "fatigueResist", amount: 0.08, label: "8% less fatigue" }] },
      { gateName: "Infernal Legion", title: "Infernal Commander", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Baran's Inferno", title: "White Flame Sovereign", skills: [{ kind: "signatureMove", action: "clearFatigue", name: "Cauterize", label: "Clear all fatigue once per day" }] },
    ],
  },
  {
    id: "fangs", name: "Monarch of Fangs", monarchTitle: "Monarch of Fangs", jobClass: "Berserker", icon: "⋇", color: "#dfac7b", primaryStat: "str",
    flavor: "Rakan's line. Pack instinct; you don't quit on a hunt.", signatureExercise: "squat",
    moves: [
      { id: "fangs:1", tier: 1, role: "opener", name: "Beast Call", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "fangs:2", tier: 2, role: "weaken", name: "Bloodfang Rite", power: 0.8, cost: 4, requiresTrial: 2, debuff: "def" },
      { id: "fangs:3", tier: 3, role: "empower", name: "Pack Instinct", power: 0, cost: 5, requiresTrial: 3, buff: "atk" },
      { id: "fangs:4", tier: 4, role: "drain", name: "Feral Drain", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "fangs:5", tier: 5, role: "ultimate", name: "Rakan's Hunt", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "str", amount: 40 } },
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
    id: "frost", name: "Monarch of Frost", monarchTitle: "Monarch of Frost", jobClass: "Cryomancer", icon: "✳", color: "#8fdfff", primaryStat: "vit",
    flavor: "Sillad's line. Stillness and control; the body that doesn't break.", signatureExercise: "sit",
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
  {
    id: "iron-body", name: "Monarch of the Iron Body", monarchTitle: "Monarch of the Iron Body", jobClass: "Juggernaut", icon: "▣", color: "#ced7e0", primaryStat: "vit",
    flavor: "Tarnak's line. You are the thing that doesn't move.", signatureExercise: "squat",
    moves: [
      { id: "iron-body:1", tier: 1, role: "opener", name: "Golem Forge", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "iron-body:2", tier: 2, role: "weaken", name: "Ironclad Rite", power: 0.8, cost: 4, requiresTrial: 2, debuff: "atk" },
      { id: "iron-body:3", tier: 3, role: "empower", name: "Bulwark Stance", power: 0, cost: 5, requiresTrial: 3, buff: "def" },
      { id: "iron-body:4", tier: 4, role: "drain", name: "Mountain's Resolve", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "iron-body:5", tier: 5, role: "ultimate", name: "Tarnak's Unbreakable Throne", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "vit", amount: 40 } },
    ],
    tiers: [
      { gateName: "Golem Forge", title: "Stoneforged", skills: [{ kind: "fatigueResist", amount: 0.1, label: "10% less fatigue" }] },
      { gateName: "Ironclad Rite", title: "Ironclad", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Bulwark Ascension", title: "Living Bulwark", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Mountain's Resolve", title: "Mountainheart", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Tarnak's Unbreakable Throne", title: "Tarnak's Heir", skills: [{ kind: "streakShield", charges: 1, label: "Immovable: a second weekly shield charge" }] },
    ],
  },
  {
    id: "beginning", name: "Monarch of the Beginning", monarchTitle: "Monarch of the Beginning", jobClass: "Brawler", icon: "◆", color: "#c9ae91", primaryStat: "str",
    flavor: "Legia's line. Raw, primal, first-principles strength.", signatureExercise: "push",
    moves: [
      { id: "beginning:1", tier: 1, role: "opener", name: "Colossal Growth", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "beginning:2", tier: 2, role: "weaken", name: "Titan's Stride", power: 0.8, cost: 4, requiresTrial: 2, debuff: "def" },
      { id: "beginning:3", tier: 3, role: "empower", name: "Earthshaker Focus", power: 0, cost: 5, requiresTrial: 3, buff: "atk" },
      { id: "beginning:4", tier: 4, role: "drain", name: "Giant's Hunger", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "beginning:5", tier: 5, role: "ultimate", name: "Legia's Genesis", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "str", amount: 40 } },
    ],
    tiers: [
      { gateName: "Colossal Growth", title: "Colossus", skills: [{ kind: "goldBonus", amount: 0.08, label: "+8% gold earned" }] },
      { gateName: "Titan's Stride", title: "Titanwalker", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Earthshaker Rite", title: "Earthshaker", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Giant's Dominion", title: "Giant's Heir", skills: [{ kind: "recoveryBoost", mode: "draftPower", amount: 15, label: "Stamina Draft clears 15 extra fatigue" }] },
      { gateName: "Legia's Genesis", title: "Firstborn", skills: [{ kind: "signatureMove", action: "loot", name: "Ground Zero", label: "One bonus loot roll per day" }] },
    ],
  },
  {
    id: "plagues", name: "Monarch of Plagues", monarchTitle: "Monarch of Plagues", jobClass: "Poison Mage", icon: "☣", color: "#8ed990", primaryStat: "agi",
    flavor: "Querehsha's line. Patient, relentless, everywhere at once.", signatureExercise: "sit",
    moves: [
      { id: "plagues:1", tier: 1, role: "opener", name: "Parasitic Infection", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "plagues:2", tier: 2, role: "weaken", name: "Swarm Communion", power: 0.8, cost: 4, requiresTrial: 2, debuff: "atk" },
      { id: "plagues:3", tier: 3, role: "empower", name: "Hive Focus", power: 0, cost: 5, requiresTrial: 3, buff: "crit" },
      { id: "plagues:4", tier: 4, role: "drain", name: "Pestilent Drain", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "plagues:5", tier: 5, role: "ultimate", name: "Querehsha's Plague", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "agi", amount: 40 } },
    ],
    tiers: [
      { gateName: "Parasitic Infection", title: "Swarmcaller", skills: [{ kind: "lootLuck", amount: 0.08, label: "The swarm finds everything: 8% extra loot chance" }] },
      { gateName: "Swarm Communion", title: "Hivebound", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Hive Dominion", title: "Hive Sovereign", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Pestilent Legion", title: "Plaguewarden", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Querehsha's Plague", title: "Querehsha's Heir", skills: [{ kind: "signatureMove", action: "loot", name: "Outbreak", label: "One bonus loot roll per day" }] },
    ],
  },
  {
    id: "transfiguration", name: "Monarch of Transfiguration", monarchTitle: "Monarch of Transfiguration", jobClass: "Illusionist", icon: "⌬", color: "#d3a1ef", primaryStat: "agi",
    flavor: "Yogumunt's line. Nothing about you has to stay what it was.", signatureExercise: "sit",
    moves: [
      { id: "transfiguration:1", tier: 1, role: "opener", name: "Spatial Alteration", power: 1.3, cost: 3, requiresTrial: 1 },
      { id: "transfiguration:2", tier: 2, role: "weaken", name: "Mirror Rite", power: 0.8, cost: 4, requiresTrial: 2, debuff: "def" },
      { id: "transfiguration:3", tier: 3, role: "empower", name: "Phase Focus", power: 0, cost: 5, requiresTrial: 3, buff: "crit" },
      { id: "transfiguration:4", tier: 4, role: "drain", name: "Realitybend", power: 1.1, cost: 6, requiresTrial: 4, drain: 0.4 },
      { id: "transfiguration:5", tier: 5, role: "ultimate", name: "Yogumunt's Infinite Form", power: 1.8, cost: 8, requiresTrial: 5, requiresStat: { stat: "agi", amount: 40 } },
    ],
    tiers: [
      { gateName: "Spatial Alteration", title: "Spacebender", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Mirror Rite", title: "Mirror Adept", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Phase Dominion", title: "Phasewalker", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Realitybend", title: "Realitybender", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Yogumunt's Infinite Form", title: "Infinite Form", skills: [{ kind: "signatureMove", action: "clearFatigue", name: "Reshape", label: "Clear all fatigue once per day" }] },
    ],
  },
];

export const PATH_FLOURISH_IDS = MONARCH_PATHS.map((_, index) => 200 + index);

export function getPath(id: PathId | null): MonarchPath | null {
  if (!id) return null;
  return MONARCH_PATHS.find((path) => path.id === id) ?? null;
}

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
