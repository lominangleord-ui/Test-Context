import type { StoryEpisode } from "../types";

/**
 * Act I — one tile per hunter level, 1 through 40, so the map advances every
 * time a hunter levels. Ten levels are authored story beats with named enemies
 * and NPCs; the rest are field quests composed deterministically from the
 * region's bestiary and the encounter templates below. Nothing here is random:
 * the same level always produces the same quest, which keeps saves, tests and
 * the map stable.
 *
 * Act II is the nine Monarch trials, which already exist as the tier Gates in
 * data/monarchPaths.ts. The map links to them rather than duplicating them.
 */

export interface StoryRegion {
  id: string;
  name: string;
  /** Act I level range, inclusive. */
  from: number;
  to: number;
  art: string;
  blurb: string;
}

export const STORY_REGIONS: readonly StoryRegion[] = [
  {
    id: "verdant", name: "Verdant Ruins", from: 1, to: 9, art: "/art/map-verdant.jpg",
    blurb: "A low-grade Gate opened over a swallowed city block. The Association sends anyone who will go.",
  },
  {
    id: "marsh", name: "Sunken Marsh", from: 10, to: 19, art: "/art/map-marsh.jpg",
    blurb: "The water table rose with the mana. Nobody has mapped the bottom of it yet.",
  },
  {
    id: "caverns", name: "Ashen Caverns", from: 20, to: 32, art: "/art/map-caverns.jpg",
    blurb: "Something down here has been burning since before the first Gate opened.",
  },
  {
    id: "citadel", name: "Monarch's Citadel", from: 33, to: 40, art: "/art/map-citadel.jpg",
    blurb: "The last floor. Every hunter who reaches it is asked what they intend to become.",
  },
];

export const STORY_ACTS = [
  { id: "act-1", name: "Act I · The Nascent Gate", from: 1, to: 40, note: "Levels 1-40. Every tile is one level, and the Job Change waits at the end." },
  { id: "act-2", name: "Act II · The Nine Trials", from: 40, to: 120, note: "Your Monarch path's five Gates, unlocked by level and won with the moves you drafted." },
] as const;

export interface StoryNpc {
  id: string;
  name: string;
  art: string;
  line: string;
}

export const STORY_NPCS: Record<string, StoryNpc> = {
  handler: {
    id: "handler", name: "Handler Seo", art: "/art/npc-handler.jpg",
    line: "The Association files you as a low-tier asset. Personally, I file you as unfinished.",
  },
  mentor: {
    id: "mentor", name: "Master Kang", art: "/art/npc-mentor.jpg",
    line: "Everyone dies in the Gate they weren't ready for. So we get you ready for all of them.",
  },
  system: {
    id: "system", name: "The System", art: "/art/npc-system.jpg",
    line: "You have acquired the qualifications to be a Player. Will you accept?",
  },
};

const REGION_ENEMIES: Record<string, [string, string, string]> = {
  verdant: ["Moss Crawler", "Ruined Hound", "Thorn Stalker"],
  marsh: ["Bog Lurker", "Drowned Sentry", "Reed Stalker"],
  caverns: ["Cinder Bat", "Slag Golem", "Ash Revenant"],
  citadel: ["Gate Sentinel", "Hollow Knight", "Crimson Acolyte"],
};

const FIELD_TEMPLATES: { title: string; briefing: string; prose: string }[] = [
  {
    title: "Hunt the stragglers",
    briefing: "Clear the shallow edge of the Gate and report what lives there.",
    prose: "The System marks three shapes moving through the debris. None of them have noticed you yet, which is the only advantage you get.",
  },
  {
    title: "Escort the survey team",
    briefing: "Association surveyors need the corridor held while they take readings.",
    prose: "The surveyors work fast and talk faster. Something in the dark keeps pace with the lantern light, just outside it.",
  },
  {
    title: "Recover the fallen",
    briefing: "Retrieve the gear of the last raid party. Fight whatever is wearing it.",
    prose: "You find the pack first, still buckled. The thing dragging it turns around slowly, as if annoyed to be interrupted.",
  },
  {
    title: "Seal the side passage",
    briefing: "Close the breach before more of them come through.",
    prose: "Mana leaks from the crack in a thin, steady line. Small things have been drinking at it, and they are no longer small.",
  },
  {
    title: "Break the nest",
    briefing: "Destroy the spawning ground at the centre of the floor.",
    prose: "The floor is soft and warm and moving slightly. Whatever is underfoot has been here longer than the Gate has.",
  },
];

const BEAT_LEVELS = [1, 5, 10, 15, 20, 25, 30, 35, 39, 40];

interface Beat {
  kind: StoryEpisode["kind"];
  title: string;
  enemy: string;
  enemyArt?: string;
  npc?: string;
  briefing: string;
  prose: string;
  gold: number;
  rewardNote: string;
}

const BEATS: Record<number, Beat> = {
  1: {
    kind: "boss", title: "The first Gate", enemy: "Blood-Red Hobgoblin", enemyArt: "/art/boss-hobgoblin.jpg", npc: "system",
    briefing: "Defeat the Gate's guardian. Prove you can hold a weapon before the Association issues you one.",
    prose: "It is smaller than the stories say a monster should be, and it is still twice your size. It has been eating the people who came before you.",
    gold: 35, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  5: {
    kind: "story", title: "The Association's offer", enemy: "Marsh Lurker", npc: "handler",
    briefing: "Handler Seo wants proof before she files you as anything but a body.",
    prose: "She watches you from the ridge with her arms folded, taking notes on a hunter she has already decided not to bet on.",
    gold: 70, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  10: {
    kind: "boss", title: "Stone Sentinel", enemy: "Stone Sentinel", enemyArt: "/art/boss-sentinel.jpg",
    briefing: "The ruins' guardian has woken. It does not intend to let the survey finish.",
    prose: "It was a statue for four hundred years and it is still faster than you expected. Each step cracks the flagstones it leaves behind.",
    gold: 110, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  15: {
    kind: "story", title: "Master Kang's lesson", enemy: "Ashen Revenant", npc: "mentor",
    briefing: "Kang will not teach you anything until you can survive his first test.",
    prose: "He drops you into the ash without a warning or a rope. The thing that meets you at the bottom has been dead for years and has not stopped moving.",
    gold: 150, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  20: {
    kind: "boss", title: "Iron Tusk", enemy: "Iron Tusk", enemyArt: "/art/boss-irontusk.jpg",
    briefing: "A cavern beast at the mana fall. Kill it or turn the whole floor over to it.",
    prose: "It wears a broken sword in one shoulder like a splinter it never bothered to remove. The wound should have killed it twice over.",
    gold: 190, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  25: {
    kind: "story", title: "The handler's wager", enemy: "Void Serpent", npc: "handler",
    briefing: "Seo has put her own name on your file. Do not make her regret it.",
    prose: "The serpent does not swim so much as decide where the water should be. She shouts something encouraging and mostly profane from the bank.",
    gold: 230, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  30: {
    kind: "boss", title: "Black Fang Alpha", enemy: "Black Fang Alpha", enemyArt: "/art/boss-alpha.jpg",
    briefing: "The pack's alpha has been feeding on hunters for a month. End it.",
    prose: "It circles without hurrying. The rest of the pack stays back, which tells you exactly how these fights usually end.",
    gold: 270, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  35: {
    kind: "story", title: "Kang's last condition", enemy: "Crimson Ogre", npc: "mentor",
    briefing: "One more floor with Kang watching, and he will call you a hunter.",
    prose: "The ogre has been drinking from the mana vent for years. Kang doesn't step in, and doesn't look away either.",
    gold: 320, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  39: {
    kind: "boss", title: "The Gate Warden", enemy: "Gate Warden", enemyArt: "/art/boss-warden.jpg",
    briefing: "The last thing between you and the top of the Citadel. Everything else you have fought was a lesser version of it.",
    prose: "It has guarded this floor since before the Association had a name for what a Gate was. It looks at you the way a wall looks at weather.",
    gold: 420, rewardNote: "First clear: +2 skill points for your ✦ Skill Tree, plus gold.",
  },
  40: {
    kind: "job", title: "The Job Change", enemy: "Trial Warden", enemyArt: "/art/ceremony-job-change.jpg", npc: "system",
    briefing: "The System has prepared a class nobody has held before. Accept it, or stay exactly what you are.",
    prose: "You are standing in your own shadow and it is the wrong shape. The System asks the question it has been building toward since level one.",
    gold: 600, rewardNote: "First clear: the Job Change ceremony, a Monarch path, and its first Gate.",
  },
};

function regionFor(level: number): StoryRegion {
  return STORY_REGIONS.find((region) => level >= region.from && level <= region.to) ?? STORY_REGIONS[0];
}

/**
 * One tile of Act I. Deterministic: level in, episode out, always the same.
 */
export function buildEpisode(level: number): StoryEpisode {
  const region = regionFor(level);
  const beat = BEATS[level];
  if (beat) {
    return {
      level, kind: beat.kind, region: region.id, title: beat.title, enemy: beat.enemy,
      enemyArt: beat.enemyArt, npc: beat.npc, briefing: beat.briefing, prose: beat.prose,
      gold: beat.gold, rewardNote: beat.rewardNote,
    };
  }
  const template = FIELD_TEMPLATES[level % FIELD_TEMPLATES.length];
  const enemies = REGION_ENEMIES[region.id];
  const enemy = enemies[level % enemies.length];
  return {
    level, kind: "field", region: region.id, title: template.title, enemy,
    briefing: template.briefing, prose: template.prose,
    gold: 10 + level * 4,
    rewardNote: `Clear reward: ${10 + level * 4} gold, paid once.`,
  };
}

/** Act I, one tile per level, in map order. */
export const STORY_EPISODES: readonly StoryEpisode[] = Array.from({ length: 40 }, (_, index) => buildEpisode(index + 1));

export const STORY_BEAT_LEVELS: readonly number[] = BEAT_LEVELS;

export function getEpisode(level: number): StoryEpisode | null {
  return STORY_EPISODES.find((episode) => episode.level === level) ?? null;
}
