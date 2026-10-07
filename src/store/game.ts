import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  GameState,
  ArchetypeId,
  ExerciseKey,
  StatKey,
  Tab,
  SlNotification,
  PactStake,
  PenaltyTargets,
  PathId,
  TierNumber,
  GameClassId,
} from "../types";
import {
  ARCHETYPES,
  computeTargets,
  computePenaltyTargets,
  SHOP_ITEMS,
  ITEMS,
  SPECIAL_QUESTS,
  STARTER_THEME_ID,
  TITLES,
  getItem,
} from "../data";
import { getPath, MONARCH_PATHS, PATH_FLOURISH_IDS, PATH_TIERS } from "../data/monarchPaths";
import { fatigueEarned, goldEarned, isPathTitleValid, mondayKey, pathBonuses, shopCost } from "../lib/monarch";
const HUNTER_CLASS_IDS: GameClassId[] = ["fighter", "mage", "assassin", "ranger"];

import { findMove, moveUnlockReason, pathMoves, spendMovePoints } from "../lib/moves";
import { classSkills, defaultClassFor, getClass } from "../data/classes";
import { getEpisode } from "../data/story";
import { episodeAvailability, skillLockReason, spendSkillPoints } from "../lib/story";
import {
  PENALTY_MS,
  SAVE_KEY,
  clamp,
  todayISO,
} from "../lib/utils";
import { audio, startDrone, stopDrone, voice } from "../lib/audio";
import { shake, flash, fct, fctBurst } from "../lib/juice";
import { grantLoot } from "../lib/loot";
import { awardXP } from "../lib/progression";

interface FxState {
  levelUpFx: boolean;
  rankUpFx: string | null;
  gateClearFx: { path: PathId; tier: TierNumber } | null;
  ascensionFx: boolean;
  dead: boolean;
  deathCause: string;
  deathConfirm: boolean;
}

interface Actions {
  awaken: (name: string, archetype: ArchetypeId, avatar: string, gameClass?: GameClassId) => void;
  finishAwakening: () => void;
  /** The Awakening class pick. Grants the class's free starter skill. */
  chooseGameClass: (id: GameClassId) => void;
  /** Spends stat points on a node of the basic class tree. */
  learnBasicSkill: (id: string) => void;
  /** Spends the tile's points and banks its rewards. Returns false if it was not ready. */
  clearEpisode: (level: number) => boolean;
  chooseMonarchPath: (path: PathId) => void;
  completeGate: (tier: TierNumber) => boolean;
  useSignatureMove: () => void;
  /** Spends stat points to learn one drafted Gate move. Never auto-grants. */
  learnMove: (id: string) => void;
  setTab: (t: Tab) => void;
  setAvatar: (a: string) => void;
  // quest
  getTargets: () => Record<ExerciseKey, number>;
  getPenaltyTargets: () => PenaltyTargets;
  lockDailyTargets: () => void;
  logExercise: (key: ExerciseKey, amount: number, verified?: boolean) => void;
  toggleCheck: (key: ExerciseKey) => void;
  // stats
  allocateStat: (stat: StatKey) => void;
  // economy
  buyPotion: () => void;
  buyItem: (id: number) => void;
  equipItem: (id: number) => void;
  consumePotion: () => void;
  consumeStamina: () => void;
  consumeElixir: () => void;
  equipTitle: (id: number | string) => void;
  // reward
  claimReward: (kind: "status" | "stat" | "loot", stat?: StatKey) => void;
  // penalty / death
  consumeToken: () => void;
  submitPenalty: (push: number, sit: number, run: number) => void;
  resurrect: () => void;
  requestOblivion: () => void;
  // special
  completeSpecial: () => void;
  dismissSpecial: () => void;
  // notifications
  notify: (n: SlNotification) => void;
  dismissNotify: () => void;
  // settings
  toggleAdaptive: () => void;
  toggleHardcore: () => void;
  toggleVoice: () => void;
  toggleShake: () => void;
  toggleFloaters: () => void;
  toggleFastMode: () => void;
  setRemindersEnabled: (enabled: boolean) => void;
  // blood pact
  swearPact: (stake: PactStake, witness: string, terms: string) => void;
  dissolvePact: () => void;
  // fx
  clearLevelUpFx: () => void;
  clearRankUpFx: () => void;
  clearGateFx: () => void;
  clearAscensionFx: () => void;
  // system
  tick: () => void;
  importState: (data: unknown) => void;
  hardReset: () => void;
  // internal helpers exposed for camera
  addPenaltyProgress: (key: "push" | "sit", amount: number) => void;
}

export type Store = GameState & FxState & Actions;

function computeMax(vit: number) {
  return { hpMax: 100 + vit * 10, mpMax: 50 + vit * 3 };
}

function defaultState(): GameState {
  const vit = 10;
  const { hpMax, mpMax } = computeMax(vit);
  return {
    screen: "intro",
    tab: "quest",
    name: "",
    archetype: "balanced",
    avatar: "/avatars/hunter-1.jpg",
    level: 1,
    pts: 3,
    sp: 0,
    streak: 0,
    hp: hpMax,
    hpMax,
    mp: mpMax,
    mpMax,
    xp: 0,
    xpMax: 500,
    str: 10,
    agi: 10,
    vit,
    penalty: false,
    penaltyEnd: 0,
    penPushDone: 0,
    penSitDone: 0,
    penRunDone: false,
    penaltyTargets: null,
    inLockdown: false,
    relapseTokens: 0,
    dailyDate: todayISO(),
    questDate: todayISO(),
    push: 0,
    sit: 0,
    squat: 0,
    run: 0,
    pushDone: false,
    sitDone: false,
    squatDone: false,
    runDone: false,
    dailyCompleted: false,
    dailyTargetLevel: null,
    lastReminderCheck: Date.now(),
    dayMode: "classic",
    gold: 0,
    potions: 0,
    staminaDrafts: 0,
    inventory: [STARTER_THEME_ID],
    equippedTitle: 0,
    notifiedTitles: [0],
    hudTheme: "system-blue",
    equippedFlourishId: null,
    gameClass: null,
    basicSkills: [],
    storyCleared: [],
    monarchPath: null,
    clearedGates: [],
    gateClears: [],
    learnedMoves: [],
    ascended: false,
    shieldCharges: 0,
    shieldWeek: "",
    signatureUsedDate: "",
    elixirs: 0,
    fatigueLevel: 0,
    specialActive: false,
    specialQuest: null,
    rewardChoicePending: false,
    resurrectDebuff: 0,
    pendingHardcoreDebuff: false,
    history: [],
    notifications: [],
    settings: {
      adaptiveMode: false,
      hardcoreMode: false,
      voiceCounting: false,
      screenShake: true,
      floatingNumbers: true,
      remindersEnabled: false,
      fastMode: false,
    },
    pact: {
      active: false,
      stake: "witness",
      witness: "",
      terms: "",
      sworn: 0,
      breaches: 0,
    },
    pactLedger: [],
  };
}

/** Whitelist save data so removed equipment and stale action names cannot return. */
export function normalizeSave(input: unknown): GameState {
  const fresh = defaultState();
  if (!input || typeof input !== "object" || Array.isArray(input)) return fresh;
  const saved = input as Record<string, unknown>;
  const result = fresh as unknown as Record<string, unknown>;

  for (const key of Object.keys(fresh)) {
    const value = saved[key];
    const fallback = result[key];
    if (typeof fallback === "number" && typeof value === "number" && Number.isFinite(value)) {
      result[key] = Math.max(0, value);
    } else if (typeof fallback === "string" && typeof value === "string") {
      result[key] = value;
    } else if (typeof fallback === "boolean" && typeof value === "boolean") {
      result[key] = value;
    } else if (Array.isArray(fallback) && Array.isArray(value)) {
      result[key] = value;
    }
  }

  const defaults = defaultState().settings;
  const settings = saved.settings && typeof saved.settings === "object"
    ? saved.settings as Record<string, unknown>
    : {};
  fresh.settings = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = settings[key];
    if (typeof value === typeof defaults[key]) {
      (fresh.settings as unknown as Record<string, unknown>)[key] = value;
    }
  }

  fresh.archetype = saved.archetype && Object.prototype.hasOwnProperty.call(ARCHETYPES, String(saved.archetype))
    ? saved.archetype as ArchetypeId
    : "balanced";
  fresh.monarchPath = getPath(typeof saved.monarchPath === "string" ? saved.monarchPath as PathId : null)?.id ?? null;
  fresh.clearedGates = Array.isArray(saved.clearedGates) && fresh.monarchPath
    ? [...new Set(saved.clearedGates.filter((tier): tier is TierNumber =>
        Number.isInteger(tier) && tier >= 1 && tier <= 5 && PATH_TIERS[tier - 1].min <= fresh.level))].sort() as TierNumber[]
    : [];
  fresh.equippedFlourishId = typeof saved.equippedFlourishId === "number"
    && PATH_FLOURISH_IDS.includes(saved.equippedFlourishId)
    && fresh.inventory.includes(saved.equippedFlourishId)
    && getItem(saved.equippedFlourishId)?.pathFlourish === fresh.monarchPath
    ? saved.equippedFlourishId : null;
  fresh.gateClears = Array.isArray(saved.gateClears)
    ? fresh.clearedGates.map((tier) => {
        const entry = (saved.gateClears as unknown[]).find(
          (row): row is { tier: TierNumber; date: string } =>
            !!row && typeof row === "object" && (row as { tier?: unknown }).tier === tier
            && typeof (row as { date?: unknown }).date === "string");
        return { tier, date: entry?.date ?? "" };
      })
    : fresh.clearedGates.map((tier) => ({ tier, date: "" }));
  // Class kit and story progress. A save from before the class pick falls back to
  // the class closest to its archetype rather than losing its tree.
  fresh.gameClass = HUNTER_CLASS_IDS.includes(saved.gameClass as GameClassId)
    ? saved.gameClass as GameClassId
    : defaultClassFor(fresh.archetype);
  const ownedSkills = classSkills(fresh.gameClass).map((skill) => skill.id);
  fresh.basicSkills = Array.isArray(saved.basicSkills)
    ? [...new Set(saved.basicSkills.filter((id): id is string => typeof id === "string" && ownedSkills.includes(id)))]
    : [];
  const starter = classSkills(fresh.gameClass).find((skill) => skill.starter);
  if (starter && !fresh.basicSkills.includes(starter.id)) fresh.basicSkills = [starter.id, ...fresh.basicSkills];
  // Story tiles can only ever describe levels the hunter has actually reached.
  fresh.storyCleared = Array.isArray(saved.storyCleared)
    ? [...new Set(saved.storyCleared.filter((value): value is number =>
        typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= fresh.level && value <= 40))]
        .sort((a, b) => a - b)
    : [];
  // Move ids are path-scoped, so a stale id from another lineage can never return.
  const ownMoveIds = pathMoves(getPath(fresh.monarchPath)).filter((move) => move.role !== "basic").map((move) => move.id);
  fresh.learnedMoves = Array.isArray(saved.learnedMoves)
    ? [...new Set(saved.learnedMoves.filter((id): id is string => typeof id === "string" && ownMoveIds.includes(id)))]
    : [];
  const ultimateId = getPath(fresh.monarchPath)?.moves[4].id;
  fresh.ascended = saved.ascended === true && !!ultimateId && fresh.learnedMoves.includes(ultimateId);
  if (!fresh.monarchPath || fresh.level < 40) {
    fresh.monarchPath = null;
    fresh.clearedGates = [];
    fresh.gateClears = [];
    fresh.learnedMoves = [];
    fresh.ascended = false;
    fresh.equippedFlourishId = null;
  }
  fresh.inventory = [...new Set([
    STARTER_THEME_ID,
    ...fresh.inventory.filter((id) => ITEMS.some((item) => item.id === id)),
  ])];
  if (!ITEMS.some((item) => fresh.inventory.includes(item.id) && item.theme === fresh.hudTheme)) {
    fresh.hudTheme = "system-blue";
  }
  fresh.notifiedTitles = fresh.notifiedTitles.filter((id) => TITLES.some((title) => title.id === id));
  if (!fresh.notifiedTitles.includes(0)) fresh.notifiedTitles = [0, ...fresh.notifiedTitles];
  const special = saved.specialQuest as { id?: number } | null;
  fresh.specialQuest = SPECIAL_QUESTS.find((quest) => quest.id === special?.id) ?? null;
  fresh.specialActive = fresh.dailyCompleted && fresh.specialActive && fresh.specialQuest !== null;
  if (saved.pact && typeof saved.pact === "object" && !Array.isArray(saved.pact)) {
    const pact = saved.pact as Record<string, unknown>;
    const validStake = ["witness", "forfeit", "ironvow"].includes(String(pact.stake));
    fresh.pact = {
      active: validStake && pact.active === true,
      stake: validStake ? pact.stake as PactStake : "witness",
      witness: typeof pact.witness === "string" ? pact.witness.slice(0, 40) : "",
      terms: typeof pact.terms === "string" ? pact.terms.slice(0, 160) : "",
      sworn: typeof pact.sworn === "number" && Number.isFinite(pact.sworn) ? Math.max(0, pact.sworn) : 0,
      breaches: typeof pact.breaches === "number" && Number.isFinite(pact.breaches) ? Math.max(0, Math.floor(pact.breaches)) : 0,
    };
  }
  fresh.history = fresh.history.filter((entry) => entry && typeof entry.date === "string"
    && Array.isArray(entry.items) && entry.items.every((item) => typeof item === "string")
    && typeof entry.xpGain === "number" && Number.isFinite(entry.xpGain));
  fresh.pactLedger = fresh.pactLedger.filter((entry) => entry && typeof entry.date === "string"
    && typeof entry.event === "string" && typeof entry.terms === "string" && typeof entry.witness === "string"
    && ["witness", "forfeit", "ironvow"].includes(entry.stake))
    .slice(0, 100).map(({ date, event, stake, terms, witness }) => ({ date, event, stake, terms, witness }));
  fresh.level = Math.max(1, Math.floor(fresh.level));
  fresh.xpMax = Math.max(1, fresh.xpMax);
  fresh.fatigueLevel = clamp(fresh.fatigueLevel, 0, 100);
  fresh.lastReminderCheck = Math.min(Date.now(), fresh.lastReminderCheck);
  const maxima = computeMax(fresh.vit);
  fresh.hpMax = maxima.hpMax;
  fresh.mpMax = maxima.mpMax;
  fresh.hp = Math.min(fresh.hp, fresh.hpMax);
  fresh.mp = Math.min(fresh.mp, fresh.mpMax);
  // An expired or forged title clears to none, never silently to the starter
  // title. Only a save that never carried the field keeps the starting title.
  const numericTitleValid = typeof saved.equippedTitle === "number"
    && TITLES.some((title) => title.id === saved.equippedTitle
      && (title.level == null || fresh.level >= title.level)
      && (title.streak == null || fresh.streak >= title.streak));
  const pathTitleValid = typeof saved.equippedTitle === "string" && isPathTitleValid(fresh, saved.equippedTitle);
  fresh.equippedTitle = numericTitleValid || pathTitleValid
    ? saved.equippedTitle as number | string
    : typeof saved.equippedTitle === "undefined" ? 0 : null;
  fresh.shieldWeek = typeof saved.shieldWeek === "string" ? saved.shieldWeek : "";
  fresh.shieldCharges = Math.min(fresh.shieldCharges, pathBonuses(fresh).shieldMax);
  fresh.dayMode = ["classic", "recovery", "overdrive"].includes(fresh.dayMode)
    ? fresh.dayMode : "classic";
  fresh.dailyTargetLevel = typeof saved.dailyTargetLevel === "number" && Number.isFinite(saved.dailyTargetLevel)
    ? Math.max(1, Math.floor(saved.dailyTargetLevel)) : null;
  const dailyTargets = computeTargets(fresh.archetype, fresh.dayMode, fresh.dailyTargetLevel ?? fresh.level);
  const penalty = saved.penaltyTargets as Partial<PenaltyTargets> | null;
  fresh.penaltyTargets = penalty && [penalty.push, penalty.sit, penalty.run].every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)
    ? { push: penalty.push!, sit: penalty.sit!, run: penalty.run! }
    : fresh.inLockdown ? computePenaltyTargets(dailyTargets) : null;
  for (const key of ["push", "sit", "squat", "run"] as const) {
    if (!fresh.dailyCompleted) {
      fresh[key] = Math.min(fresh[key], dailyTargets[key]);
      fresh[`${key}Done`] = fresh[key] >= dailyTargets[key];
    }
  }
  fresh.screen = fresh.name ? "main" : "intro";
  fresh.tab = "quest";
  fresh.notifications = [];
  // Transient UI flags must never survive a reload (these are on the FxState slice,
  // not GameState; they are reset in importState/hardReset/onRehydrate).
  fresh.rewardChoicePending = false;
  // Saves written before the SP split have cleared tiles but never meted out the
  // skill-point income those tiles owe. Retroactively grant what a full ledger of
  // first clears would have paid, then subtract what the tree has already consumed
  // (starter skills are free and never charged).
  if (typeof saved.sp !== "number") {
    const earned = fresh.storyCleared.reduce((total: number, level: number) => {
      const ep = getEpisode(level);
      if (!ep) return total;
      return total + (ep.kind === "job" ? 0 : ep.kind === "field" ? 1 : 2);
    }, 0);
    const spentOnSkills = classSkills(fresh.gameClass)
      .filter((skill) => !skill.starter && fresh.basicSkills.includes(skill.id))
      .reduce((total: number, skill) => total + skill.cost, 0);
    const spentOnMoves = pathMoves(getPath(fresh.monarchPath))
      .filter((move) => fresh.learnedMoves.includes(move.id))
      .reduce((total: number, move) => total + move.cost, 0);
    fresh.sp = Math.max(0, earned - spentOnSkills - spentOnMoves);
  } else {
    fresh.sp = Math.max(0, Math.floor(fresh.sp));
  }
  return fresh;
}

export function isSaveFile(input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const data = input as Record<string, unknown>;
  return typeof data.name === "string" && typeof data.level === "number" && Number.isFinite(data.level) && data.level >= 1
    && typeof data.hp === "number" && Number.isFinite(data.hp)
    && typeof data.xp === "number" && Number.isFinite(data.xp)
    && Array.isArray(data.inventory) && data.inventory.every((id) => typeof id === "number" && Number.isInteger(id));
}

export const useGame = create<Store>()(
  persist(
    (set, get) => {
      // ---- internal helpers operating on a draft ----
      function queueTitleChecks(s: GameState) {
        // unlock detection
        const unlocked = TITLES.filter(
          (t) =>
            (t.level == null || s.level >= t.level) &&
            (t.streak == null || s.streak >= t.streak),
        ).map((t) => t.id);
        // new unlocks
        for (const id of unlocked) {
          if (!s.notifiedTitles.includes(id)) {
            s.notifiedTitles = [...s.notifiedTitles, id];
            const t = TITLES.find((x) => x.id === id)!;
            const hunter = s.name;
            setTimeout(() => {
              const current = get();
              if (current.name !== hunter || current.dead || !current.notifiedTitles.includes(id)
                || (t.level != null && current.level < t.level) || (t.streak != null && current.streak < t.streak)) return;
              current.notify({
                title: "Title Unlocked",
                message: `${t.icon} <b>${t.name}</b><br/>${t.desc}`,
                type: "System",
              });
            }, 2500);
          }
        }
        // Bug #6: re-validate equipped title
        if (typeof s.equippedTitle === "number" && !unlocked.includes(s.equippedTitle)) {
          s.equippedTitle = null;
        }
      }

      return {
        ...defaultState(),
        levelUpFx: false,
        rankUpFx: null,
        gateClearFx: null,
        ascensionFx: false,
        dead: false,
        deathCause: "",
        deathConfirm: false,

        awaken: (name, archetype, avatar, gameClass) => {
          const picked = gameClass ?? defaultClassFor(archetype);
          const starter = classSkills(picked).find((skill) => skill.starter);
          set({
            name: name.trim() || "Hunter",
            archetype,
            gameClass: picked,
            basicSkills: starter ? [starter.id] : [],
            avatar: avatar || "/avatars/hunter-1.jpg",
            screen: "awaken",
            lastReminderCheck: Date.now(),
          });
          audio.unlock();
        },

        chooseGameClass: (id) => {
          const s = get();
          if (s.gameClass || s.dead) return;
          const starter = classSkills(id).find((skill) => skill.starter);
          set({ gameClass: id, basicSkills: starter ? [...s.basicSkills, starter.id] : s.basicSkills });
          audio.chime();
          get().notify({
            title: "Hunter Class Registered",
            message: `<b>${getClass(id)?.name}</b>. Your skill tree is accessible via the ✦ button in the top bar.`,
            type: "System",
          });
        },

        learnBasicSkill: (id) => {
          const s = get();
          if (s.dead || s.inLockdown) return;
          const skill = classSkills(s.gameClass).find((entry) => entry.id === id);
          if (!skill) return;
          const reason = skillLockReason(s, skill);
          if (reason) {
            get().notify({ title: "Skill Locked", message: reason, type: "Alert" });
            return;
          }
          const spend = spendSkillPoints(s, id);
          if (!spend) return;
          set({ basicSkills: spend.basicSkills, sp: spend.sp });
          audio.chime();
          get().notify({
            title: "Skill Learned",
            message: `<b>${skill.name}</b> learned for ${skill.cost} skill point${skill.cost === 1 ? "" : "s"}.`,
            type: "System",
          });
        },

        clearEpisode: (level) => {
          const s = get();
          if (s.dead || s.inLockdown) return false;
          const episode = getEpisode(level);
          if (!episode) return false;
          const availability = episodeAvailability(s, episode);
          if (availability.status !== "ready" && availability.status !== "cleared") return false;
          const alreadyCleared = s.storyCleared.includes(level);
          if (alreadyCleared) return true;

          // SP reward: field tiles grant 1; story/boss tiles grant 2;
          // the level-40 Job Change ceremony grants none (the first Gate pays double to seed Act II).
          const spReward = episode.kind === "job" ? 0 : episode.kind === "field" ? 1 : 2;

          set({
            storyCleared: [...s.storyCleared, level].sort((a, b) => a - b),
            sp: s.sp + spReward,
            gold: s.gold + episode.gold,
          });
          audio.questComplete();
          get().notify({
            title: `${episode.title} — cleared`,
            message: `<b>${episode.enemy}</b> defeated. +${episode.gold} gold, +${spReward} skill point${spReward === 1 ? "" : "s"}.`,
            type: "System",
          });
          return true;
        },

        finishAwakening: () => {
          if (!get().name) return;
          applyPendingHardcore(get, set);
          set({ screen: "main" });
          get().notify({
            title: "Achievement Unlocked",
            message: `🔰 <b>Awakened — World's Weakest Hunter</b><br/>Classification: E-Rank. Every Monarch starts somewhere.`,
            type: "System",
          });
        },

        chooseMonarchPath: (id) => {
          const s = get();
          const path = getPath(id);
          if (!path || s.monarchPath || s.level < 40 || s.dead || s.inLockdown) return;
          const sigil = PATH_FLOURISH_IDS[MONARCH_PATHS.findIndex((entry) => entry.id === id)];
          set({
            monarchPath: id,
            equippedFlourishId: s.inventory.includes(sigil) ? sigil : null,
            levelUpFx: false,
            rankUpFx: null,
            ascensionFx: false,
          });
          audio.rankUp();
          get().notify({ title: "Job Change Complete", message: `<b>${path.name}</b> · ${path.jobClass}<br/>Your path is permanent. Its first Gate is ready when you are.`, type: "System" });
        },

         completeGate: (tier: TierNumber) => {
           const s = get();
           const path = getPath(s.monarchPath);
           const band = PATH_TIERS[tier - 1];
           if (!path || !band || s.level < band.min || s.clearedGates.includes(tier) || s.dead || s.inLockdown) return false;
           const rewardMessage = grantLoot(s);
           const newlyCleared = [...s.clearedGates, tier].sort((a, b) => a - b);
           const gateClears = [...s.gateClears.filter((entry) => entry.tier !== tier), { tier, date: todayISO() }]
             .sort((a, b) => a.tier - b.tier);
           const unlockedMove = path.moves[tier - 1];
           const maxBefore = pathBonuses(s).shieldMax;
           const maxAfter = pathBonuses({ monarchPath: s.monarchPath, clearedGates: newlyCleared }).shieldMax;
           // A Gate clear grants exactly enough SP to learn its move (plus a 1-SP buffer
           // for the first Gate to seed the Monarch tree, since the Job Change tile gives 0).
           const spReward = unlockedMove.cost + (tier === 1 ? 1 : 0);
           set({
             clearedGates: newlyCleared,
             gateClears,
             sp: s.sp + spReward,
             ...rewardMessage.patch,
             shieldCharges: Math.min(maxAfter, s.shieldCharges + (maxAfter - maxBefore)),
             shieldWeek: maxAfter > 0 ? mondayKey() : s.shieldWeek,
             gateClearFx: { path: path.id, tier },
           });
           audio.rankUp();
            get().notify({
              title: `${band.name} Gate Cleared`,
              message: `<b>${path.tiers[tier - 1].gateName}</b> conquered in battle.<br/>Title unlocked: <b>Cleared: ${path.tiers[tier - 1].gateName}</b><br/>Move unlocked: <b>${unlockedMove.name}</b> — learn it for ${unlockedMove.cost} skill points via the ✦ Skill Tree.<br/>${rewardMessage.message}`,
              type: "System",
            });
           return true;
         },

        learnMove: (id) => {
          const s = get();
          if (s.dead || s.inLockdown) return;
          const path = getPath(s.monarchPath);
          const move = findMove(path, id);
          if (!move) return;
          const reason = moveUnlockReason(s, move);
          if (reason) {
            get().notify({ title: "Move Locked", message: reason, type: "Alert" });
            return;
          }
          const spend = spendMovePoints(s, id);
          if (!spend) return;
          set({ learnedMoves: spend.learnedMoves, sp: spend.sp });
          // Learning the Tier-5 move is the ascension: the job class is replaced
          // by the Monarch title everywhere from that moment on.
          if (spend.isUltimate && !s.ascended && path) {
            set({ ascended: true, ascensionFx: true });
            audio.rankUp();
            get().notify({
              title: "Ascension",
              message: `You are no longer <b>${path.jobClass}</b>.<br/>Rise, <b>${path.monarchTitle}</b>.`,
              type: "System",
            });
            return;
          }
          audio.chime();
          get().notify({
            title: "Move Learned",
            message: `<b>${move.name}</b> learned for ${move.cost} skill point${move.cost === 1 ? "" : "s"}.`,
            type: "System",
          });
        },

        useSignatureMove: () => {
          const s = get();
          const skill = pathBonuses(s).signature;
          if (!skill || s.dead || s.inLockdown || s.signatureUsedDate === todayISO()) return;
          if (skill.action === "clearFatigue" && s.fatigueLevel <= 0) return;
          let message = "";
          if (skill.action === "clearFatigue") {
            set({ fatigueLevel: 0, signatureUsedDate: todayISO() });
            message = "Fatigue completely cleared.";
          } else if (skill.action === "token") {
            set({ relapseTokens: s.relapseTokens + 1, signatureUsedDate: todayISO() });
            message = "+1 Relapse Token. Once per day, earned through the final Gate.";
          } else {
            const reward = grantLoot(s);
            set({ ...reward.patch, signatureUsedDate: todayISO() });
            message = reward.message;
          }
          audio.chime();
          get().notify({ title: skill.name, message, type: "System" });
        },

        setTab: (t) => set({ tab: t }),
        setAvatar: (a) => set({ avatar: a }),

        getTargets: () => {
          const s = get();
          return computeTargets(s.archetype, s.dayMode, s.dailyTargetLevel ?? s.level);
        },

        getPenaltyTargets: () => {
          return get().penaltyTargets ?? computePenaltyTargets(get().getTargets());
        },

        lockDailyTargets: () => {
          if (get().dailyTargetLevel === null && !get().dailyCompleted) {
            set({ dailyTargetLevel: get().level });
          }
        },

        logExercise: (key, amount, verified) => {
          if (get().questDate !== todayISO()) get().tick();
          if (get().inLockdown || get().dead || get().dailyCompleted || !Number.isFinite(amount) || amount <= 0) return;
          if (key !== "run") amount = Math.floor(amount);
          if (amount <= 0) return;
          const targets = get().getTargets();
          const wasDone = get()[`${key}Done` as const] as boolean;
          let shownGold = 0;
          set((s) => {
            const cur = Math.min(targets[key], s[key]);
            const next = clamp(cur + amount, 0, targets[key]);
            const gained = next - cur;
            const goldGain = goldEarned(s, key === "run" ? gained * 10 : gained);
            shownGold = goldGain;
            const fat = fatigueEarned(s, key === "run" ? gained * 2 : gained * 0.18);
            const doneKey = `${key}Done` as const;
            return {
              [key]: next,
              dailyTargetLevel: s.dailyTargetLevel ?? s.level,
              gold: s.gold + goldGain,
              fatigueLevel: clamp(s.fatigueLevel + fat, 0, 100),
              [doneKey]: next >= targets[key],
            } as Partial<GameState>;
          });
          // ── juice ──
          if (shownGold > 0) fct(shownGold, "gold");
          const nowDone = get()[`${key}Done` as const] as boolean;
          if (nowDone && !wasDone) {
            shake("sm");
            flash("#2fe08a", 0.16);
            fct("OBJECTIVE CLEAR", "heal");
          }
          if (verified) {
            get().notify({
              title: "Camera Progress Saved",
              message: `<b>${amount}</b> reps counted by on-device pose estimation.`,
              type: "Verification",
            });
          }
          maybeCompleteDaily(set, get);
        },

        toggleCheck: (key) => {
          if (get().questDate !== todayISO()) get().tick();
          const s = get();
          if (s.inLockdown || s.dead) return;
          const doneKey = `${key}Done` as keyof GameState;
          const isDone = s[doneKey] as boolean;
          // Bug #1: once daily complete + rewards processed, checkboxes are locked.
          if (s.dailyCompleted) return;
          const targets = s.getTargets();
          if (isDone) {
            // uncheck -> reset that exercise
            set({ [key]: 0, [doneKey]: false } as Partial<GameState>);
          } else {
            set({ [key]: targets[key], [doneKey]: true, dailyTargetLevel: s.dailyTargetLevel ?? s.level } as Partial<GameState>);
            maybeCompleteDaily(set, get);
          }
        },

        allocateStat: (stat) => {
          const s = get();
          if (s.inLockdown) {
            get().notify({
              title: "Locked",
              message: "Stats cannot be allocated during Lockdown.",
              type: "Alert",
            });
            return;
          }
          if (s.pts <= 0 || s.dead) return;
          set((st) => {
            const draft = { ...st, pts: st.pts - 1, [stat]: (st[stat] as number) + 1 };
            if (stat === "vit") {
              const { hpMax, mpMax } = computeMax(draft.vit);
              draft.hpMax = hpMax;
              draft.mpMax = mpMax;
              draft.hp = clamp(draft.hp, 0, hpMax);
              draft.mp = clamp(draft.mp, 0, mpMax);
            }
            return draft;
          });
          audio.repBeep();
        },

        buyPotion: () => {
          get().buyItem(31);
        },

        buyItem: (id) => {
          const s = get();
          const item = SHOP_ITEMS.find((entry) => entry.id === id);
          if (!item || s.dead || s.inLockdown) return;
          const cost = shopCost(s, item);
          if (s.gold < cost) return;
          const path = getPath(s.monarchPath);
          const flourishId = path ? PATH_FLOURISH_IDS[MONARCH_PATHS.findIndex((entry) => entry.id === path.id)] : null;
          if (item.kind === "sigil" && (!path || flourishId === null || s.inventory.includes(flourishId))) return;
          set({
            gold: s.gold - cost,
            potions: s.potions + (item.kind === "recovery" ? 1 : 0),
            staminaDrafts: s.staminaDrafts + (item.kind === "stamina" ? 1 : 0),
            elixirs: s.elixirs + (item.kind === "elixir" ? 1 : 0),
            relapseTokens: s.relapseTokens + (item.kind === "token" ? 1 : 0),
            inventory: flourishId !== null && item.kind === "sigil" ? [...s.inventory, flourishId] : s.inventory,
            equippedFlourishId: item.kind === "sigil" ? flourishId : s.equippedFlourishId,
          });
          audio.buy();
        },

        equipItem: (id) => {
          const item = getItem(id);
          const s = get();
          if (!item || !s.inventory.includes(id) || s.dead || s.inLockdown) return;
          if (item.theme) set({ hudTheme: item.theme });
          else if (item.pathFlourish && item.pathFlourish === s.monarchPath && s.level >= 40) {
            set({ equippedFlourishId: s.equippedFlourishId === id ? null : id });
          } else return;
          audio.chime();
        },

        consumePotion: () => {
          const s = get();
          const bonus = pathBonuses(s).potionFatigue;
          if (s.inLockdown || s.dead) return;
          if (s.potions <= 0 || (s.hp >= s.hpMax && s.mp >= s.mpMax && (bonus === 0 || s.fatigueLevel <= 0))) return;
          set({ potions: s.potions - 1, hp: s.hpMax, mp: s.mpMax, fatigueLevel: Math.max(0, s.fatigueLevel - bonus) });
          audio.chime();
        },

        consumeStamina: () => {
          const s = get();
          if (s.inLockdown || s.dead || s.staminaDrafts <= 0 || s.fatigueLevel <= 0) return;
          set({ staminaDrafts: s.staminaDrafts - 1, fatigueLevel: Math.max(0, s.fatigueLevel - 40 - pathBonuses(s).draftPower) });
          audio.chime();
        },

        consumeElixir: () => {
          const s = get();
          if (s.inLockdown || s.dead || s.elixirs <= 0 || (s.hp >= s.hpMax && s.mp >= s.mpMax && s.fatigueLevel <= 0)) return;
          set({ elixirs: s.elixirs - 1, hp: s.hpMax, mp: s.mpMax, fatigueLevel: 0 });
          audio.chime();
        },

        equipTitle: (id) => {
          const s = get();
          const title = typeof id === "number" ? TITLES.find((t) => t.id === id) : null;
          const isCurrentlyValid = typeof id === "string"
            ? isPathTitleValid(s, id)
            : !!title && (title.level == null || s.level >= title.level) && (title.streak == null || s.streak >= title.streak);
          if (!isCurrentlyValid) return;
          set({ equippedTitle: id });
          audio.chime();
        },

        claimReward: (kind, stat) => {
          const s = get();
          if (s.dead || !s.rewardChoicePending) return;
          // Bug #3: block claiming during lockdown.
          if (s.inLockdown) {
            get().notify({
              title: "Locked",
              message: "Rewards cannot be claimed during Lockdown.",
              type: "Alert",
            });
            return;
          }
          if (kind === "status") {
            set({ hp: s.hpMax, mp: s.mpMax, fatigueLevel: 0, rewardChoicePending: false });
            audio.chime();
          } else if (kind === "stat" && stat) {
            set((st) => {
              const draft = { ...st, [stat]: (st[stat] as number) + 3, rewardChoicePending: false };
              if (stat === "vit") {
                const { hpMax, mpMax } = computeMax(draft.vit);
                draft.hpMax = hpMax;
                draft.mpMax = mpMax;
                draft.hp = clamp(draft.hp, 0, hpMax);
                draft.mp = clamp(draft.mp, 0, mpMax);
              }
              return draft;
            });
            audio.levelUp();
          } else if (kind === "loot") {
            const reward = grantLoot(s);
            set({ ...reward.patch, rewardChoicePending: false });
            audio.questComplete();
            get().notify({ title: "Loot Acquired", message: reward.message, type: "System" });
          }
        },

        consumeToken: () => {
          const s = get();
          if (s.relapseTokens <= 0 || !s.inLockdown || s.dead) return;
          set({
            relapseTokens: s.relapseTokens - 1,
            inLockdown: false,
            penalty: false,
            penaltyTargets: null,
            hp: s.hpMax,
          });
          stopDrone();
          audio.chime();
          get().notify({
            title: "Token Consumed",
            message: "A Relapse Token shattered the Lockdown. You are free.",
            type: "System",
          });
        },

        submitPenalty: (push, sit, run) => {
          const s = get();
          if (!s.inLockdown || s.dead || ![push, sit, run].every((amount) => Number.isFinite(amount) && amount >= 0)) return;
          const targets = s.getPenaltyTargets();
          const p = Math.max(s.penPushDone, push);
          const si = Math.max(s.penSitDone, sit);
          const r = s.penRunDone || run >= targets.run;
          if (p >= targets.push && si >= targets.sit && r) {
            set({
              penalty: false,
              inLockdown: false,
              penaltyTargets: null,
              hp: s.hpMax,
              penPushDone: 0,
              penSitDone: 0,
              penRunDone: false,
            });
            stopDrone();
            audio.questComplete();
            get().notify({
              title: "Penalty Cleared",
              message: "The Lockdown lifts. Do not fail the System again.",
              type: "System",
            });
          } else {
            set({ penPushDone: p, penSitDone: si, penRunDone: r });
            const missing: string[] = [];
            if (p < targets.push) missing.push(`${targets.push - p} Push-ups`);
            if (si < targets.sit) missing.push(`${targets.sit - si} Sit-ups`);
            if (!r) missing.push(`${Math.max(0, targets.run - run)}km Run`);
            audio.error();
            get().notify({
              title: "Penalty Incomplete",
              message: `Still required: ${missing.join(", ")}.`,
              type: "Alert",
            });
          }
        },

        addPenaltyProgress: (key, amount) => {
          if (!get().inLockdown || get().dead || !Number.isFinite(amount) || amount <= 0) return;
          const target = get().getPenaltyTargets()[key];
          set((s) => ({
            [key === "push" ? "penPushDone" : "penSitDone"]:
              Math.min(target, (key === "push" ? s.penPushDone : s.penSitDone) + Math.floor(amount)),
          }));
        },

        resurrect: () => {
          const prev = get();
          const hardcore = prev.settings.hardcoreMode;
          const keepSettings = prev.settings;
          const ironVow = prev.pact.active && prev.pact.stake === "ironvow";
          const fresh = defaultState();
          fresh.settings = keepSettings;
          // Record the Iron Vow breach into the ledger we're about to carry over,
          // so it survives the wipe (the generic helper can't run here — its
          // state write would be clobbered by this same reset).
          fresh.pactLedger = ironVow
            ? [
                {
                  date: todayISO(),
                  event: "IRON VOW BROKEN — hunter erased",
                  stake: prev.pact.stake,
                  terms: prev.pact.terms,
                  witness: prev.pact.witness,
                },
                ...prev.pactLedger,
              ].slice(0, 100)
            : prev.pactLedger;
          // A broken Iron Vow does not carry forward — the next run starts unbound.
          fresh.pact = ironVow
            ? { ...defaultState().pact }
            : { ...prev.pact, breaches: prev.pact.breaches };
          fresh.name = "";
          fresh.screen = "intro";
          // Hardcore pending-debuff flag lives IN persisted state so it
          // survives a tab close/reload between dying and re-naming.
          fresh.pendingHardcoreDebuff = hardcore;
          set({
            ...fresh,
            levelUpFx: false,
            rankUpFx: null,
            gateClearFx: null,
            ascensionFx: false,
            dead: false,
            deathConfirm: false,
            deathCause: "",
          });
        },

        requestOblivion: () => {
          if (!get().deathConfirm) {
            set({ deathConfirm: true });
          } else {
            get().resurrect();
          }
        },

        completeSpecial: () => {
          const s = get();
          if (!s.specialQuest || !s.specialActive || !s.dailyCompleted || s.dead || s.inLockdown) return;
          const q = s.specialQuest;
          const tokenDrop = Math.random() < 0.05;
          let earnedXP = 0;
          set((st) => {
            const draft = { ...st };
            const fx = awardXP(draft, q.xp);
            earnedXP = fx.effXP;
            if (q.stat && q.statAmt) {
              (draft[q.stat] as number) += q.statAmt;
              if (q.stat === "vit") {
                const m = computeMax(draft.vit);
                draft.hpMax = m.hpMax;
                draft.mpMax = m.mpMax;
                draft.hp = m.hpMax;
                draft.mp = m.mpMax;
              }
            }
            draft.specialActive = false;
            draft.specialQuest = null;
            if (tokenDrop) draft.relapseTokens += 1;
            if (fx.leveled && !(draft.level >= 40 && !draft.monarchPath)) {
              draft.levelUpFx = true;
              if (fx.rankChanged) draft.rankUpFx = fx.newRank;
            }
            queueTitleChecks(draft);
            return draft;
          });
          audio.questComplete(); // The level-up overlay owns its fanfare, once.
          get().notify({
            title: "Special Quest Cleared",
            message: tokenDrop
              ? `${q.name} complete. +${earnedXP} XP${q.stat ? ` · +${q.statAmt} ${q.stat.toUpperCase()}` : ""}. <b>Rare drop: +1 Relapse Token.</b>`
              : `${q.name} complete. +${earnedXP} XP${q.stat ? ` · +${q.statAmt} ${q.stat.toUpperCase()}` : ""}.`,
            type: "System",
          });
        },

        dismissSpecial: () => set({ specialActive: false, specialQuest: null }),

        notify: (n) => set((s) => ({ notifications: [...s.notifications, n] })),
        dismissNotify: () => set((s) => ({ notifications: s.notifications.slice(1) })),

        toggleAdaptive: () =>
          set((s) => ({ settings: { ...s.settings, adaptiveMode: !s.settings.adaptiveMode } })),
        toggleHardcore: () =>
          set((s) => ({ settings: { ...s.settings, hardcoreMode: !s.settings.hardcoreMode } })),
        toggleVoice: () =>
          set((s) => ({ settings: { ...s.settings, voiceCounting: !s.settings.voiceCounting } })),
        toggleShake: () =>
          set((s) => ({ settings: { ...s.settings, screenShake: !s.settings.screenShake } })),
        toggleFloaters: () =>
          set((s) => ({
            settings: { ...s.settings, floatingNumbers: !s.settings.floatingNumbers },
          })),
        toggleFastMode: () =>
          set((s) => ({ settings: { ...s.settings, fastMode: !s.settings.fastMode } })),
        setRemindersEnabled: (enabled) =>
          set((s) => ({ settings: { ...s.settings, remindersEnabled: enabled } })),
        /* ── BLOOD PACT ── */
        swearPact: (stake, witness, terms) => {
          set({
            pact: {
              active: true,
              stake,
              witness: witness.trim(),
              terms: terms.trim(),
              sworn: Date.now(),
              breaches: 0,
            },
          });
          audio.death();
          get().notify({
            title: "Pact Sealed",
            message: "Your commitment is saved on this device. Breaches are logged locally; share them with your witness yourself. Nothing is sent automatically.",
            type: "Alert",
          });
        },

        dissolvePact: () => {
          set((st) => ({ pact: { ...st.pact, active: false } }));
          get().notify({
            title: "Pact Dissolved",
            message: "You walk free. The System records no forfeit.",
            type: "System",
          });
        },

        clearLevelUpFx: () => set({ levelUpFx: false }),
        clearRankUpFx: () => set({ rankUpFx: null }),
        clearGateFx: () => set({ gateClearFx: null }),
        clearAscensionFx: () => set({ ascensionFx: false }),

        importState: (data) => {
          if (!isSaveFile(data)) throw new Error("This file does not contain a valid hunter save.");
          const normalized = normalizeSave(data);
          set({ ...normalized, dead: normalized.hp <= 0 && !!normalized.name,
            levelUpFx: false, rankUpFx: null, gateClearFx: null, ascensionFx: false, deathCause: "", deathConfirm: false });
        },

        hardReset: () => {
          const settings = get().settings;
          const fresh = defaultState();
          fresh.settings = settings;
          fresh.pactLedger = get().pactLedger;
          set({ ...fresh, levelUpFx: false, rankUpFx: null, gateClearFx: null, ascensionFx: false, dead: false });
        },

        tick: () => runTick(set, get),
      };
    },
    {
      name: SAVE_KEY,
      version: 10,
      storage: createJSONStorage(() => localStorage),
      migrate: (data) => normalizeSave(data),
      merge: (data, current) => ({ ...current, ...normalizeSave(data) }),
      partialize: (s) => {
        const keys = Object.keys(defaultState()).filter((key) => !["screen", "tab", "notifications"].includes(key));
        const data = s as unknown as Record<string, unknown>;
        return Object.fromEntries(keys.map((key) => [key, data[key]])) as Omit<GameState, "screen" | "tab" | "notifications">;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // returning player with a saved name skips to main
          state.screen = state.name ? "main" : "intro";
          state.tab = "quest";
          state.notifications = [];
          state.rewardChoicePending = false;
          state.levelUpFx = false;
          state.rankUpFx = null;
          state.gateClearFx = null;
          state.ascensionFx = false;
          state.deathConfirm = false;
          // Re-show a pending death after reload without replaying its effects.
          if (state.hp <= 0 && state.name) {
            state.dead = true;
          } else {
            state.dead = false;
            state.deathCause = "";
          }
        }
      },
    },
  ),
);

/** Local commitment record only. There is no network or automatic enforcement. */
function reportPactBreach(
  set: (fn: any) => void,
  get: () => Store,
  event: string,
) {
  const s = get();
  if (!s.pact.active) return;

  set((st: Store) => ({
    pact: { ...st.pact, breaches: st.pact.breaches + 1 },
    pactLedger: [
      {
        date: todayISO(),
        event,
        stake: st.pact.stake,
        terms: st.pact.terms,
        witness: st.pact.witness,
      },
      ...st.pactLedger,
    ].slice(0, 100),
  }));
}

// ---------- module-level helpers (avoid stale closures) ----------

function maybeCompleteDaily(
  set: (fn: any) => void,
  get: () => Store,
) {
  const s = get();
  if (s.dailyCompleted || s.dead || s.inLockdown) return;
  if (!(s.pushDone && s.sitDone && s.squatDone && s.runDone)) return;

  const overdrive = s.dayMode === "overdrive";
  const xpReward = overdrive ? 1000 : 500;
  const goldReward = overdrive ? 200 : 100;
  const completedTargets = s.getTargets();
  const earnedXP = Math.round(xpReward * ARCHETYPES[s.archetype].xpMult);

  set((st: Store) => {
    const draft = { ...st };
    // XP pipeline
    const eff = awardXP(draft, xpReward);
    draft.pts += 3;
    draft.hp = draft.hpMax;
    draft.mp = draft.mpMax;
    draft.gold += goldEarned(draft, goldReward);
    draft.streak += 1;
    draft.dailyCompleted = true;
    draft.rewardChoicePending = true;

    // streak potions
    if (draft.streak % 7 === 0) {
      const potGain = draft.streak >= 30 ? 4 : draft.streak >= 14 ? 2 : 1;
      draft.potions += potGain;
    }

    // history
    draft.history = [
      {
        date: todayISO(),
        items: [`${completedTargets.push} Push-ups`, `${completedTargets.sit} Sit-ups`, `${completedTargets.squat} Squats`, `${completedTargets.run}km Run`],
        xpGain: earnedXP,
      },
      ...draft.history,
    ];

    // title checks (unlock + revalidate)
    const unlocked = TITLES.filter(
      (t) =>
        (t.level == null || draft.level >= t.level) &&
        (t.streak == null || draft.streak >= t.streak),
    ).map((t) => t.id);
    for (const id of unlocked) {
      if (!draft.notifiedTitles.includes(id)) {
        draft.notifiedTitles = [...draft.notifiedTitles, id];
        const t = TITLES.find((x) => x.id === id)!;
        const hunter = draft.name;
        setTimeout(() => {
          const current = get();
          if (current.name !== hunter || current.dead || !current.notifiedTitles.includes(id)
            || (t.level != null && current.level < t.level) || (t.streak != null && current.streak < t.streak)) return;
          current.notify({
            title: "Title Unlocked",
            message: `${t.icon} <b>${t.name}</b><br/>${t.desc}`,
            type: "System",
          });
        }, 2500);
      }
    }
    if (typeof draft.equippedTitle === "number" && !unlocked.includes(draft.equippedTitle)) {
      draft.equippedTitle = null;
    }

    if (eff.leveled && !(draft.level >= 40 && !draft.monarchPath)) {
      draft.levelUpFx = true;
      if (eff.rankChanged) draft.rankUpFx = eff.newRank;
    }
    return draft;
  });

  audio.questComplete();
  const after = get();
  // ── big payoff juice ──
  shake("lg");
  flash("#1e9bff", 0.3);
  fctBurst([
    { text: `${earnedXP} XP`, kind: "crit" },
    { text: `${goldEarned(after, goldReward)} GOLD`, kind: "gold" },
    { text: "3 STAT POINTS", kind: "stat" },
    { text: `STREAK ${after.streak}`, kind: "heal" },
  ]);
  get().notify({
    title: "Daily Quest Complete",
    message: `All exercises cleared!<br/>+${earnedXP} XP · +3 Stat Points · Full Recovery${
      overdrive ? "<br/>⚡ OVERDRIVE bonus applied" : ""
    }`,
    type: "System",
  });
}

// ---------- The 1-second tick: day boundary, penalty, spawns ----------
function runTick(set: (fn: any) => void, get: () => Store) {
  let s = get();
  if (s.screen !== "main" || s.dead) return;
  const today = todayISO();

  const shieldMax = pathBonuses(s).shieldMax;
  if (shieldMax > 0 && s.shieldWeek !== mondayKey()) {
    set({ shieldWeek: mondayKey(), shieldCharges: shieldMax });
    s = get();
  }

  // ---- Day boundary check [A.5] ----
  if (s.questDate && s.questDate !== today) {
    // An unresolved penalty keeps its original deadline; a new day must not extend it.
    if (!s.dailyCompleted && !s.penalty) {
      const missedDays = Math.max(1, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${s.questDate}T12:00:00`)) / 86400000) || 1);
      const shieldSpent = Math.min(missedDays, s.shieldCharges);
      if (shieldSpent > 0) {
        set({ shieldCharges: s.shieldCharges - shieldSpent });
        get().notify({
          title: "Streak Shield Activated",
          message: missedDays <= shieldSpent
            ? `${shieldSpent} missed day${shieldSpent === 1 ? "" : "s"} forgiven. Streak and HP protected. Charges recharge on Monday.`
            : `${shieldSpent} missed day${shieldSpent === 1 ? "" : "s"} forgiven, but more time passed. The remaining miss triggers Lockdown.`,
          type: "System",
        });
      }
      if (missedDays > shieldSpent) {
        // The shield covers only its actual number of missed days.
        const survives = s.hp - 20 > 0;
        const penaltyTargets = computePenaltyTargets(s.getTargets());
        set((st: Store) => {
          // Path Gate titles are permanent; only expired streak titles disappear.
          const stillValid =
            st.equippedTitle == null ||
            (typeof st.equippedTitle === "string" && isPathTitleValid(st, st.equippedTitle)) ||
            TITLES.some((t) =>
              t.id === st.equippedTitle &&
              (t.level == null || st.level >= t.level) &&
              (t.streak == null || 0 >= t.streak),
            );
          return {
            penalty: true,
            penaltyEnd: Date.now() + PENALTY_MS,
            penaltyTargets,
            penPushDone: 0,
            penSitDone: 0,
            penRunDone: false,
            hp: Math.max(0, st.hp - 20),
            streak: 0,
            equippedTitle: stillValid ? st.equippedTitle : null,
          };
        });
        shake("lg");
        flash("#ff3b52", 0.4);
        fct(20, "dmg");
        reportPactBreach(set, get, "Daily Quest failed — day missed");
        if (survives) {
          // Penalty red temporarily overrides the cosmetic theme.
          set({ inLockdown: true });
          startDrone();
        } else {
          triggerDeathModule(set, get, "Streak Broken");
        }
      }
    }
    // reset today's progress + apply adaptive day mode
    applyNewDay(set, get, today);
  } else if (s.dailyDate !== today && !s.penalty) {
    applyNewDay(set, get, today);
  }

  // Read the post-boundary state before applying timers or spawning another quest.
  s = get();
  if (s.dead) return;

  // ---- Lockdown timer catch-up [Bug #2] ----
  // Death must be a one-time transition, even after a long background interval.
  if (!s.dead && s.penalty && s.inLockdown && s.penaltyEnd > 0 && Date.now() > s.penaltyEnd) {
    const elapsedTicks = Math.floor((Date.now() - s.penaltyEnd + PENALTY_MS) / PENALTY_MS);
    if (elapsedTicks > 0) {
      let hp = s.hp;
      let died = false;
      for (let i = 0; i < elapsedTicks; i++) {
        hp = Math.max(0, hp - 20);
        if (hp <= 0) {
          died = true;
          break;
        }
      }
      if (died) {
        triggerDeathModule(set, get, "Penalty Timer Expired");
        reportPactBreach(set, get, "Penalty timer expired — died in Lockdown");
      } else {
        set({ hp, penaltyEnd: s.penaltyEnd + elapsedTicks * PENALTY_MS });
      }
    }
  }

  s = get();
  if (s.dead) return;

  // ---- Random spawns (not during lockdown) ----
  if (s.dailyCompleted && !s.inLockdown && !s.dead && (s.level < 40 || !!s.monarchPath) && (typeof document === "undefined" || !document.hidden)) {
    // Dismissible, untimed Special Quests unlock after the daily work is done.
    const current = get();
    if (!current.specialActive && Math.random() < 0.02) {
      const q = SPECIAL_QUESTS[Math.floor(Math.random() * SPECIAL_QUESTS.length)];
      set({
        specialActive: true,
        specialQuest: q,
      });
      get().notify({
        title: "Special Quest",
        message: `⚡ <b>${q.name}</b><br/>${q.desc}<br/>Rare Relapse Token drop: 5% on completion.`,
        type: "Emergency",
      });
    }
  }
}

function applyNewDay(set: (fn: any) => void, get: () => Store, today: string) {
  const s = get();
  // decide adaptive day mode [B.2]
  let dayMode: GameState["dayMode"] = "classic";
  if (s.settings.adaptiveMode) {
    if (s.fatigueLevel > 75 || s.hp / s.hpMax < 0.3) dayMode = "recovery";
    else if (s.streak >= 7 && s.fatigueLevel < 30) dayMode = "overdrive";
  }
  set({
    dailyDate: today,
    questDate: today,
    push: 0,
    sit: 0,
    squat: 0,
    run: 0,
    pushDone: false,
    sitDone: false,
    squatDone: false,
    runDone: false,
    dailyCompleted: false,
    dailyTargetLevel: null,
    specialActive: false,
    specialQuest: null,
    dayMode,
  });
}

function triggerDeathModule(set: (fn: any) => void, get: () => Store, cause: string) {
  if (get().dead) return;
  stopDrone();
  audio.death();
  set({
    hp: 0,
    dead: true,
    deathCause: cause,
    deathConfirm: false,
    // Belt and suspenders: once dead, penalty/lockdown flags are meaningless
    // and leaving them set lets the catch-up block re-trigger death every tick.
    penalty: false,
    inLockdown: false,
    penaltyTargets: null,
  });
}

// hook to apply hardcore penalty when re-awakening after death.
// Reads the PERSISTED pendingHardcoreDebuff field (not a module variable),
// so the debuff survives a reload between death and re-naming.
export function applyPendingHardcore(get: () => Store, set: (fn: any) => void) {
  if (get().pendingHardcoreDebuff) {
    set((s: Store) => {
      const vit = Math.max(0, s.vit - 1);
      const { hpMax, mpMax } = computeMax(vit);
      return { pendingHardcoreDebuff: false, resurrectDebuff: 3,
        str: Math.max(0, s.str - 1), agi: Math.max(0, s.agi - 1), vit,
        hpMax, mpMax, hp: Math.min(s.hp, hpMax), mp: Math.min(s.mp, mpMax), equippedTitle: null };
    });
  }
}

export function voiceRep(n: number, target: number) {
  const s = useGame.getState();
  if (!s.settings.voiceCounting) return;
  if (n >= target) voice.say(`${n}. Quest Complete!`);
  else if (n === Math.floor(target / 2)) voice.say(`${n}. Halfway!`);
  else voice.say(String(n));
}
