import type {
  Item,
  ShopItem,
  LootRoll,
  TitleDef,
  SpecialQuest,
  ArchetypeId,
  ExerciseKey,
  PenaltyTargets,
} from "./types";
import { MONARCH_PATHS, PATH_FLOURISH_IDS } from "./data/monarchPaths";

export const STARTER_THEME_ID = 100;

/** Selectable hunter portraits [NEW ADDITION] */
export const AVATARS = [
  { id: "hunter-1", src: "/avatars/hunter-1.jpg", name: "Shadow" },
  { id: "hunter-2", src: "/avatars/hunter-2.jpg", name: "Frost" },
  { id: "hunter-3", src: "/avatars/hunter-3.jpg", name: "Ember" },
  { id: "hunter-4", src: "/avatars/hunter-4.jpg", name: "Mana" },
];

/** Base daily targets [VERIFIED FROM SOURCE] */
export const BASE_TARGETS: Record<ExerciseKey, number> = {
  push: 100,
  sit: 100,
  squat: 100,
  run: 10,
};

export const RANK_FLOOR: Record<ExerciseKey, number> = {
  push: 50, sit: 50, squat: 50, run: 1,
};

export function rampTarget(floor: number, cap: number, level: number, unit: "reps" | "km") {
  // Level 51 is now the first A-Rank level, so the original "cap by A-Rank"
  // promise follows the corrected public rank curve instead of the old level 40.
  const t = Math.max(0, Math.min(1, ((Number.isFinite(level) ? level : 1) - 1) / 50));
  const step = unit === "km" ? 0.5 : 5;
  return Math.min(cap, Math.max(floor, Math.round((floor + (cap - floor) * t) / step) * step));
}

export const EXERCISES: {
  key: ExerciseKey;
  name: string;
  label: string;
  unit: string;
  hasCam: boolean;
}[] = [
  { key: "push", name: "Push-ups", label: "STRENGTH", unit: "reps", hasCam: true },
  { key: "sit", name: "Sit-ups", label: "CORE", unit: "reps", hasCam: true },
  { key: "squat", name: "Squats", label: "LOWER BODY", unit: "reps", hasCam: true },
  // No camera path for the run leg — MoveNet can't verify running distance from a
  // static phone camera. This is a deliberate scope decision (Bug #7), not a gap.
  { key: "run", name: "Run", label: "ENDURANCE", unit: "km", hasCam: false },
];

/** Archetypes [NEW ADDITION B.1] */
export const ARCHETYPES: Record<
  ArchetypeId,
  {
    id: ArchetypeId;
    name: string;
    icon: string;
    desc: string;
    xpMult: number;
    targetOverrides: Partial<Record<ExerciseKey, number>>;
  }
> = {
  balanced: {
    id: "balanced",
    name: "Balanced Hunter",
    icon: "⚖️",
    desc: "Starts at 50 reps per exercise and 1 km. Gradually reaches 100 reps and 10 km at A-Rank.",
    xpMult: 1.0,
    targetOverrides: {},
  },
  assassin: {
    id: "assassin",
    name: "Shadow Assassin",
    icon: "🗡️",
    desc: "Core and squats start at 60 reps and grow to 115. +10% XP for harder training.",
    xpMult: 1.1,
    targetOverrides: { sit: 115, squat: 115 },
  },
  monarch: {
    id: "monarch",
    name: "Monarch of Strength",
    icon: "💪",
    desc: "Push-ups start at 60 and grow to 120. +10% XP for harder training.",
    xpMult: 1.1,
    targetOverrides: { push: 120 },
  },
  vanguard: {
    id: "vanguard",
    name: "Shadow Vanguard",
    icon: "🛡️",
    desc: "Runs start at 1.5 km and grow to 12 km. +10% XP for harder training.",
    xpMult: 1.1,
    targetOverrides: { run: 12 },
  },
};

/** Permanent inventory contains cosmetics only. Consumables never affect XP. */
export const ITEMS: Item[] = [
  { id: STARTER_THEME_ID, name: "System Blue HUD", icon: "🔷", desc: "Default interface theme.", theme: "system-blue", pool: "starter" },
  { id: 13, name: "Shadow Purple HUD", icon: "🟣", desc: "Unlocks the Shadow Purple theme. Cosmetic only.", theme: "shadow-purple", pool: "cosmetic" },
  { id: 14, name: "Monarch Gold HUD", icon: "🟡", desc: "Unlocks the Monarch Gold theme. Cosmetic only.", theme: "monarch-gold", pool: "cosmetic" },
  ...MONARCH_PATHS.map((path, index): Item => ({
    id: 200 + index,
    name: `${path.name} Sigil`,
    icon: path.icon,
    desc: `Cosmetic ${path.name} flourish. Personalized only after Job Change.`,
    pathFlourish: path.id,
    pool: "flourish",
  })),
];

export const SHOP_ITEMS: ShopItem[] = [
  { id: 31, name: "Recovery Potion", icon: "🧪", desc: "Fully restores HP and MP.", cost: 40, kind: "recovery" },
  { id: 30, name: "Stamina Draft", icon: "🧪", desc: "Clears 40 fatigue points. No XP bonus.", cost: 30, kind: "stamina" },
  { id: 32, name: "Elixir of Vitality", icon: "✦", desc: "Restores HP/MP and clears all fatigue.", cost: 90, kind: "elixir" },
  { id: 33, name: "Relapse Token", icon: "◇", desc: "A rare way to escape Lockdown. No XP bonus.", cost: 150, kind: "token" },
  { id: 34, name: "Path Sigil", icon: "✧", desc: "Cosmetic finish for your chosen Monarch path. Job Change required.", cost: 60, kind: "sigil" },
];

export function rollLoot(ownedThemeIds: number[], ownedFlourishIds: number[] = ownedThemeIds, random = Math.random): LootRoll {
  const unownedThemes = [13, 14].filter((id) => !ownedThemeIds.includes(id));
  const unownedFlourishes = PATH_FLOURISH_IDS.filter((id) => !ownedFlourishIds.includes(id));
  // Tokens should be exceptional: a 5% roll, never a free spawn bonus.
  if (random() < 0.05) return { kind: "token", amount: 1 };
  const options: LootRoll[] = [
    { kind: "potions", amount: 2 },
    { kind: "gold", amount: 60 },
    { kind: "gold", amount: 60 },
    { kind: "gold", amount: 120 },
    ...(unownedThemes.length ? [{ kind: "theme" as const, themeId: unownedThemes[Math.floor(random() * unownedThemes.length)] }] : []),
    ...(unownedFlourishes.length ? [{ kind: "flourish" as const, flourishId: unownedFlourishes[Math.floor(random() * unownedFlourishes.length)] }] : []),
  ];
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

/** Five-rep and half-kilometre steps keep the level 1-to-40 ramp manageable. */
export function computeTargets(
  archetype: ArchetypeId,
  dayMode: "classic" | "recovery" | "overdrive",
  level: number,
): Record<ExerciseKey, number> {
  const arch = ARCHETYPES[archetype];
  const cap: Record<ExerciseKey, number> = {
    push: arch.targetOverrides.push ?? BASE_TARGETS.push,
    sit: arch.targetOverrides.sit ?? BASE_TARGETS.sit,
    squat: arch.targetOverrides.squat ?? BASE_TARGETS.squat,
    run: arch.targetOverrides.run ?? BASE_TARGETS.run,
  };
  const base = {} as Record<ExerciseKey, number>;
  for (const key of ["push", "sit", "squat", "run"] as const) {
    // The class XP trade-off is paid for with harder targets from day one.
    const scaledFloor = RANK_FLOOR[key] * cap[key] / BASE_TARGETS[key];
    const floor = key === "run" ? Math.ceil(scaledFloor * 2) / 2 : Math.round(scaledFloor / 5) * 5;
    base[key] = rampTarget(floor, cap[key], level, key === "run" ? "km" : "reps");
  }
  if (dayMode === "recovery") {
    return {
      push: Math.round(base.push * 0.6),
      sit: Math.round(base.sit * 0.6),
      squat: Math.round(base.squat * 0.6),
      run: Math.max(0.5, Math.round(base.run * 0.6 * 2) / 2),
    };
  }
  if (dayMode === "overdrive") {
    return {
      push: Math.ceil(base.push * 1.15),
      sit: Math.ceil(base.sit * 1.15),
      squat: Math.ceil(base.squat * 1.15),
      run: Math.ceil(base.run * 1.15 * 2) / 2,
    };
  }
  return base;
}

export function computePenaltyTargets(daily: Record<ExerciseKey, number>): PenaltyTargets {
  return { push: daily.push * 2, sit: daily.sit * 2, run: daily.run * 2 };
}

export function getItem(id: number | null): Item | undefined {
  if (id == null) return undefined;
  return ITEMS.find((i) => i.id === id);
}

/** Base and rank titles. One title per public rank band, plus streak and flavor rewards. */
export const TITLES: TitleDef[] = [
  { id: 0, name: "Awakened — World's Weakest Hunter", icon: "🔰", desc: "Every Monarch starts somewhere.", level: 1 },
  { id: 1, name: "E-Rank Hunter", icon: "✨", desc: "The Association's lowest grade. Reach Level 1.", level: 1 },
  { id: 2, name: "D-Rank Hunter", icon: "🔰", desc: "Reach Level 10.", level: 10 },
  { id: 3, name: "Iron Will", icon: "🛡️", desc: "Maintain a 3-day streak.", streak: 3 },
  { id: 4, name: "C-Rank Hunter", icon: "⚔️", desc: "Reach Level 25.", level: 25 },
  { id: 5, name: "Relentless", icon: "🔥", desc: "Maintain a 14-day streak.", streak: 14 },
  { id: 6, name: "B-Rank Hunter", icon: "◆", desc: "Reach Level 40.", level: 40 },
  { id: 7, name: "Shadow of Discipline", icon: "🌑", desc: "Maintain a 30-day streak.", streak: 30 },
  { id: 8, name: "A-Rank Hunter", icon: "👑", desc: "Reach Level 55.", level: 55 },
  { id: 9, name: "S-Rank Hunter", icon: "⚔️", desc: "Reach Level 75.", level: 75 },
  { id: 10, name: "National-Level Hunter", icon: "🩸", desc: "Reach Level 100.", level: 100 },
  { id: 11, name: "Monarch Level Hunter", icon: "♛", desc: "Reach Level 120.", level: 120 },
  { id: 12, name: "Monarch Beyond the System", icon: "❈", desc: "Push past Monarch Level at 130.", level: 130 },
];

/** Special quests — 5 pool [VERIFIED FROM SOURCE A.8] */
export const SPECIAL_QUESTS: SpecialQuest[] = [
  { id: 1, name: "Emergency: Run 5km", desc: "The System detects idle muscles. Move.", xp: 300, stat: "agi", statAmt: 1 },
  { id: 2, name: "Surprise Set: 50 Push-ups", desc: "Prove your strength.", xp: 250, stat: "str", statAmt: 1 },
  { id: 3, name: "Core Protocol: 60 Sit-ups", desc: "Reinforce your foundation.", xp: 250, stat: "vit", statAmt: 1 },
  { id: 4, name: "Endurance Trial: 80 Squats", desc: "Withstand the burn.", xp: 280, stat: "agi", statAmt: 1 },
  { id: 5, name: "Vitality Surge: Full Body", desc: "The System rewards initiative.", xp: 350, stat: "vit", statAmt: 1 },
];

/** Public Association grades. Each band owns its own boundary level. */
export const RANKS = [
  { id: "E", name: "E-Rank", min: 1, max: 9, color: "#aaaaaa" },
  { id: "D", name: "D-Rank", min: 10, max: 24, color: "#38d98a" },
  { id: "C", name: "C-Rank", min: 25, max: 39, color: "#9b59f7" },
  { id: "B", name: "B-Rank", min: 40, max: 54, color: "#aa44ff" },
  { id: "A", name: "A-Rank", min: 55, max: 74, color: "#ffaa00" },
  { id: "S", name: "S-Rank", min: 75, max: 99, color: "#cc1a30" },
  { id: "N", name: "National-Level", min: 100, max: 119, color: "#ffd700" },
  { id: "M", name: "Monarch Level", min: 120, max: Infinity, color: "#d8b4fe" },
] as const;

export function rankFromLevel(level: number): { id: string; name: string; color: string } {
  const rank = RANKS.find((entry) => level >= entry.min && level <= entry.max) ?? RANKS[RANKS.length - 1];
  return { id: rank.id, name: rank.name, color: rank.color };
}

/** Deliberate, more forgiving ranges: a rep still needs both ends of the motion. */
export const POSE_THRESHOLDS: Record<
  Exclude<ExerciseKey, "run">,
  { down: number; up: number; joints: [string, string, string] }
> = {
  push: { down: 100, up: 135, joints: ["shoulder", "elbow", "wrist"] },
  sit: { down: 65, up: 95, joints: ["shoulder", "hip", "knee"] },
  squat: { down: 115, up: 140, joints: ["hip", "knee", "ankle"] },
};
// Squat ankle-fallback thresholds (hip-knee angle swing) [NEW ADDITION D.3]
export const SQUAT_FALLBACK = { down: 140, up: 155 };
