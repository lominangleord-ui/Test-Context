// Ashenveil — world facade v2. The floor itself lives in floor.ts (art folders,
// collision.png masks, objects.json). What remains here is the story ledger:
// the flags every floor shares, the route math, and the save envelope.
export {
  makeFloor, loadFloorArt, placeholderGround, posBlocked, stepMove, atHazard,
  onExit, onRest, inZone, overBoss, saveToJson, maskToCanvas,
  FOOT, CELL, MASK, CHUNK_U, VIEW_UX, VIEW_UY, ART_PER_UNIT,
  FLOOR_IDS, FLOOR_META, Mask,
  type Floor, type FloorSave, type PropObj, type NpcObj, type SignObj, type ExitObj,
  type RestObj, type ZoneObj, type BossObj,
} from "./floor";

export interface WorldFlags {
  hasKey: boolean;
  dogFound: boolean;
  dogReturned: boolean;
  gateOpen: boolean;
  killsPines: number;
  killsRidge: number;
  sparedHare: boolean;
  sparedHound: boolean;
  sparedKesh: boolean;
  architectSpared: boolean;
  met: Record<string, number>;
  bought: Record<string, number>;
  bossDone: boolean;
  keshKilled: boolean;
  genocideZone: boolean;
  tpDone: boolean;
  genDone: boolean;
  deaths: number;
  saved: boolean;
  // — expedition ledger —
  bossDown: Record<string, boolean>;
  sparedStory: Record<string, boolean>;
  regionDone: Record<string, boolean>;
  killsTotal: number;
  savedPair: boolean;   // the survey team's names answered in the Citadel
  kangBond: boolean;    // Master Kang trusts you
  emberBond: boolean;   // the cinder bat follows you
  chainedTusk: boolean; // you saw the chains before the fight
  unregistered: boolean; // the Job Change answer; the west door remembers
  introDone: boolean;
  ceremonyAnswer: string;
  trackerSeen: Record<string, boolean>;
  visitedFloors: Record<string, boolean>; // jumpToFloor marks arrivals; the objective graph routes on it
  trackedId: string;                   // journal-tracked objective ("" = follow the main line)
  created: boolean;                    // the locker-room mirror: appearance committed at least once
  floorHp: number; // overworld HP on the current floor (hazard burns, rests mend); 0 = untouched
}

export function freshFlags(): WorldFlags {
  return {
    hasKey: false, dogFound: false, dogReturned: false, gateOpen: false,
    killsPines: 0, killsRidge: 0, sparedHare: false, sparedHound: false, sparedKesh: false,
    architectSpared: false, met: {}, bought: {}, bossDone: false, keshKilled: false,
    genocideZone: false, tpDone: false, genDone: false, deaths: 0, saved: false,
    bossDown: {}, sparedStory: {}, regionDone: {},
    killsTotal: 0, savedPair: false, kangBond: false, emberBond: false, chainedTusk: false,
    unregistered: false, introDone: false, trackerSeen: {}, visitedFloors: {}, trackedId: "", created: false, ceremonyAnswer: "", floorHp: 0,
  };
}

export function totalKills(f: WorldFlags): number { return f.killsPines + f.killsRidge; }
export function storyKills(f: WorldFlags): number { return f.killsTotal; }
export function bossesDown(f: WorldFlags): number { return Object.values(f.bossDown).filter(Boolean).length; }

/** Which finale this save is heading toward, by what you've done. */
export function routeOf(f: WorldFlags): "pacifist" | "neutral" | "genocide" {
  if (f.genDone) return "genocide";
  if (totalKills(f) >= 12) return "genocide";
  if (bossesDown(f) >= 4 && totalKills(f) + f.killsTotal >= 24) return "genocide";
  if (totalKills(f) === 0 && f.killsTotal === 0 && (f.sparedKesh || f.bossDone)) return "pacifist";
  return "neutral";
}

export interface WorldSaveData { region: string; x: number; y: number; flags: WorldFlags }
