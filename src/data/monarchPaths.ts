import type { MonarchPath, PathId, PathSkill, TierNumber } from "../types";

export const PATH_TIERS = [
  { number: 1, name: "Nascent", min: 40, max: 54, multiplier: 1.5 },
  { number: 2, name: "Ascendant", min: 55, max: 69, multiplier: 1.75 },
  { number: 3, name: "Dominion", min: 70, max: 89, multiplier: 2 },
  { number: 4, name: "Sovereign", min: 90, max: 119, multiplier: 2.5 },
  { number: 5, name: "Transcendent", min: 120, max: Infinity, multiplier: 3 },
] as const;

export const GATE_BOSS_STATS = {
  // Retuned around the stats naturally earned at each tier floor. The original
  // values could barely hurt a level-40 hunter after automatic VIT growth.
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

export const MONARCH_PATHS: readonly MonarchPath[] = [
  {
    id: "shadows", name: "Shadow Monarch", jobClass: "Necromancer", icon: "♛", color: "#a58bff", battleMove: "Army of the Dead",
    flavor: "You don't fight alone anymore. Raise an army from every battle you win.", signatureExercise: "squat",
    tiers: [
      { gateName: "Shadow Extraction", title: "Shadow Initiate", skills: [{ kind: "fatigueResist", amount: 0.08, label: "The dead do not tire: 8% less fatigue" }] },
      { gateName: "Shadow Exchange", title: "Shadow Commander", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Elite Knight's Vow", title: "Knight of Shadows", skills: [{ kind: "lootLuck", amount: 0.08, label: "8% chance of an extra loot roll" }] },
      { gateName: "Beru's Trial", title: "Beru's Equal", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Ashborn's Throne", title: "Ashborn's Heir", skills: [{ kind: "signatureMove", action: "clearFatigue", name: "Army of the Dead", label: "Clear all fatigue once per day" }] },
    ],
  },
  {
    id: "destruction", name: "Monarch of Destruction", jobClass: "Dragon Mage", icon: "△", color: "#ff6f66", battleMove: "Scorched Earth",
    flavor: "Antares's line. You don't out-train your limits; you incinerate them.", signatureExercise: "push",
    tiers: [
      { gateName: "Draconification", title: "Dragonblood", skills: [{ kind: "goldBonus", amount: 0.08, label: "Dragons hoard: +8% gold earned" }] },
      { gateName: "Dragon's Breath", title: "Breathbearer", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Wyrmscale Awakening", title: "Wyrmscale", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Ruin's Wingspan", title: "Ruinwing", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Antares' Reckoning", title: "Heir of Antares", skills: [{ kind: "signatureMove", action: "loot", name: "Scorched Earth", label: "One bonus loot roll per day" }] },
    ],
  },
  {
    id: "white-flames", name: "Monarch of White Flames", jobClass: "Pyromancer / Dark Knight", icon: "✧", color: "#ffb180", battleMove: "Cauterize",
    flavor: "Baran's line. Burn through fatigue; forge yourself in black fire.", signatureExercise: "push",
    tiers: [
      { gateName: "Hellfire Summoning", title: "Hellfire Adept", skills: [{ kind: "recoveryBoost", mode: "staminaDiscount", amount: 0.2, label: "Stamina Draft costs 20% less gold" }] },
      { gateName: "Black Flame Rite", title: "Black Flame Knight", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Demon Blade Communion", title: "Demonblade", skills: [{ kind: "fatigueResist", amount: 0.08, label: "8% less fatigue" }] },
      { gateName: "Infernal Legion", title: "Infernal Commander", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Baran's Inferno", title: "White Flame Sovereign", skills: [{ kind: "signatureMove", action: "clearFatigue", name: "Cauterize", label: "Clear all fatigue once per day" }] },
    ],
  },
  {
    id: "fangs", name: "Monarch of Fangs", jobClass: "Berserker / Shaman", icon: "⋇", color: "#dfac7b", battleMove: "Alpha's Howl",
    flavor: "Rakan's line. Pack instinct; you don't quit on a hunt.", signatureExercise: "squat",
    tiers: [
      { gateName: "Beast Call", title: "Beastcaller", skills: [{ kind: "fatigueResist", amount: 0.1, label: "Pack instinct: 10% less fatigue" }] },
      { gateName: "Bloodfang Rite", title: "Bloodfang", skills: [{ kind: "goldBonus", amount: 0.05, label: "+5% gold earned" }] },
      { gateName: "Pack Alpha's Howl", title: "Pack Alpha", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Feral Ascendance", title: "Feral Sovereign", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Rakan's Hunt", title: "Rakan's Heir", skills: [{ kind: "signatureMove", action: "token", name: "Alpha's Howl", label: "+1 Relapse Token once per day" }] },
    ],
  },
  {
    id: "frost", name: "Monarch of Frost", jobClass: "Cryomancer / Ice Mage", icon: "✳", color: "#8fdfff", battleMove: "Deep Freeze",
    flavor: "Sillad's line. Stillness and control; the body that doesn't break.", signatureExercise: "sit",
    tiers: [
      { gateName: "Glacial Entombment", title: "Glacial Adept", skills: [{ kind: "recoveryBoost", mode: "potionFatigue", amount: 20, label: "Recovery Potions also clear 20 fatigue" }] },
      { gateName: "Frostbite Ward", title: "Frostwarden", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Permafrost Dominion", title: "Permafrost", skills: [{ kind: "lootLuck", amount: 0.08, label: "8% chance of an extra loot roll" }] },
      { gateName: "Blizzard Sovereignty", title: "Blizzard Sovereign", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Sillad's Eternal Winter", title: "Sillad's Heir", skills: [{ kind: "signatureMove", action: "clearFatigue", name: "Deep Freeze", label: "Clear all fatigue once per day" }] },
    ],
  },
  {
    id: "iron-body", name: "Monarch of the Iron Body", jobClass: "Tank / Juggernaut", icon: "▣", color: "#ced7e0", battleMove: "Immovable",
    flavor: "Tarnak's line. You are the thing that doesn't move.", signatureExercise: "squat",
    tiers: [
      { gateName: "Golem Forge", title: "Stoneforged", skills: [{ kind: "fatigueResist", amount: 0.1, label: "10% less fatigue" }] },
      { gateName: "Ironclad Rite", title: "Ironclad", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Bulwark Ascension", title: "Living Bulwark", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Mountain's Resolve", title: "Mountainheart", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Tarnak's Unbreakable Throne", title: "Tarnak's Heir", skills: [{ kind: "streakShield", charges: 1, label: "Immovable: a second weekly shield charge" }] },
    ],
  },
  {
    id: "beginning", name: "Monarch of the Beginning", jobClass: "Brute / Brawler", icon: "◆", color: "#c9ae91", battleMove: "Ground Zero",
    flavor: "Legia's line. Raw, primal, first-principles strength.", signatureExercise: "push",
    tiers: [
      { gateName: "Colossal Growth", title: "Colossus", skills: [{ kind: "goldBonus", amount: 0.08, label: "+8% gold earned" }] },
      { gateName: "Titan's Stride", title: "Titanwalker", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Earthshaker Rite", title: "Earthshaker", skills: [{ kind: "lootLuck", amount: 0.06, label: "6% chance of an extra loot roll" }] },
      { gateName: "Giant's Dominion", title: "Giant's Heir", skills: [{ kind: "recoveryBoost", mode: "draftPower", amount: 15, label: "Stamina Draft clears 15 extra fatigue" }] },
      { gateName: "Legia's Genesis", title: "Firstborn", skills: [{ kind: "signatureMove", action: "loot", name: "Ground Zero", label: "One bonus loot roll per day" }] },
    ],
  },
  {
    id: "plagues", name: "Monarch of Plagues", jobClass: "Summoner / Poison Mage", icon: "☣", color: "#8ed990", battleMove: "Outbreak",
    flavor: "Querehsha's line. Patient, relentless, everywhere at once.", signatureExercise: "sit",
    tiers: [
      { gateName: "Parasitic Infection", title: "Swarmcaller", skills: [{ kind: "lootLuck", amount: 0.08, label: "The swarm finds everything: 8% extra loot chance" }] },
      { gateName: "Swarm Communion", title: "Hivebound", skills: [{ kind: "fatigueResist", amount: 0.06, label: "6% less fatigue" }] },
      { gateName: "Hive Dominion", title: "Hive Sovereign", skills: [{ kind: "goldBonus", amount: 0.06, label: "+6% gold earned" }] },
      { gateName: "Pestilent Legion", title: "Plaguewarden", skills: [{ kind: "streakShield", charges: 1, label: "One forgiven missed day per week" }] },
      { gateName: "Querehsha's Plague", title: "Querehsha's Heir", skills: [{ kind: "signatureMove", action: "loot", name: "Outbreak", label: "One bonus loot roll per day" }] },
    ],
  },
  {
    id: "transfiguration", name: "Monarch of Transfiguration", jobClass: "Sorcerer / Illusionist", icon: "⌬", color: "#d3a1ef", battleMove: "Reshape",
    flavor: "Yogumunt's line. Nothing about you has to stay what it was.", signatureExercise: "sit",
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
  return MONARCH_PATHS.find((path) => path.id === id) ?? null;
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