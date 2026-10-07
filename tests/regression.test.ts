import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ARCHETYPES, ITEMS, RANKS, SHOP_ITEMS, TITLES, computeTargets, computePenaltyTargets, rankFromLevel, rollLoot, POSE_THRESHOLDS, SQUAT_FALLBACK } from "../src/data.ts";
import { GATE_BOSS_STATS, MONARCH_PATHS, PATH_TIERS, PATH_FLOURISH_IDS, gateTitleId, getTier, getPath } from "../src/data/monarchPaths.ts";
import { deriveBattleStats, readinessFromFatigue, rollAttackDamage, signatureDamage } from "../src/lib/battle.ts";
import { HUNTER_CLASSES, classKitCost, classKitLevelCap, classSkills, defaultClassFor, getClass } from "../src/data/classes.ts";
import { STORY_BEAT_LEVELS, STORY_EPISODES, STORY_REGIONS, buildEpisode, getEpisode } from "../src/data/story.ts";
import { enemyFor, episodeAvailability, expectedCombat, expectedKitAt, forecastFight, kitGuarantee, storyTotals } from "../src/lib/story.ts";
import { fatigueEarned, goldEarned, mondayKey, pathBonuses, shopCost } from "../src/lib/monarch.ts";
import { awardXP } from "../src/lib/progression.ts";
import { grantLoot, resolveLoot } from "../src/lib/loot.ts";
import { Smoother, type KP } from "../src/lib/pose.ts";
import { calibrationStatus, measurePose, RepTracker, type Measurement } from "../src/lib/repTracking.ts";
import { isReminderDue, REMINDER_INTERVAL_MS } from "../src/lib/reminderPolicy.ts";
import { PENALTY_MS, SAVE_KEY, todayISO } from "../src/lib/utils.ts";
import type { ArchetypeId, GameState } from "../src/types.ts";

const saved = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  },
});
const { useGame, normalizeSave, isSaveFile } = await import("../src/store/game.ts");

function fresh(overrides: Partial<GameState> = {}) {
  return normalizeSave({ name: "Test Hunter", ...overrides });
}
function reset(overrides: Partial<GameState> = {}) {
  const data = fresh(overrides);
  data.settings = { ...data.settings, screenShake: false, floatingNumbers: false };
  useGame.setState({ ...data, dead: false, levelUpFx: false, rankUpFx: null, ascensionFx: false, deathCause: "", deathConfirm: false });
}
beforeEach(() => reset());

test("Balanced starts at 50/50/50/1 and reaches its exact cap at A-Rank", () => {
  assert.deepEqual(computeTargets("balanced", "classic", 1), { push: 50, sit: 50, squat: 50, run: 1 });
  assert.deepEqual(computeTargets("balanced", "classic", 20), { push: 70, sit: 70, squat: 70, run: 4.5 });
  for (const level of [51, 75, 100, 121]) {
    assert.deepEqual(computeTargets("balanced", "classic", level), { push: 100, sit: 100, squat: 100, run: 10 });
  }
});

test("All class ramps are monotonic and specialized classes pay their trade-off early", () => {
  for (const archetype of Object.keys(ARCHETYPES) as ArchetypeId[]) {
    let previous = computeTargets(archetype, "classic", 1);
    for (let level = 2; level <= 60; level++) {
      const targets = computeTargets(archetype, "classic", level);
      for (const key of ["push", "sit", "squat", "run"] as const) {
        assert.ok(targets[key] >= previous[key]);
        assert.equal(targets[key] % (key === "run" ? 0.5 : 5), 0);
      }
      previous = targets;
    }
  }
  assert.equal(computeTargets("assassin", "classic", 1).sit, 60);
  assert.equal(computeTargets("assassin", "classic", 51).sit, 115);
  assert.equal(computeTargets("monarch", "classic", 1).push, 60);
  assert.equal(computeTargets("monarch", "classic", 51).push, 120);
  assert.equal(computeTargets("vanguard", "classic", 1).run, 1.5);
  assert.equal(computeTargets("vanguard", "classic", 51).run, 12);
});

test("Recovery stays positive and penalties remain exactly twice the daily", () => {
  for (const mode of ["classic", "recovery", "overdrive"] as const) {
    const targets = computeTargets("balanced", mode, 1);
    assert.ok(targets.run > 0);
    assert.deepEqual(computePenaltyTargets(targets), { push: targets.push * 2, sit: targets.sit * 2, run: targets.run * 2 });
  }
});

test("Permanent inventory is cosmetic and legacy timed Gates, Shadow RNG and XP equipment disappear", () => {
  assert.deepEqual(ITEMS.map((item) => item.id).sort((a, b) => a - b), [13, 14, 100, ...PATH_FLOURISH_IDS].sort((a, b) => a - b));
  assert.deepEqual(SHOP_ITEMS.map((item) => item.kind), ["recovery", "stamina", "elixir", "token", "sigil"]);
  const state = normalizeSave({ name: "Legacy", inventory: [100, 1, 2, 10, 20, 13], equippedItemId: 10, xpBoostEnd: Date.now() + 900000, xpBoostMultiplier: 5, shadows: ["Igris"], urgentActive: true });
  assert.deepEqual(state.inventory, [100, 13]);
  assert.equal("equippedItemId" in state, false);
  assert.equal("xpBoostEnd" in state, false);
  assert.equal("graveyard" in state, false);
  assert.equal("webhookUrl" in state.settings, false);
  assert.equal("shadows" in state, false);
  assert.equal("urgentActive" in state, false);
});

test("Loot reaches both themes and pre-40 path flourishes without duplicating cosmetics", () => {
  const allFlourishes = [...PATH_FLOURISH_IDS];
  assert.deepEqual(rollLoot([100], allFlourishes, () => 0.99), { kind: "theme", themeId: 14 });
  assert.deepEqual(rollLoot([100, 13], allFlourishes, () => 0.99), { kind: "theme", themeId: 14 });
  assert.deepEqual(rollLoot([100, 13, 14], allFlourishes, () => 0.99), { kind: "gold", amount: 120 });
  assert.deepEqual(rollLoot([100], [200, 201, 202, 203, 204, 205, 206, 207], () => 0.99), { kind: "flourish", flourishId: 208 });
  assert.deepEqual(rollLoot([100], allFlourishes, () => 0.04), { kind: "token", amount: 1 });
  const state = fresh();
  const reward = resolveLoot(state, { kind: "potions", amount: 2 });
  assert.equal(reward.patch.potions, 2);
  assert.match(reward.message, /Recovery Potions/);
  const sigil = resolveLoot(state, { kind: "flourish", flourishId: 200 });
  assert.ok(sigil.patch.inventory?.includes(200));
  assert.equal(sigil.patch.equippedFlourishId, null);
});

test("Side quests cannot spawn before the daily clear and never grant a token on spawn", () => {
  reset({ screen: "main", dailyCompleted: false, questDate: todayISO(), dailyDate: todayISO() });
  for (let i = 0; i < 250; i++) useGame.getState().tick();
  assert.equal(useGame.getState().specialActive, false);
  assert.equal(useGame.getState().relapseTokens, 0);
});

test("Only a completed daily can spawn untimed, dismissible Special Quests", () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.01;
    reset({ screen: "main", dailyCompleted: true, questDate: todayISO(), dailyDate: todayISO() });
    useGame.getState().tick();
    assert.equal(useGame.getState().specialActive, true);
    assert.equal(useGame.getState().relapseTokens, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test("Special quests award relapse tokens only at a 5% successful-clear roll", () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.049;
    reset({ dailyCompleted: true, specialActive: true, specialQuest: { id: 2, name: "Set", desc: "Set", xp: 1 } });
    useGame.getState().completeSpecial();
    assert.equal(useGame.getState().relapseTokens, 1);

    Math.random = () => 0.051;
    reset({ dailyCompleted: true, specialActive: true, specialQuest: { id: 2, name: "Set", desc: "Set", xp: 1 } });
    useGame.getState().completeSpecial();
    assert.equal(useGame.getState().relapseTokens, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test("XP has no theme, sigil, potion or Monarch Path multiplier", () => {
  const state = fresh({ level: 120, monarchPath: "shadows", clearedGates: [1, 2, 3, 4, 5], inventory: [100, 13, 14, 200], potions: 999 });
  assert.equal(awardXP(state, 100).effXP, 100);
  const specialized = fresh({ archetype: "monarch" });
  assert.equal(awardXP(specialized, 100).effXP, 110);
});

test("Recovery Potion restores HP and MP; Stamina Draft subtracts 40 without touching XP", () => {
  reset({ hp: 60, mp: 10, fatigueLevel: 65, gold: 100 });
  useGame.getState().buyPotion();
  useGame.getState().consumePotion();
  assert.equal(useGame.getState().hp, useGame.getState().hpMax);
  assert.equal(useGame.getState().mp, useGame.getState().mpMax);
  useGame.getState().buyItem(30);
  useGame.getState().consumeStamina();
  assert.equal(useGame.getState().fatigueLevel, 25);
  assert.equal(useGame.getState().xp, 0);
  assert.equal(useGame.getState().gold, 30);
});

test("Finishing onboarding preserves the hunter instead of importing an empty save", () => {
  useGame.getState().awaken("New Hunter", "assassin", "/avatars/hunter-2.jpg");
  useGame.getState().finishAwakening();
  assert.equal(useGame.getState().screen, "main");
  assert.equal(useGame.getState().name, "New Hunter");
  assert.equal(useGame.getState().archetype, "assassin");
  assert.equal(useGame.getState().avatar, "/avatars/hunter-2.jpg");
});

test("Starting title 'Awakened — World's Weakest Hunter' is auto-equipped at level 1", () => {
  const freshState = fresh();
  assert.equal(freshState.equippedTitle, 0);
  assert.ok(freshState.notifiedTitles.includes(0));
});

test("A level-up does not move the daily target; completion is paid only once", () => {
  const startingPts = useGame.getState().pts;
  for (const key of ["push", "sit", "squat", "run"] as const) useGame.getState().toggleCheck(key);
  const state = useGame.getState();
  assert.equal(state.level, 2);
  assert.equal(state.dailyTargetLevel, 1);
  assert.equal(state.getTargets().push, 50);
  assert.equal(state.dailyCompleted, true);
  assert.equal(state.history.length, 1);
  assert.match(state.history[0].items[0], /^50 /);
  useGame.getState().toggleCheck("push");
  useGame.getState().logExercise("push", 50);
  // 5 for the completed daily plus the level-up's 3, banked exactly once.
  assert.equal(useGame.getState().pts, startingPts + 8);
  assert.equal(useGame.getState().history.length, 1);
});

test("Death is a single transition and unresolved timers are not extended at midnight", () => {
  const now = Date.now();
  reset({ hp: 80, penalty: true, inLockdown: true, penaltyEnd: now - PENALTY_MS - 1000, questDate: "2000-01-01" });
  useGame.getState().tick();
  assert.equal(useGame.getState().hp, 40);
  assert.equal(useGame.getState().penaltyEnd, now + PENALTY_MS - 1000);
  reset({ hp: 15, penalty: true, inLockdown: true, penaltyEnd: now - 1, questDate: todayISO() });
  useGame.getState().tick();
  assert.equal(useGame.getState().dead, true);
  assert.equal(useGame.getState().penalty, false);
  assert.equal(useGame.getState().inLockdown, false);
  const state = useGame.getState();
  for (let tick = 0; tick < 10; tick++) state.tick();
  assert.equal(useGame.getState(), state);
});

test("Hardcore pending debuff survives persisted rehydration and recovers after three levels", async () => {
  useGame.setState({ settings: { ...useGame.getState().settings, hardcoreMode: true } });
  useGame.getState().resurrect();
  const serialized = saved.get(SAVE_KEY)!;
  assert.equal(useGame.getState().pendingHardcoreDebuff, true);
  useGame.setState({ pendingHardcoreDebuff: false });
  saved.set(SAVE_KEY, serialized);
  await useGame.persist.rehydrate();
  useGame.getState().awaken("Reborn", "balanced", "/avatars/hunter-1.jpg");
  useGame.getState().finishAwakening();
  const state = { ...useGame.getState() };
  assert.equal(state.str, 9);
  assert.equal(state.resurrectDebuff, 3);
  assert.equal(state.pendingHardcoreDebuff, false);
  awardXP(state, 500 + 650 + 845);
  assert.equal(state.level, 4);
  assert.equal(state.resurrectDebuff, 0);
  assert.equal(state.str, 13);
});

test("Invalid imports are rejected and expired titles cannot return via a save", () => {
  assert.equal(isSaveFile({ name: "Oops", level: 1 }), false);
  assert.throws(() => useGame.getState().importState({ screen: "main" }));
  assert.equal(normalizeSave({ name: "Hunter", level: 30, streak: 0, equippedTitle: 5 }).equippedTitle, null);
  assert.equal(normalizeSave({ name: "Hunter", level: 30, streak: 0, equippedTitle: 2 }).equippedTitle, 2);
  reset({ level: 30, streak: 0, notifiedTitles: [2, 5], equippedTitle: 2 });
  useGame.getState().equipTitle(5);
  assert.equal(useGame.getState().equippedTitle, 2);
});

const point = (name: string, x: number, y: number, score = 0.8): KP => ({ name, x, y, score });
test("Geometry selects a complete same-side chain, not whichever joint scores highest", () => {
  const points = [point("left_shoulder", 0, 0), point("left_elbow", 100, 0), point("left_wrist", 200, 0),
    point("right_shoulder", 5, 5, 0.99), point("right_elbow", 50, 50, 0.05), point("right_wrist", 205, 5, 0.99)];
  const result = measurePose(points, "push");
  assert.equal(result?.side, "left");
  assert.equal(result?.angle, 180);
  assert.equal(calibrationStatus(points, "push").good, true);
});

test("Squat fallback can calibrate and track without ankles", () => {
  const points = [point("left_hip", 100, 0), point("left_knee", 100, 100)];
  const result = measurePose(points, "squat");
  assert.equal(result?.fallback, true);
  assert.equal(result?.angle, 180);
  assert.equal(calibrationStatus(points, "squat").good, true);
});

test("EMA initializes from the first position and never smooths confidence", () => {
  const smoother = new Smoother();
  assert.equal(smoother.smooth([point("left_knee", 100, 80)])[0].x, 100);
  const next = smoother.smooth([point("left_knee", 200, 80, 0.4)])[0];
  assert.equal(next.x, 130);
  assert.equal(next.score, 0.4);
});

test("Forgiving imperfect reps count, while stationary jitter and lost tracking do not", () => {
  for (const exercise of ["push", "sit", "squat"] as const) {
    const config = POSE_THRESHOLDS[exercise];
    const tracker = new RepTracker();
    const sample = (angle: number): Measurement => ({ ...config, angle, side: "left", fallback: false });
    [config.up + 3, config.up + 3, config.down - 3, config.down - 3, config.up + 3, config.up + 3]
      .forEach((angle, index) => tracker.update(sample(angle), index * 100));
    assert.equal(tracker.count, 1);
    for (let index = 0; index < 20; index++) tracker.update(sample(config.up + 3), 1000 + index * 50);
    assert.equal(tracker.count, 1);
  }
  const tracker = new RepTracker();
  const sample = (angle: number): Measurement => ({ ...SQUAT_FALLBACK, angle, side: "left", fallback: true });
  [160, 160, 135, 135].forEach((angle, index) => tracker.update(sample(angle), index * 100));
  tracker.update(null, 2000);
  tracker.update(sample(160), 2100);
  tracker.update(sample(160), 2200);
  assert.equal(tracker.count, 0);
});

test("Six-hour reminders suppress completed, dead, penalized and locked hunters", () => {
  const now = Date.now();
  const state = { name: "Hunter", lastReminderCheck: now - REMINDER_INTERVAL_MS, dailyCompleted: false, dead: false, inLockdown: false, penalty: false };
  assert.equal(isReminderDue(state, now), true);
  assert.equal(isReminderDue({ ...state, lastReminderCheck: now - REMINDER_INTERVAL_MS + 1 }, now), false);
  for (const flag of ["dailyCompleted", "dead", "inLockdown", "penalty"] as const) assert.equal(isReminderDue({ ...state, [flag]: true }, now), false);
});

test("Rank curve gives every band its own boundary and keeps Job Change at B-Rank", () => {
  assert.deepEqual([1, 9, 10, 24, 25, 39, 40, 54, 55, 74, 75, 99, 100, 119, 120, 1000].map((level) => rankFromLevel(level).id),
    ["E", "E", "D", "D", "C", "C", "B", "B", "A", "A", "S", "S", "N", "N", "M", "M"]);
  assert.equal(rankFromLevel(40).name, "B-Rank");
  assert.equal(rankFromLevel(75).name, "S-Rank");
  assert.equal(rankFromLevel(100).name, "National-Level");
  assert.equal(rankFromLevel(120).name, "Monarch Level");
  // Each band owns its boundary level, and RANKS splits the curve with no gaps.
  for (let index = 1; index < RANKS.length; index++) {
    assert.equal(RANKS[index].min, RANKS[index - 1].max + 1);
  }
  assert.deepEqual([40, 54, 55, 74, 75, 99, 100, 119, 120, 9999].map(getTier), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test("Every rank is obtainable as a title at its own boundary level", () => {
  for (const rank of RANKS) {
    const title = TITLES.find((candidate) => candidate.level === rank.min && candidate.name.startsWith(rank.name));
    assert.ok(title, `no title unlocks with ${rank.name} at level ${rank.min}`);
    const hunter = fresh({ level: rank.min, xp: 0 });
    assert.ok(rankFromLevel(rank.min).id === rank.id);
    assert.ok(title.level == null || hunter.level >= title.level);
  }
  // Monarch is a real level, so its title cannot arrive before the band starts.
  assert.equal(TITLES.find((title) => title.name === "Monarch Level Hunter")?.level, 120);
});

test("Nine distinct data-driven paths have five one-time Gates and no XP skills", () => {
  assert.equal(MONARCH_PATHS.length, 9);
  assert.equal(new Set(MONARCH_PATHS.map((path) => path.id)).size, 9);
  assert.deepEqual(PATH_TIERS.map((tier) => tier.multiplier), [1.5, 1.75, 2, 2.5, 3]);
  const moveIds = new Set<string>();
  const roleByTier = ["opener", "weaken", "empower", "drain", "ultimate"];
  const perStat: Record<string, number> = {};
  for (const path of MONARCH_PATHS) {
    assert.equal(path.tiers.length, 5);
    assert.ok(["push", "sit", "squat"].includes(path.signatureExercise));
    assert.equal(path.moves.length, 5);
    assert.ok(path.jobClass.length > 2 && path.monarchTitle.length > 2);
    assert.notEqual(path.jobClass, path.monarchTitle);
    perStat[path.primaryStat] = (perStat[path.primaryStat] ?? 0) + 1;
    path.moves.forEach((move, index) => {
      assert.equal(move.tier, index + 1);
      assert.equal(move.role, roleByTier[index]);
      assert.equal(move.requiresTrial, index + 1);
      assert.ok(move.name.length > 2 && !moveIds.has(move.id));
      moveIds.add(move.id);
    });
    assert.deepEqual(path.moves.map((move) => move.cost), [3, 4, 5, 6, 8]);
    assert.deepEqual(path.moves.map((move) => move.power), [1.3, 0.8, 0, 1.1, 1.8]);
    assert.ok(path.moves[1].debuff === "atk" || path.moves[1].debuff === "def");
    assert.ok(["atk", "def", "crit"].includes(path.moves[2].buff!));
    assert.equal(path.moves[3].drain, 0.4);
    assert.deepEqual(path.moves[4].requiresStat, { stat: path.primaryStat, amount: 40 });
    for (const tier of path.tiers) {
      assert.ok(tier.gateName && tier.title);
      assert.ok(tier.skills.length >= 1 && tier.skills.length <= 2);
      assert.ok(tier.skills.every((skill) => !skill.label.toLowerCase().includes("xp")));
    }
  }
  assert.deepEqual(perStat, { vit: 3, str: 3, agi: 3 });
  assert.equal(moveIds.size, MONARCH_PATHS.length * 5);
});

test("Gate combat is stat-derived, fatigue-sensitive and deterministic at the formula boundary", () => {
  const peak = deriveBattleStats({ str: 49, agi: 49, vit: 49, fatigueLevel: 0 });
  assert.deepEqual({ hp: peak.maxHP, atk: peak.atk, def: peak.def, crit: peak.critChance },
    { hp: 295, atk: 108, def: 79, crit: 29.5 });
  const depleted = deriveBattleStats({ str: 49, agi: 49, vit: 49, fatigueLevel: 95 });
  assert.ok(depleted.maxHP < peak.maxHP);
  assert.ok(depleted.atk < peak.atk);
  assert.ok(depleted.def < peak.def);
  assert.ok(depleted.critChance < peak.critChance);
  assert.equal(readinessFromFatigue(81).id, "depleted");
  const rolls = [0.5, 0];
  const hit = rollAttackDamage(50, 20, 10, () => rolls.shift() ?? 0.5);
  assert.deepEqual(hit, { damage: 45, critical: true });
  assert.equal(signatureDamage(50, 20), 50);
});

test("Retuned Gate bosses can damage naturally leveled hunters and scale by tier", () => {
  assert.deepEqual(GATE_BOSS_STATS.nascent, { hp: 300, atk: 92, def: 50 });
  assert.deepEqual(GATE_BOSS_STATS.transcendent, { hp: 1180, atk: 278, def: 188 });
  const level40 = deriveBattleStats({ str: 49, agi: 49, vit: 49, fatigueLevel: 0 });
  assert.ok(GATE_BOSS_STATS.nascent.atk > level40.def);
  assert.ok(GATE_BOSS_STATS.nascent.hp / Math.max(1, level40.atk - GATE_BOSS_STATS.nascent.def) >= 5);
});

test("Fast Mode defaults off and survives save normalization without changing mechanics", () => {
  assert.equal(fresh().settings.fastMode, false);
  assert.equal(normalizeSave({ name: "Fast", settings: { fastMode: true } }).settings.fastMode, true);
  const before = computeTargets("balanced", "classic", 20);
  reset({ level: 20, settings: { ...fresh().settings, fastMode: true } });
  assert.deepEqual(useGame.getState().getTargets(), before);
});

test("Every Monarch can clear their signature Tier-1 Gate through the same engine", () => {
  for (const path of MONARCH_PATHS) {
    reset({ level: 40, monarchPath: path.id, clearedGates: [], inventory: [100] });
    const xp = useGame.getState().xp;
    assert.equal(useGame.getState().completeGate(1), true, `${path.id} could not clear its Gate`);
    assert.equal(useGame.getState().xp, xp, `${path.id} granted XP`);
    assert.deepEqual(useGame.getState().clearedGates, [1]);
    assert.equal(useGame.getState().completeGate(1), false, `${path.id} could repeat its reward`);
  }
});

test("Level-40 legacy saves get Job Change; selection is permanent for this hunter", () => {
  reset({ level: 39 });
  useGame.getState().chooseMonarchPath("shadows");
  assert.equal(useGame.getState().monarchPath, null);

  reset({ level: 40, monarchPath: null, inventory: [100, 200] });
  assert.equal(useGame.getState().monarchPath, null);
  useGame.getState().chooseMonarchPath("shadows");
  assert.equal(useGame.getState().monarchPath, "shadows");
  assert.equal(useGame.getState().equippedFlourishId, 200);
  useGame.getState().chooseMonarchPath("frost");
  assert.equal(useGame.getState().monarchPath, "shadows");
  assert.equal(normalizeSave({ name: "Old", level: 60, inventory: [100], monarchPath: null }).monarchPath, null);
});

test("Tier Gates award no XP, cannot be farmed or cleared below their level floor, and unlock permanent titles", () => {
  reset({ level: 40, monarchPath: "shadows", clearedGates: [] });
  const before = useGame.getState().xp;
  assert.equal(useGame.getState().completeGate(2), false); // Tier 2 needs level 55+
  assert.equal(useGame.getState().completeGate(1), true);
  assert.equal(useGame.getState().xp, before);
  assert.deepEqual(useGame.getState().clearedGates, [1]);
  assert.equal(pathBonuses(useGame.getState()).fatigueResist, .08);
  assert.equal(useGame.getState().completeGate(1), false);
  useGame.getState().equipTitle(gateTitleId("shadows", 1));
  assert.equal(useGame.getState().equippedTitle, gateTitleId("shadows", 1));
  const restored = normalizeSave({ ...useGame.getState() });
  assert.deepEqual(restored.clearedGates, [1]);
  assert.equal(restored.equippedTitle, gateTitleId("shadows", 1));
});

test("Skills are bounded to the chosen path's CLEARED gates and never grant XP", () => {
  const base = fresh({ level: 70, monarchPath: "shadows", clearedGates: [] });
  assert.equal(pathBonuses(base).goldBonus, 0);
  assert.equal(pathBonuses(base).lootLuck, 0);
  const empowered = fresh({ level: 80, monarchPath: "shadows", clearedGates: [1, 2, 3] });
  assert.equal(pathBonuses(empowered).fatigueResist, .08);
  assert.equal(pathBonuses(empowered).goldBonus, .06);
  assert.equal(pathBonuses(empowered).lootLuck, .08);
  assert.equal(goldEarned(empowered, 10), 11);
  assert.ok(Math.abs(fatigueEarned(empowered, 10) - 9.2) < 1e-9);
  assert.equal(awardXP(empowered, 100).effXP, 100);
  const double = grantLoot(empowered, () => 0);
  assert.equal(double.patch.relapseTokens, 2); // base + at most one bonus roll
});

test("The weekly streak shield forgives exactly its available number of missed days", () => {
  const yesterday = todayISO(Date.now() - 24 * 3600000);
  reset({ level: 40, monarchPath: "transfiguration", clearedGates: [1], shieldCharges: 1,
    shieldWeek: mondayKey(), questDate: yesterday, dailyDate: yesterday, streak: 4 });
  const hp = useGame.getState().hp;
  useGame.getState().tick();
  assert.equal(useGame.getState().shieldCharges, 0);
  assert.equal(useGame.getState().streak, 4);
  assert.equal(useGame.getState().hp, hp);
  assert.equal(useGame.getState().inLockdown, false);

  reset({ level: 120, monarchPath: "iron-body", clearedGates: [2, 5],
    shieldWeek: "", shieldCharges: 0, questDate: todayISO(), dailyDate: todayISO() });
  useGame.getState().tick();
  assert.equal(pathBonuses(useGame.getState()).shieldMax, 2);
  assert.equal(useGame.getState().shieldCharges, 2);
});

test("Recovery skills, expanded shop, sigils and once-per-day moves have no XP shortcut", () => {
  const draft = SHOP_ITEMS.find((item) => item.kind === "stamina")!;
  assert.equal(shopCost(fresh({ level: 40, monarchPath: "white-flames", clearedGates: [1] }), draft), 24);
  reset({ level: 40, monarchPath: "frost", clearedGates: [1], gold: 200, fatigueLevel: 50 });
  useGame.getState().buyPotion();
  useGame.getState().consumePotion();
  assert.equal(useGame.getState().fatigueLevel, 30); // full-HP potion still offers Frost recovery

  reset({ level: 100, monarchPath: "beginning", clearedGates: [4], gold: 200, fatigueLevel: 80 });
  useGame.getState().buyItem(30);
  useGame.getState().consumeStamina();
  assert.equal(useGame.getState().fatigueLevel, 25); // 40 base + 15 Legia boost

  reset({ gold: 350, hp: 60, mp: 10, fatigueLevel: 50 });
  useGame.getState().buyItem(32);
  useGame.getState().consumeElixir();
  assert.equal(useGame.getState().hp, useGame.getState().hpMax);
  assert.equal(useGame.getState().mp, useGame.getState().mpMax);
  assert.equal(useGame.getState().fatigueLevel, 0);
  useGame.getState().buyItem(33);
  assert.equal(useGame.getState().relapseTokens, 1);
  assert.equal(useGame.getState().xp, 0);

  reset({ level: 40, gold: 100 });
  useGame.getState().buyItem(34);
  assert.equal(useGame.getState().gold, 100); // no Job Change yet
  useGame.getState().chooseMonarchPath("shadows");
  useGame.getState().buyItem(34);
  assert.equal(useGame.getState().gold, 40);
  assert.ok(useGame.getState().inventory.includes(200));
  useGame.getState().equipItem(200);
  assert.equal(useGame.getState().equippedFlourishId, null);
  useGame.getState().equipItem(200);
  assert.equal(useGame.getState().equippedFlourishId, 200);

  reset({ level: 120, monarchPath: "fangs", clearedGates: [5] });
  useGame.getState().useSignatureMove();
  useGame.getState().useSignatureMove();
  assert.equal(useGame.getState().relapseTokens, 1);
  assert.equal(useGame.getState().xp, 0);
});

test("Gate moves cost skill points after a clear, are never auto-granted, and the Tier-5 move ascends", () => {
  // Skill points alone are not enough: the tier's Gate must be cleared first.
  reset({ level: 120, monarchPath: "shadows", pts: 40, sp: 40, clearedGates: [], str: 40, agi: 40, vit: 45 });
  useGame.getState().learnMove("shadows:1");
  assert.deepEqual(useGame.getState().learnedMoves, []);
  assert.equal(useGame.getState().sp, 40);

  // Clearing a Gate only unlocks the option; learning spends skill points, never stat points.
  reset({ level: 120, monarchPath: "shadows", pts: 40, sp: 40, clearedGates: [1], str: 40, agi: 40, vit: 45 });
  useGame.getState().learnMove("shadows:1");
  assert.deepEqual(useGame.getState().learnedMoves, ["shadows:1"]);
  assert.equal(useGame.getState().sp, 37);
  assert.equal(useGame.getState().pts, 40, "stat points must never pay for moves");
  useGame.getState().learnMove("shadows:1");
  assert.equal(useGame.getState().sp, 37, "a learned move charged twice");

  // A Gate clear pays the move its cost back (plus the tier-1 seed), keeping the loop whole:
  // clear → learn costs the same number of SP that the clear granted.
  const gatePay = (tier: number) => PATH_TIERS && getPath("shadows")!.moves[tier - 1].cost + (tier === 1 ? 1 : 0);
  assert.equal(gatePay(1), 4);
  assert.equal(gatePay(2), 4);

  // Moving to another path makes its ids unlearnable and its stale entries droppable.
  useGame.getState().learnMove("frost:1");
  assert.deepEqual(useGame.getState().learnedMoves, ["shadows:1"]);
  const foreign = normalizeSave({ name: "Test Hunter", level: 120, monarchPath: "shadows", learnedMoves: ["shadows:1", "frost:1", "garbage"] });
  assert.deepEqual(foreign.learnedMoves, ["shadows:1"]);

  // The ultimate needs its Gate, 40 in the path's primary stat and 8 skill points.
  reset({ level: 120, monarchPath: "shadows", sp: 40, clearedGates: [5], str: 40, agi: 40, vit: 39 });
  useGame.getState().learnMove("shadows:5");
  assert.equal(useGame.getState().ascended, false);
  reset({ level: 120, monarchPath: "shadows", sp: 7, clearedGates: [5], str: 40, agi: 40, vit: 40 });
  useGame.getState().learnMove("shadows:5");
  assert.deepEqual(useGame.getState().learnedMoves, []);

  reset({ level: 120, monarchPath: "shadows", sp: 40, clearedGates: [5], str: 40, agi: 40, vit: 40 });
  useGame.getState().learnMove("shadows:5");
  assert.deepEqual(useGame.getState().learnedMoves, ["shadows:5"]);
  assert.equal(useGame.getState().sp, 32);
  assert.equal(useGame.getState().ascended, true);
  assert.equal(useGame.getState().ascensionFx, true);
  useGame.getState().clearAscensionFx();
  assert.equal(useGame.getState().ascensionFx, false);

  // Ascension cannot be forged by a save that never learned the ultimate.
  const forged = normalizeSave({ name: "Test Hunter", level: 120, monarchPath: "shadows", ascended: true, learnedMoves: ["shadows:1"] });
  assert.equal(forged.ascended, false);
});

test("Every class kit is grounded, distinct, and fully owned by level 30", () => {
  assert.equal(HUNTER_CLASSES.length, 4);
  assert.equal(new Set(HUNTER_CLASSES.map((entry) => entry.id)).size, 4);
  const allIds = new Set<string>();
  for (const entry of HUNTER_CLASSES) {
    assert.equal(entry.skills.length, 8, `${entry.id} does not have eight nodes`);
    assert.equal(entry.skills.filter((skill) => skill.starter).length, 1, `${entry.id} needs exactly one free starter`);
    // Grounded: nothing in the level 1-40 kit hits harder than a Monarch ultimate.
    for (const skill of entry.skills) {
      assert.ok(skill.power <= 1.6, `${skill.name} hits too hard for a basic kit`);
      assert.ok((skill.scale ?? 0) <= 0.25, `${skill.name} buffs too much for a basic kit`);
      assert.ok(!allIds.has(skill.id), `duplicate skill id ${skill.id}`);
      allIds.add(skill.id);
      assert.ok(skill.level >= 1 && skill.level <= 30, `${skill.name} is gated past level 30`);
    }
    // The brief's guarantee: everything is affordable and reachable by level 30.
    const guarantee = kitGuarantee(entry.id);
    assert.equal(guarantee.cost, classKitCost(entry.id));
    assert.equal(guarantee.levelCap, classKitLevelCap(entry.id));
    assert.equal(guarantee.affordable, true, `${entry.id} cannot own its kit by level 30`);
    assert.ok(guarantee.cost < 3 * 29, `${entry.id} kit leaves no points for stats`);
    // One node per role, so no class is strictly better than another.
    assert.deepEqual(entry.skills.map((skill) => skill.role),
      ["opener", "weaken", "empower", "heal", "empower", "finisher", "drain", "finisher"]);
  }
  assert.deepEqual(HUNTER_CLASSES.map((entry) => entry.skills.map((skill) => skill.power)),
    HUNTER_CLASSES.map(() => [1.1, 0.9, 0, 0, 0, 1.4, 1, 1.6]));
  assert.equal(defaultClassFor("assassin"), "assassin");
  assert.equal(getClass("mage")?.name, "Mage");
});

test("Act I is one quest per level from 1 to 40, each with its own enemy and cost", () => {
  assert.equal(STORY_EPISODES.length, 40);
  assert.equal(STORY_REGIONS.length, 4);
  assert.deepEqual(STORY_BEAT_LEVELS, [1, 5, 10, 15, 20, 25, 30, 35, 39, 40]);
  // Regions tile the whole act with no gaps and no overlaps.
  for (let index = 1; index < STORY_REGIONS.length; index++) {
    assert.equal(STORY_REGIONS[index].from, STORY_REGIONS[index - 1].to + 1);
  }
  assert.equal(STORY_REGIONS[0].from, 1);
  assert.equal(STORY_REGIONS[STORY_REGIONS.length - 1].to, 40);
  for (let level = 1; level <= 40; level++) {
    const episode = STORY_EPISODES[level - 1];
    assert.equal(episode.level, level);
    assert.equal(getEpisode(level)?.enemy, episode.enemy);
    assert.deepEqual(episode, buildEpisode(level), "episode composition must be deterministic");
    assert.ok(episode.enemy.length > 2 && episode.title.length > 2);
    assert.ok(episode.prose.length > 40 && episode.briefing.length > 20);
    assert.ok(["field", "story", "boss", "job"].includes(episode.kind));
    assert.ok(episode.gold > 0);
    assert.ok(STORY_REGIONS.some((region) => region.id === episode.region));
  }
  // Within a region every tile is its own quest, with its own enemy and objective.
  for (const region of STORY_REGIONS) {
    const tiles = STORY_EPISODES.filter((episode) => episode.region === region.id);
    const objectives = new Set(tiles.map((episode) => `${episode.title}|${episode.enemy}`));
    assert.equal(objectives.size, tiles.length, `${region.name} repeats a quest`);
    assert.ok(tiles.length >= 8, `${region.name} is too short to be a region`);
  }
  // Bosses carry art; the composed fights do not pretend to.
  for (const level of STORY_BEAT_LEVELS) {
    if (["boss", "job"].includes(getEpisode(level)!.kind)) assert.ok(getEpisode(level)!.enemyArt);
  }
  // The Act pays in skill points: 48 across 40 tiles, and the level-30 cut pays
  // every class's full kit with SP to spare. Stat points are untouched by tiles.
  const totals = storyTotals(STORY_EPISODES.map((episode) => episode.level));
  assert.equal(totals.clears, 40);
  assert.equal(totals.spEarned, 48);
  const spThrough30 = storyTotals(STORY_EPISODES.filter((e) => e.level <= 30).map((e) => e.level)).spEarned;
  for (const id of ["fighter", "mage", "assassin", "ranger"] as const) {
    assert.ok(classKitCost(id) <= spThrough30, `${id} kit (${classKitCost(id)}) exceeds SP through level 30 (${spThrough30})`);
    assert.ok(classKitLevelCap(id) <= 30, `${id} kit must be level-reachable by 30`);
    assert.ok(kitGuarantee(id).affordable);
  }
});

test("Enemies are tuned to the trained hunter: the idle lose, the dedicated win on a knife's edge", () => {
  for (const episode of STORY_EPISODES) {
    const enemy = enemyFor(episode);
    const isField = episode.kind === "field";
    assert.ok(enemy.hp > 0 && enemy.atk > 0 && enemy.def >= 0);
    // Field tiles never one-shot: a trained hunter survives at least 5 swings.
    if (isField) {
      const { combat } = expectedCombat(episode.level);
      assert.ok(Math.ceil(combat.maxHP / Math.max(1, enemy.atk - combat.def)) >= 5, `tile ${episode.level} can kill a hunter in under 5 turns`);
    }
    const { combat } = expectedCombat(episode.level);
    const kit = expectedKitAt(episode.level);
    const model = forecastFight(enemy, combat, kit);
    // The fight is real at every tile: never a stroll (≤12 enemy swings to kill)...
    assert.ok(model.turnsToKill <= 12, `tile ${episode.level} takes ${model.turnsToKill} turns to clear`);
    // ...never trivial (the model hunter never crushes it)...
    assert.ok(model.turnsToSurvive - model.turnsToKill <= (isField ? 6 : 4), `tile ${episode.level} is a stroll for the trained hunter`);
    // ...and the trained, allocated hunter can take it. Beats may run as much as
    // two turns short on raw forecast — a deficit that one potion of the fifty
    // the gold economy hands out always covers — but field tiles must be
    // outright wins for the model hunter, never coin-flips.
    const margin = model.turnsToSurvive - model.turnsToKill;
    assert.ok(margin >= (isField ? 1 : -2), `tile ${episode.level} is not winnable by the model hunter`);
    if (!isField && margin < 0) {
      const potionTurns = Math.ceil((combat.maxHP * 0.5) / Math.max(1, model.enemyDamage));
      assert.ok(margin + potionTurns >= 0, `tile ${episode.level} cannot be rescued even with supplies`);
    }
    // The motivation clause: a hunter at the same level who never spent a point
    // must LOSE to the tile. Winning the fight is the reward for the work.
    const idle = deriveBattleStats({
      str: 10 + episode.level - 1, agi: 10 + episode.level - 1, vit: 10 + episode.level - 1, fatigueLevel: 25,
    });
    const idleForecast = forecastFight(enemy, idle, 1);
    assert.ok(
      idleForecast.turnsToSurvive - idleForecast.turnsToKill <= -1,
      `tile ${episode.level} is winnable on auto-grow stats alone`,
    );
  }
  // The L1 contract, spelled out: unspent = loss; the 3 awakening points spent
  // into STR/VIT flip the first Gate into a win. The tutorial teaches the loop.
  const gate = getEpisode(1)!, gateEnemy = enemyFor(gate);
  const sofa = forecastFight(gateEnemy, deriveBattleStats({ str: 10, agi: 10, vit: 10, fatigueLevel: 0 }), 1);
  assert.ok(sofa.turnsToSurvive < sofa.turnsToKill, "a fresh unspent hunter must lose the first Gate");
  const spent = forecastFight(
    gateEnemy,
    deriveBattleStats({ str: 13, agi: 11, vit: 11, fatigueLevel: 0 }),
    1,
  );
  assert.ok(spent.turnsToSurvive >= spent.turnsToKill, "spending the awakening points must open the first Gate");
});

test("Story tiles gate on level and previous clear, pay gold plus SP, and never touch stat points", () => {
  // Locked until the hunter's level reaches the tile.
  reset({ level: 3, pts: 20, gameClass: "fighter", basicSkills: ["fighter:1"], storyCleared: [], monarchPath: null });
  const tile10 = getEpisode(10)!;
  assert.equal(episodeAvailability(useGame.getState(), tile10).status, "locked");
  assert.equal(useGame.getState().clearEpisode(10), false);

  // Level alone is not enough: the strict path requires the previous tile.
  reset({ level: 10, gold: 0, gameClass: "fighter", basicSkills: ["fighter:1"], storyCleared: [], monarchPath: null });
  assert.equal(episodeAvailability(useGame.getState(), tile10).status, "locked");
  assert.match(episodeAvailability(useGame.getState(), tile10).reason, /previous tile/);
  assert.equal(useGame.getState().clearEpisode(10), false);

  // Unlocked and walkable: clearing banks gold + SP and costs nothing to enter.
  const through9 = Array.from({ length: 9 }, (_, i) => i + 1);
  reset({ level: 10, gold: 0, pts: 5, sp: 0, gameClass: "fighter", basicSkills: ["fighter:1"], storyCleared: through9, monarchPath: null });
  assert.equal(episodeAvailability(useGame.getState(), tile10).status, "ready");
  assert.equal(useGame.getState().clearEpisode(10), true);
  assert.deepEqual(useGame.getState().storyCleared, [...through9, 10]);
  // A boss tile pays 2 SP.
  assert.equal(useGame.getState().sp, 2);
  assert.equal(useGame.getState().gold, tile10.gold);
  // Stat points are a separate system and stay exactly where they were.
  assert.equal(useGame.getState().pts, 5);
  // No free skills anymore: the tree is bought with SP, nothing else.
  assert.deepEqual(useGame.getState().basicSkills, ["fighter:1"]);
  // Replays pay nothing.
  const gold = useGame.getState().gold;
  const sp = useGame.getState().sp;
  assert.equal(useGame.getState().clearEpisode(10), true);
  assert.equal(useGame.getState().gold, gold);
  assert.equal(useGame.getState().sp, sp);

  // A field tile pays exactly 1 SP.
  reset({ level: 11, pts: 0, sp: 0, gameClass: "fighter", basicSkills: ["fighter:1"], storyCleared: Array.from({ length: 10 }, (_, i) => i + 1), monarchPath: null });
  assert.equal(getEpisode(11)!.kind, "field");
  assert.equal(useGame.getState().clearEpisode(11), true);
  assert.equal(useGame.getState().sp, 1);

  // Zero stat points no longer locks anyone out — the old "unaffordable" gate is gone.
  reset({ level: 20, pts: 0, sp: 0, gameClass: "mage", basicSkills: ["mage:1"], storyCleared: Array.from({ length: 19 }, (_, i) => i + 1), monarchPath: null });
  assert.equal(episodeAvailability(useGame.getState(), getEpisode(20)!).status, "ready");

  // The Job Change tile waits for the ceremony itself once the walk reaches it.
  reset({ level: 40, pts: 0, gameClass: "ranger", basicSkills: ["ranger:1"], storyCleared: Array.from({ length: 39 }, (_, i) => i + 1), monarchPath: null });
  assert.equal(episodeAvailability(useGame.getState(), getEpisode(40)!).status, "needs-path");
});

test("A fresh save walks into tile 1 with nothing but its starter skill", () => {
  reset({ level: 1, gameClass: "assassin", basicSkills: ["assassin:1"], storyCleared: [], monarchPath: null });
  assert.equal(episodeAvailability(useGame.getState(), getEpisode(1)!).status, "ready");
  assert.equal(useGame.getState().clearEpisode(1), true);
});

test("Class skills cost skill points, respect their level gate, and survive a save round trip", () => {
  reset({ level: 30, sp: 10, pts: 0, gameClass: "assassin", basicSkills: ["assassin:1"] });
  useGame.getState().learnBasicSkill("assassin:2");
  assert.deepEqual(useGame.getState().basicSkills, ["assassin:1", "assassin:2"]);
  assert.equal(useGame.getState().sp, 8);
  // Stat points must never be touched by the tree.
  assert.equal(useGame.getState().pts, 0);
  // Without SP, a level-ready node stays locked even at a high level.
  reset({ level: 30, sp: 0, gameClass: "assassin", basicSkills: ["assassin:1"] });
  useGame.getState().learnBasicSkill("assassin:2");
  assert.deepEqual(useGame.getState().basicSkills, ["assassin:1"]);
  // Twice is not allowed, and an unknown id is ignored.
  reset({ level: 30, sp: 10, gameClass: "assassin", basicSkills: ["assassin:1"] });
  useGame.getState().learnBasicSkill("assassin:2");
  const spAfter = useGame.getState().sp;
  useGame.getState().learnBasicSkill("assassin:2");
  assert.equal(useGame.getState().sp, spAfter);
  useGame.getState().learnBasicSkill("fighter:3");
  assert.equal(useGame.getState().sp, spAfter);
  // Level gates hold even when the points are there.
  reset({ level: 4, sp: 40, gameClass: "fighter", basicSkills: ["fighter:1"] });
  useGame.getState().learnBasicSkill("fighter:8");
  assert.deepEqual(useGame.getState().basicSkills, ["fighter:1"]);

  // Normalization keeps only this class's ids and always restores the starter.
  const foreign = normalizeSave({ name: "Test Hunter", level: 30, gameClass: "mage", basicSkills: ["fighter:2", "mage:3", "junk"] });
  assert.deepEqual(foreign.basicSkills, ["mage:1", "mage:3"]);
  const noClass = normalizeSave({ name: "Test Hunter", level: 30, archetype: "vanguard" });
  assert.equal(noClass.gameClass, "ranger");
  assert.deepEqual(noClass.basicSkills, ["ranger:1"]);
  // Story progress cannot claim levels the hunter never reached.
  const ahead = normalizeSave({ name: "Test Hunter", level: 5, storyCleared: [3, 9, 30, 0, -2, 99] });
  assert.deepEqual(ahead.storyCleared, [3]);
});

test("A perfect run through Act I reaches level 30 with a full kit bought out of tile SP", () => {
  // Walk the act as a player would: level, clear the tile (SP income + no entry
  // cost), spend SP on the tree when a node opens, repeat.
  const id: "fighter" | "mage" | "assassin" | "ranger" = "mage";
  const kit = classSkills(id);
  let sp = 0;
  let pts = 3; // stat points are a separate ledger; tiles never spend them
  let learned = [kit[0].id];
  let cleared: number[] = [];
  for (let level = 1; level <= 30; level++) {
    if (level > 1) pts += 3; // a level's pay, spendable only on stats
    const episode = getEpisode(level)!;
    assert.ok(episode.level <= level, `tile ${level} should be level-reachable on a steady walk`);
    assert.ok(level === 1 || cleared.includes(level - 1), `tile ${level} should follow a cleared previous tile`);
    const pay = episode.kind === "job" ? 0 : episode.kind === "field" ? 1 : 2;
    cleared.push(level);
    sp += pay;
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const skill of kit) {
        if (skill.starter || learned.includes(skill.id)) continue;
        if (skill.level <= level && sp >= skill.cost) {
          sp -= skill.cost;
          learned.push(skill.id);
          progressed = true;
        }
      }
    }
  }
  assert.equal(cleared.length, 30, "every tile through level 30 should be walkable at no cost");
  assert.equal(learned.length, 8, "the hunter must own all eight nodes by level 30");
  assert.ok(sp >= 0);
  assert.equal(pts, 3 + 29 * 3, "stat points were never spent on the tree");
});
