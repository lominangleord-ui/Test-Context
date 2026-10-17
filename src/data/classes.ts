import type { BasicSkill, GameClassId, HunterClass, StatKey } from "../types";

/**
 * The four classes a hunter picks between at Awakening, before anyone knows what
 * a Monarch is. Every class fills the same eight roles with the same numbers, so
 * the kit is balanced by construction and only the names and flavour differ.
 *
 * Deliberately not overpowered: nothing here is stronger than the weakest
 * Monarch path move, buffs are small and single-target, the two heavy hits are
 * once per fight, and nothing scales with level. This is a level 1-40 kit.
 *
 * Economy: seven learnable nodes cost 2+3+3+4+4+5+6 = 27 skill points (SP) and
 * are level-gated up to 30. SP comes from clearing story tiles — 1 per field
 * tile, 2 per story/boss beat — which pays 37 SP by level 30, so the full kit
 * is reachable with 10 SP of slack. Stat points are a separate currency.
 */
const role = (name: string, desc: string, level: number, cost: number, extra: Partial<BasicSkill>): BasicSkill => ({
  id: "", name, desc, level, cost, role: "opener", power: 0, ...extra,
});

function kit(prefix: string, names: [string, string, string, string, string, string, string, string], descs: [string, string, string, string, string, string, string, string]): readonly BasicSkill[] {
  const skills: BasicSkill[] = [
    role(names[0], descs[0], 1, 0, { role: "opener", power: 1.1, starter: true }),
    role(names[1], descs[1], 5, 2, { role: "weaken", power: 0.9, debuff: "atk", scale: 0.1 }),
    role(names[2], descs[2], 9, 3, { role: "empower", buff: "atk", scale: 0.15 }),
    role(names[3], descs[3], 13, 3, { role: "heal", heal: 0.25 }),
    role(names[4], descs[4], 17, 4, { role: "empower", buff: "def", scale: 0.15 }),
    role(names[5], descs[5], 22, 4, { role: "finisher", power: 1.4, once: true }),
    role(names[6], descs[6], 26, 5, { role: "drain", power: 1, drain: 0.5 }),
    role(names[7], descs[7], 30, 6, { role: "finisher", power: 1.6, once: true }),
  ];
  return skills.map((skill, index) => ({ ...skill, id: `${prefix}:${index + 1}` }));
}

export const HUNTER_CLASSES: readonly HunterClass[] = [
  {
    id: "fighter", name: "Fighter", icon: "⚔", color: "#ff8a5b", role: "Frontline",
    flavor: "Close the distance and stay standing. The Association's default answer to a Gate.",
    stats: ["str", "vit"],
    skills: kit("fighter", [
      "Cleave", "Shield Bash", "Battle Stance", "Second Wind", "Iron Guard", "Crushing Blow", "Blood Rush", "Warlord's Roar",
    ], [
      "A wide opening swing. 1.1x ATK.",
      "Drive your guard into the enemy. 0.9x ATK, and its attack drops 10% for the fight.",
      "Plant your feet. Your attack rises 15% for the fight.",
      "Breathe, bandage, stand back up. Restores 25% of maximum HP.",
      "Set your shoulder behind the shield. Your defense rises 15% for the fight.",
      "Everything you have into one blow. 1.4x ATK, once per fight.",
      "Fight through the wound. 1.0x ATK and you recover 50% of the damage dealt.",
      "A challenge that rattles the enemy. 1.6x ATK, once per fight.",
    ]),
  },
  {
    id: "mage", name: "Mage", icon: "✧", color: "#a58bff", role: "Artillery",
    flavor: "Too slow to swing and too clever to need to. Mana does the walking.",
    stats: ["agi", "str"],
    skills: kit("mage", [
      "Mana Bolt", "Frost Lock", "Arcane Focus", "Siphon Ward", "Barrier", "Flame Lance", "Rime Drain", "Ascendant Channel",
    ], [
      "A compact bolt of raw mana. 1.1x ATK.",
      "Ice closes around the enemy's arms. 0.9x ATK, and its attack drops 10% for the fight.",
      "The world narrows to one point. Your attack rises 15% for the fight.",
      "Draw ambient mana into your own wounds. Restores 25% of maximum HP.",
      "A hexagon of light, held. Your defense rises 15% for the fight.",
      "A spear of white fire. 1.4x ATK, once per fight.",
      "Cold that drinks what it touches. 1.0x ATK and you recover 50% of the damage dealt.",
      "Overdraw the mana in your blood. 1.6x ATK, once per fight.",
    ]),
  },
  {
    id: "assassin", name: "Assassin", icon: "◈", color: "#38d98a", role: "Striker",
    flavor: "Four strikes land before the first one is noticed. Then none do.",
    stats: ["agi", "str"],
    skills: kit("assassin", [
      "Quick Strike", "Venom Edge", "Shadow Step", "Field Kit", "Smoke Veil", "Vital Strike", "Leeching Cut", "Assassinate",
    ], [
      "Two short cuts, barely seen. 1.1x ATK.",
      "Coated steel. 0.9x ATK, and the poison drops its defense 10% for the fight.",
      "Step where the eye isn't. Your attack rises 15% for the fight.",
      "Gauze, tape and a wince. Restores 25% of maximum HP.",
      "Break line of sight. Your defense rises 15% for the fight.",
      "Straight through the seam in the plate. 1.4x ATK, once per fight.",
      "Open the wound wider. 1.0x ATK and you recover 50% of the damage dealt.",
      "One motion, no warning. 1.6x ATK, once per fight.",
    ]),
  },
  {
    id: "ranger", name: "Ranger", icon: "⌖", color: "#8fdfff", role: "Marksman",
    flavor: "The Gate is a terrain problem. Solve it from a distance, patiently.",
    stats: ["agi", "vit"],
    skills: kit("ranger", [
      "Piercing Shot", "Hunter's Mark", "Steady Aim", "Field Dressing", "Camouflage", "Barbed Volley", "Longshot", "Eagle Eye",
    ], [
      "An arrow that does not slow down. 1.1x ATK.",
      "Mark the joint in the armour. 0.9x ATK, and the shot drops its defense 10% for the fight.",
      "Ten seconds of held breath. Your attack rises 15% for the fight.",
      "Field medicine, quickly. Restores 25% of maximum HP.",
      "Bark, moss and stillness. Your defense rises 15% for the fight.",
      "A dozen barbs, all at once. 1.4x ATK, once per fight.",
      "A shot that keeps paying. 1.0x ATK and you recover 50% of the damage dealt.",
      "One arrow, no correction. 1.6x ATK, once per fight.",
    ]),
  },
];

export function getClass(id: GameClassId | null): HunterClass | null {
  if (!id) return null;
  return HUNTER_CLASSES.find((entry) => entry.id === id) ?? null;
}

/** Falls back to the closest class for saves that predate the class pick. */
export function defaultClassFor(archetype: string): GameClassId {
  if (archetype === "assassin") return "assassin";
  if (archetype === "monarch") return "mage";
  if (archetype === "vanguard") return "ranger";
  return "fighter";
}

export function classSkills(id: GameClassId | null): readonly BasicSkill[] {
  return getClass(id)?.skills ?? [];
}

/** Total points needed to own every node in a class kit. */
export function classKitCost(id: GameClassId | null): number {
  return classSkills(id).reduce((total, skill) => total + (skill.starter ? 0 : skill.cost), 0);
}

/** Highest level gate in a class kit: the level by which the whole kit exists. */
export function classKitLevelCap(id: GameClassId | null): number {
  return classSkills(id).reduce((highest, skill) => Math.max(highest, skill.level), 1);
}

export const CLASS_STAT_LABEL: Record<StatKey, string> = { str: "STR", agi: "AGI", vit: "VIT" };
