export type Screen = "loading" | "intro" | "awaken" | "main";
export type Tab = "quest" | "journey" | "titles" | "pact" | "log";
export type ThemeId = "system-blue" | "penalty-red" | "shadow-purple" | "monarch-gold";
export type ArchetypeId = "balanced" | "assassin" | "monarch" | "vanguard";
export type ExerciseKey = "push" | "sit" | "squat" | "run";
export type CameraExercise = Exclude<ExerciseKey, "run">;
export type CameraPurpose = "daily" | "penalty";
export type StatKey = "str" | "agi" | "vit";
export type PenaltyTargets = Record<"push" | "sit" | "run", number>;
export type PathId = "shadows" | "destruction" | "white-flames" | "fangs" | "frost" | "iron-body" | "beginning" | "plagues" | "transfiguration";
export type TierNumber = 1 | 2 | 3 | 4 | 5;

export type PathSkill =
  | { kind: "goldBonus" | "fatigueResist" | "lootLuck"; amount: number; label: string }
  | { kind: "recoveryBoost"; mode: "staminaDiscount" | "potionFatigue" | "draftPower"; amount: number; label: string }
  | { kind: "streakShield"; charges: 1; label: string }
  | { kind: "signatureMove"; action: "clearFatigue" | "token" | "loot"; name: string; label: string };

export interface PathTier {
  gateName: string;
  title: string;
  skills: PathSkill[];
}

/* ── Battle moves ──
   Gate movesets and the pre-Job Change class kit share one shape so a single
   battle engine can run both. Every path's five moves fill the same five
   mechanical roles, and every class's kit fills the same role spread, so only
   the names and art change between them. */
export type MoveRole =
  | "basic" | "opener" | "weaken" | "empower" | "drain" | "heal" | "finisher" | "ultimate";

/** The mechanical half of a move: everything the battle engine reads. */
export interface MoveLike {
  id: string;
  name: string;
  role: MoveRole;
  /** Multiplier applied to your own ATK (0 = no direct damage). */
  power: number;
  /** Applied to the enemy for the rest of the fight. */
  debuff?: "atk" | "def";
  /** Applied to you for the rest of the fight. */
  buff?: "atk" | "def" | "crit";
  /** Fraction of damage dealt that heals you. */
  drain?: number;
  /** Fraction of your maximum HP restored outright. */
  heal?: number;
  /** Usable once per fight. */
  once?: boolean;
  /** Size of the buff or debuff; path moves default to the role's scale. */
  scale?: number;
}

export interface PathMove extends MoveLike {
  /** Mirrors the trial tier whose Gate unlocks learning it. */
  tier: TierNumber;
  /** Stat points spent to learn it. */
  cost: number;
  /** Gate that must be cleared first; null for the free starting move. */
  requiresTrial: TierNumber | null;
  /** Extra threshold for the Tier-5 ultimate. */
  requiresStat?: { stat: StatKey; amount: number };
}

/* ── The story game ── */
export type GameClassId = "fighter" | "mage" | "assassin" | "ranger";

export interface BasicSkill extends MoveLike {
  /** Hunter level that unlocks the node. */
  level: number;
  /** Stat points spent to learn it. */
  cost: number;
  /** One-line flavour for the tree node. */
  desc: string;
  /** Free starting skill, granted the moment the class is chosen. */
  starter?: boolean;
}

export interface HunterClass {
  id: GameClassId;
  name: string;
  icon: string;
  color: string;
  role: string;
  flavor: string;
  /** The two stats this class leans on, for the tree's tooltip. */
  stats: [StatKey, StatKey];
  skills: readonly BasicSkill[];
}

export type EpisodeKind = "field" | "story" | "boss" | "job";

export interface StoryEpisode {
  /** The hunter level that unlocks this tile. */
  level: number;
  kind: EpisodeKind;
  region: string;
  title: string;
  enemy: string;
  /** Portrait art for named enemies; composed fights fall back to a silhouette. */
  enemyArt?: string;
  npc?: string;
  /** The System's quest text. */
  briefing: string;
  /** What the encounter is, in prose. */
  prose: string;
  /** Gold paid on first clear; SP income is derived from `kind` in lib/story. */
  gold: number;
  rewardNote: string;
}

export interface MonarchPath {
  id: PathId;
  /** Full Monarch title. Sigils, loot text and the ascension pay-off read this. */
  name: string;
  /** The class name shown through Tiers 1–4, before ascension. */
  monarchTitle: string;
  jobClass: string;
  flavor: string;
  signatureExercise: CameraExercise;
  icon: string;
  color: string;
  /** Drives the Tier-5 ultimate's stat requirement, split three paths per stat. */
  primaryStat: StatKey;
  moves: readonly [PathMove, PathMove, PathMove, PathMove, PathMove];
  tiers: readonly [PathTier, PathTier, PathTier, PathTier, PathTier];
}

export interface Item {
  id: number;
  name: string;
  icon: string;
  desc: string;
  theme?: Exclude<ThemeId, "penalty-red">;
  pathFlourish?: PathId;
  pool: "cosmetic" | "starter" | "flourish";
}

export interface ShopItem {
  id: number;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  kind: "recovery" | "stamina" | "elixir" | "token" | "sigil";
}

export type LootRoll =
  | { kind: "potions"; amount: number }
  | { kind: "token"; amount: number }
  | { kind: "gold"; amount: number }
  | { kind: "theme"; themeId: number }
  | { kind: "flourish"; flourishId: number };

export interface TitleDef {
  id: number;
  name: string;
  icon: string;
  desc: string;
  level?: number;
  streak?: number;
}

export interface SpecialQuest {
  id: number;
  name: string;
  desc: string;
  xp: number;
  stat?: StatKey;
  statAmt?: number;
}

export interface HistoryEntry {
  date: string;
  items: string[];
  xpGain: number;
}

export interface SlNotification {
  title: string;
  message: string;
  type: string;
}

export interface Settings {
  adaptiveMode: boolean;
  hardcoreMode: boolean;
  voiceCounting: boolean;
  screenShake: boolean;
  floatingNumbers: boolean;
  remindersEnabled: boolean;
  fastMode: boolean;
}

/* ════════ BLOOD PACT — real-world stakes ════════ */
export type PactStake = "witness" | "forfeit" | "ironvow";

export interface BloodPact {
  active: boolean;
  stake: PactStake;
  /** Name of the real person holding you accountable. */
  witness: string;
  /** The real-world consequence the player declared, in their own words. */
  terms: string;
  /** Unix ms when the pact was sworn. */
  sworn: number;
  /** Locally recorded breaches. No automatic sharing. */
  breaches: number;
}

export interface PactLedgerEntry {
  date: string;
  event: string;
  stake: PactStake;
  terms: string;
  witness: string;
}

export interface GameState {
  // meta
  screen: Screen;
  tab: Tab;
  name: string;
  archetype: ArchetypeId;
  avatar: string;

  // progression
  level: number;
  pts: number;
  /** Skill Points: earned from clearing story episodes and Gates, spent only on the skill tree. */
  sp: number;
  streak: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  xp: number;
  xpMax: number;
  str: number;
  agi: number;
  vit: number;

  // penalty / lockdown
  penalty: boolean;
  penaltyEnd: number;
  penPushDone: number;
  penSitDone: number;
  penRunDone: boolean;
  penaltyTargets: PenaltyTargets | null;
  inLockdown: boolean;
  relapseTokens: number;

  // daily quest
  dailyDate: string;
  questDate: string;
  push: number;
  sit: number;
  squat: number;
  run: number;
  pushDone: boolean;
  sitDone: boolean;
  squatDone: boolean;
  runDone: boolean;
  dailyCompleted: boolean;
  // Lock the day's level when training starts, so a level-up cannot raise its goals.
  dailyTargetLevel: number | null;
  lastReminderCheck: number;

  // adaptive daily modifiers (computed at day boundary)
  dayMode: "classic" | "recovery" | "overdrive";

  // economy / items
  gold: number;
  potions: number;
  staminaDrafts: number;
  inventory: number[];
  equippedTitle: number | string | null;
  notifiedTitles: number[];

  // cosmetic theme
  hudTheme: ThemeId;
  equippedFlourishId: number | null;

  // Level 40 Job Change and independent, one-time battle Gates.
  /** The class picked at Awakening. Drives the basic skill tree and the story. */
  gameClass: GameClassId | null;
  /** Class skill ids learned from the tree. */
  basicSkills: string[];
  /** Story tiles cleared, by level. */
  storyCleared: number[];
  monarchPath: PathId | null;
  clearedGates: TierNumber[];
  /** Local record of when each trial was cleared, for the Gate Log. */
  gateClears: { tier: TierNumber; date: string }[];
  /** Move ids learned with skill points. Clearing a Gate only unlocks the option. */
  learnedMoves: string[];
  /** True once the Tier-5 ultimate is learned and the ascension has played. */
  ascended: boolean;
  shieldCharges: number;
  shieldWeek: string;
  signatureUsedDate: string;
  elixirs: number;

  // fatigue
  fatigueLevel: number;

  // optional special quest (no timer)
  specialActive: boolean;
  specialQuest: SpecialQuest | null;

  // reward
  rewardChoicePending: boolean;

  // hardcore resurrection debuff
  resurrectDebuff: number; // stats reduced count remaining to heal back
  // set at death-reset when Hardcore Mode is on; consumed on next awaken.
  // Persisted so a reload between dying and re-naming can't drop the debuff.
  pendingHardcoreDebuff: boolean;

  // blood pact (real-world stakes)
  pact: BloodPact;
  pactLedger: PactLedgerEntry[];

  // logs
  history: HistoryEntry[];

  // ui queues (transient but persisted harmlessly)
  notifications: SlNotification[];

  settings: Settings;
}
