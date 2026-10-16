// Ashenveil Expeditions — world data for five hand-built regions.
// One map per story area, all aligned to the painted ground layers in
// public/art/*-ground.png (64×64 tiles of 16px). Collision is DERIVED:
// every region declares a solid mode + carved walk rects + hazards, so the
// player can never leave the authored ground of any area.
import { TILE } from "./core";

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
  // — expedition ledger (new in the merged story) —
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
}

export const MAP_TILES = 64;
export const MAP_PX = MAP_TILES * TILE;

export interface NpcDef {
  id: string;
  x: number; y: number; // tile anchor (feet = bottom of sprite)
  sprite: string;       // npc palette key in view
  facing: "down" | "up" | "left" | "right";
  dialogue: string;     // key into script.ts
  hideAfter?: string;   // world flag that removes them
}

export interface PropDef {
  sprite: string;
  x: number; y: number; // px, top-left
  w: number; h: number; // px, drawn size
  solid: "footprint" | "bottom" | "none";
  occlude?: boolean;
  gate?: boolean;       // ridge portcullis: solid until flags.gateOpen
  interact?: { id: string; prompt: string };
}

export interface SignDef { x: number; y: number; text: string; }

export interface ZoneDef {
  id: string;
  rect: [number, number, number, number];
  quota: number;
  enemies: string[];
  level: number;
  /** random encounters adapt to the player but never leave this band */
  min?: number;
  max?: number;
}

export interface DecorCmd {
  kind: "ice" | "bridge" | "walls" | "glow" | "slab" | "bridgeRow";
  rect?: [number, number, number, number]; // tiles x,y,w,h
  tiles?: [number, number][];
  x?: number; y?: number; r?: number; c?: string;
}

export interface RegionBossDef {
  id: string; name: string; level: number;
  x: number; y: number; // tile of the gate prop the player walks into
  unlocks?: string;     // region exit that opens after this boss is resolved
}

export interface WorldDef {
  region: {
    id: string; name: string; from: number; to: number;
    ground: string; music: "town" | "battle" | "boss" | "final" | "marsh" | "cave";
    mode: "open" | "water" | "cave" | "hall";
  };
  spawn: { x: number; y: number };
  props: PropDef[];
  npcs: NpcDef[];
  signs: SignDef[];
  zones: ZoneDef[];
  decor: DecorCmd[];
  boss?: RegionBossDef;
  exit?: { x: number; y: number; to: string; label: string };
  walk?: [number, number, number, number][]; // carved walkable rects (water/cave modes) x,y,w,h
  hazard?: [number, number, number, number][]; // forced-solid rects (lava etc.)
}

// ---------------- flag helpers ----------------

export function freshFlags(): WorldFlags {
  return {
    hasKey: false, dogFound: false, dogReturned: false, gateOpen: false,
    killsPines: 0, killsRidge: 0, sparedHare: false, sparedHound: false, sparedKesh: false,
    architectSpared: false, met: {}, bought: {}, bossDone: false, keshKilled: false,
    genocideZone: false, tpDone: false, genDone: false, deaths: 0, saved: false,
    // expedition ledger
    bossDown: {}, sparedStory: {}, regionDone: {},
    killsTotal: 0, savedPair: false, kangBond: false, emberBond: false, chainedTusk: false,
    unregistered: false, introDone: false, trackerSeen: {}, ceremonyAnswer: "",
  };
}

export function zoneAt(world: WorldDef, px: number, py: number): ZoneDef | null {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  for (const z of world.zones) {
    const [x0, y0, w, h] = z.rect;
    if (tx >= x0 && tx <= x0 + w && ty >= y0 && ty <= y0 + h) return z;
  }
  return null;
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

export function clampPos(v: number, span: number): number {
  return Math.min(Math.max(v, span), MAP_PX - span);
}

function hash(x: number, y: number, salt: number): number {
  return Math.abs(Math.floor((x * 7919 + y * 104729 + salt * 6151) % 1000)) / 1000;
}

// ---------------- region builders ----------------

const P = (x: number, y: number, w: number, h: number, sprite: string, extra?: Partial<PropDef>): PropDef =>
  ({ sprite, x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE, solid: "footprint", ...extra });

function buildVerdant(): WorldDef {
  const props: PropDef[] = [];
  // ruined plaza columns, aligned to the painted cobble circle (cols 22..38, rows 34..48)
  for (const [x, y] of [[23, 36], [27, 34], [35, 34], [37, 38], [23, 45], [36, 46]] as const) {
    props.push(P(x, y, 1, 1.4, "pillar", { occlude: true }));
  }
  props.push(P(28, 39, 3, 2, "shrine", { occlude: true, interact: { id: "plaza.shrine", prompt: "READ" } }));
  // forest scatter — two encounter thickets either side of the road (road = cols 29..34)
  for (let y = 14; y <= 40; y++) for (let x = 5; x <= 26; x++) {
    if (hash(x, y, 1) < 0.30) props.push(P(x, y - 0.75, 0.875, 1.75, "gpine", { occlude: true }));
  }
  for (let y = 14; y <= 24; y++) for (let x = 37; x <= 57; x++) {
    if (x >= 48 && x <= 55 && y >= 20) continue; // keep the pond open
    if (hash(x, y, 2) < 0.26) props.push(P(x, y - 0.75, 0.875, 1.75, "gpine", { occlude: true }));
  }
  for (const [x, y] of [[20, 30], [33, 26], [41, 31], [14, 36]] as const) props.push(P(x, y, 0.6, 0.5, "bones"));
  // the pond is shallow — its rim walks; water itself blocks
  for (let tx = 48; tx <= 55; tx++) props.push(P(tx, 27, 1, 4, "water", { solid: "footprint" }));
  // north gate arch to the Marsh
  props.push(P(30, 3, 4, 1.5, "arch", { occlude: true }));

  return {
    region: { id: "verdant", name: "VERDANT RUINS", from: 1, to: 9, ground: "art/verdant-ground.png", music: "town", mode: "open" },
    spawn: { x: 31.5 * TILE, y: 57 * TILE },
    props,
    npcs: [
      { id: "seo", x: 36, y: 43, sprite: "seo", facing: "left", dialogue: "seo.verdant" },
      { id: "hana", x: 25, y: 46, sprite: "hana", facing: "down", dialogue: "hana.verdant" },
      { id: "jino", x: 27, y: 47, sprite: "jino", facing: "down", dialogue: "jino.verdant" },
      { id: "roan", x: 38, y: 40, sprite: "roan", facing: "down", dialogue: "roan.verdant", hideAfter: "genocideVerdant" },
    ],
    signs: [
      { x: 29, y: 49, text: "sign.v.gate" },
      { x: 50, y: 26, text: "sign.v.pond" },
      { x: 31, y: 5, text: "sign.v.shrine" },
      { x: 20, y: 14, text: "sign.v.road" },
      { x: 26, y: 44, text: "sign.v.camp" },
    ],
    zones: [
      { id: "thicket", rect: [5, 14, 22, 26], quota: 5, enemies: ["crawler", "rhound", "stalker", "crawler", "rhound"], level: 3, min: 1, max: 9 },
      { id: "garden", rect: [37, 14, 20, 10], quota: 5, enemies: ["stalker", "rhound", "crawler", "stalker"], level: 5, min: 1, max: 9 },
    ],
    decor: [
      { kind: "glow", x: 29.6 * TILE, y: 41 * TILE, r: 22, c: "#9fe8a4" },
    ],
    boss: { id: "hobgoblin", name: "BLOOD-RED HOBGOBLIN", level: 5, x: 31, y: 6, unlocks: "exit" },
    exit: { x: 31.5, y: 2.2, to: "marsh", label: "SUNKEN MARSH" },
  };
}

function buildMarsh(): WorldDef {
  // the painted map is WATER; boardwalks + islands are carved walk-rects
  const walk: [number, number, number, number][] = [
    [35, 2, 4, 57],   // main N-S boardwalk (4 wide, like the painted planks)
    [6, 35, 51, 4],   // main E-W boardwalk
    [8, 14, 32, 3],   // north crossing
    [36, 20, 18, 20], // village island
    [24, 14, 12, 10], // north island
    [8, 20, 10, 12],  // west islands
    [10, 44, 16, 14], // southwest island
    [47, 38, 12, 12], // sunken-stairs platform
    [34, 25, 4, 10],  // village link
    [36, 24, 3, 12],
  ];
  const props: PropDef[] = [];
  props.push(P(38, 22, 2, 1.6, "hut", { occlude: true }));
  props.push(P(43, 22, 2, 1.6, "hut", { occlude: true }));
  props.push(P(48, 27, 2, 1.6, "hut", { occlude: true }));
  props.push(P(38, 29, 2, 1.6, "hut", { occlude: true, interact: { id: "shop.sila", prompt: "TRADE" } }));
  props.push(P(51, 41, 1.2, 1, "crystal", { occlude: false })); // rune stair glow
  props.push(P(49, 44, 1.2, 1, "crystal", { occlude: false }));
  for (const [x, y] of [[12, 47], [20, 50], [28, 17], [14, 25]] as const) props.push(P(x, y, 0.6, 0.5, "bones"));
  props.push(P(9, 26, 1.5, 1, "boat", { occlude: false }));
  props.push(P(13, 49, 1.5, 1, "boat", { occlude: false }));
  return {
    region: { id: "marsh", name: "SUNKEN MARSH", from: 10, to: 19, ground: "art/marsh-ground.png", music: "marsh", mode: "water" },
    spawn: { x: 37 * TILE, y: 4 * TILE },
    walk,
    props, npcs: [
      { id: "sila", x: 40, y: 33, sprite: "sila", facing: "down", dialogue: "sila.marsh" },
      { id: "seo", x: 37, y: 38, sprite: "seo", facing: "down", dialogue: "seo.marsh" },
      { id: "reed", x: 15, y: 48, sprite: "reedwatcher", facing: "down", dialogue: "reedwatcher.marsh", hideAfter: "genocideMarsh" },
    ],
    signs: [
      { x: 35, y: 6, text: "sign.m.arrive" },
      { x: 46, y: 31, text: "sign.m.village" },
      { x: 30, y: 37, text: "sign.m.posters" },
      { x: 50, y: 40, text: "sign.m.stairs" },
    ],
    zones: [
      { id: "reedflats", rect: [8, 14, 18, 8], quota: 5, enemies: ["lurker", "reed", "dsentry", "lurker"], level: 11, min: 10, max: 19 },
      { id: "deepbog", rect: [8, 44, 16, 12], quota: 5, enemies: ["dsentry", "lurker", "reed", "dsentry"], level: 15, min: 10, max: 19 },
    ],
    decor: [
      { kind: "bridgeRow", rect: [35, 2, 4, 57] },
      { kind: "bridgeRow", rect: [6, 35, 51, 4] },
      { kind: "bridgeRow", rect: [8, 14, 32, 3] },
      { kind: "bridgeRow", rect: [34, 25, 4, 10] },
      { kind: "slab", rect: [47, 38, 12, 12] },
      { kind: "glow", x: 51.5 * TILE, y: 42 * TILE, r: 18, c: "#9fe8d2" },
    ],
    boss: { id: "sentinel", name: "STONE SENTINEL", level: 12, x: 29, y: 18, unlocks: "exit" },
    exit: { x: 37, y: 57.5, to: "caverns", label: "ASHEN CAVERNS" },
  };
}

function buildCaverns(): WorldDef {
  const walk: [number, number, number, number][] = [
    [2, 3, 12, 8],     // entry hall
    [2, 8, 40, 5],    // top gallery road (stops where the painted rock rises)
    [16, 13, 22, 10], // stal rooms
    [8, 22, 28, 22],  // great hall — the shelves: west col 8–14, north rows 22–24, east cols 33–35
    [36, 24, 18, 6],  // right gallery
    [44, 30, 10, 16], // rail shaft (down to the boss hall mouth only)
    [26, 42, 20, 8],  // south corridor
    [38, 46, 22, 14], // boss hall
  ];
  const hazard: [number, number, number, number][] = [
    [15, 25, 18, 17], // the big lava ring, as painted
    [40, 46, 10, 6],  // boss-hall pool
    [20, 15, 3, 3],   // ceiling-collapse pits
  ];
  const props: PropDef[] = [];
  for (const [x, y] of [[10, 24], [30, 24], [10, 40], [30, 40], [40, 26], [42, 48]] as const) {
    props.push(P(x, y, 0.75, 1, "crystal"));
  }
  for (const [x, y] of [[13, 24], [17, 22], [31, 30], [24, 38], [48, 44]] as const) {
    props.push(P(x, y, 0.75, 0.75, "dead", { occlude: true }));
  }
  props.push(P(9, 25, 1.5, 1, "shrine", { occlude: true })); // Verity's altar
  props.push(P(48, 33, 1.5, 1, "bones")); // what the minecarts came home in
  props.push(P(47, 31, 0.75, 1.2, "pillar", { occlude: true }));
  props.push(P(52, 52, 3, 2, "arch", { occlude: true, solid: "none" })); // lift to the Citadel
  return {
    region: { id: "caverns", name: "ASHEN CAVERNS", from: 20, to: 32, ground: "art/caverns-ground.png", music: "cave", mode: "cave" },
    spawn: { x: 7 * TILE, y: 5 * TILE },
    walk, hazard,
    props, npcs: [
      { id: "kang", x: 30, y: 17, sprite: "kang", facing: "down", dialogue: "kang.caverns" },
      { id: "verity", x: 11, y: 27, sprite: "verity", facing: "down", dialogue: "verity.caverns" },
      { id: "ember", x: 24, y: 15, sprite: "ember", facing: "down", dialogue: "ember.caverns", hideAfter: "genocideCaverns" },
      { id: "seo", x: 5, y: 7, sprite: "seo", facing: "down", dialogue: "seo.caverns" },
    ],
    signs: [
      { x: 25, y: 9, text: "sign.c.rails" },
      { x: 12, y: 26, text: "sign.c.lava" },
      { x: 40, y: 49, text: "sign.c.tusk" },
      { x: 13, y: 23, text: "sign.c.cult" },
    ],
    zones: [
      { id: "galleries", rect: [16, 13, 22, 9], quota: 5, enemies: ["bat", "golem", "revenant", "bat"], level: 22, min: 20, max: 27 },
      { id: "shafts", rect: [36, 24, 18, 6], quota: 5, enemies: ["golem", "revenant", "bat", "golem"], level: 26, min: 20, max: 32 },
    ],
    decor: [
      { kind: "glow", x: 23 * TILE, y: 32 * TILE, r: 30, c: "#ff8a3c" },
      { kind: "glow", x: 46.5 * TILE, y: 49 * TILE, r: 16, c: "#ff8a3c" },
    ],
    boss: { id: "irontusk", name: "IRON TUSK", level: 20, x: 45, y: 53, unlocks: "exit" },
    exit: { x: 53.5, y: 53.5, to: "citadel", label: "MONARCH'S CITADEL" },
  };
}

function buildCitadel(): WorldDef {
  const props: PropDef[] = [];
  for (const row of [10, 22, 44, 54]) for (const col of [8, 20, 42, 54]) {
    props.push(P(col, row, 0.9, 1, "column", { occlude: true }));
  }
  for (const [x, y] of [[14, 16], [14, 48], [48, 16], [48, 48], [31, 14]] as const) {
    props.push(P(x, y, 0.7, 0.8, "brazier"));
  }
  props.push(P(29, 6, 3, 2, "throne", { occlude: true }));
  props.push(P(3, 30, 2, 1.5, "arch", { occlude: true, solid: "none" })); // the unregistered door (west wall)
  return {
    region: { id: "citadel", name: "MONARCH'S CITADEL", from: 33, to: 40, ground: "art/citadel-ground.png", music: "marsh", mode: "hall" },
    spawn: { x: 31.5 * TILE, y: 58 * TILE },
    props, npcs: [
      { id: "herald", x: 31, y: 20, sprite: "herald", facing: "down", dialogue: "herald.citadel" },
      { id: "ivy", x: 24, y: 27, sprite: "ivy", facing: "down", dialogue: "ivy.citadel" },
      { id: "seo", x: 38, y: 27, sprite: "seo", facing: "down", dialogue: "seo.citadel" },
    ],
    signs: [
      { x: 31, y: 57, text: "sign.t.enter" },
      { x: 56, y: 36, text: "sign.t.crack" },
      { x: 27, y: 7, text: "sign.t.throne" },
      { x: 4, y: 32, text: "sign.t.door" },
    ],
    zones: [
      { id: "hall", rect: [6, 34, 52, 24], quota: 5, enemies: ["gsent", "hknife", "acolyte", "gsent", "acolyte"], level: 35, min: 33, max: 40 },
    ],
    decor: [
      { kind: "walls", tiles: [[0, 0], [1, 0], [62, 0], [63, 0]] },
    ],
    boss: { id: "warden", name: "THE GATE WARDEN", level: 38, x: 31, y: 9, unlocks: "ceremony" },
    exit: { x: 3.6, y: 31, to: "ashenveil", label: "THE UNREGISTERED DOOR" },
  };
}

// Ashenveil — the capstone map (was the original game world; layout preserved)
function buildAshenveil(): WorldDef {
  const props: PropDef[] = [];
  props.push(P(22, 17, 8, 3, "water"));
  props.push(P(34, 17, 9, 3, "water"));
  props.push({ sprite: "bridgeRail", x: 30 * TILE, y: 16 * TILE, w: 4 * TILE, h: 16, solid: "none", occlude: false });
  props.push({ sprite: "bridgeRail", x: 30 * TILE, y: 20 * TILE, w: 4 * TILE, h: 16, solid: "none", occlude: false });
  props.push({ sprite: "inn", x: 11 * TILE, y: 25 * TILE, w: 28, h: 18, solid: "bottom", occlude: true });
  props.push({ sprite: "house", x: 19 * TILE, y: 26 * TILE, w: 16, h: 10, solid: "bottom", occlude: true });
  props.push({ sprite: "stall", x: 24 * TILE, y: 33 * TILE, w: 24, h: 11, solid: "bottom" });
  props.push({ sprite: "stall2", x: 24 * TILE, y: 36 * TILE, w: 24, h: 11, solid: "bottom" });
  props.push({ sprite: "obelisk", x: 31 * TILE - 4, y: 28 * TILE - 4, w: 12, h: 19, solid: "footprint", occlude: true, interact: { id: "save", prompt: "SAVE" } });
  props.push({ sprite: "gate", x: 30 * TILE, y: 12 * TILE, w: 24, h: 28, solid: "none", gate: true, occlude: true });
  for (let y = 4; y <= 12; y++) for (let x = 22; x <= 44; x++) {
    if (x >= 29 && x <= 34 && y >= 9) continue;
    if (hash(x, y, 3) < 0.20) props.push({ sprite: "dead", x: x * TILE, y: y * TILE, w: 12, h: 10, solid: "footprint", occlude: true });
  }
  props.push({ sprite: "house", x: 24 * TILE, y: 5 * TILE, w: 16, h: 10, solid: "bottom", occlude: true });
  props.push({ sprite: "portal", x: 58 * TILE, y: 26 * TILE, w: 16, h: 13, solid: "footprint", interact: { id: "bossGate", prompt: "ENTER" } });
  props.push({ sprite: "arch", x: 1 * TILE, y: 30 * TILE, w: 24, h: 24, solid: "none", interact: { id: "goBack", prompt: "RETURN" } });
  for (let y = 46; y <= 62; y++) for (let x = 10; x <= 52; x++) {
    if (x >= 28 && x <= 35) continue;
    if (hash(x, y, 1) < 0.30) props.push({ sprite: "pine", x: x * TILE - 2, y: y * TILE - 12, w: 14, h: 28, solid: "footprint", occlude: true });
  }
  return {
    region: { id: "ashenveil", name: "ASHENVEIL", from: 1, to: 40, ground: "art/ashenveil-ground.png", music: "town", mode: "open" },
    spawn: { x: 31.5 * TILE, y: 33.5 * TILE },
    props,
    npcs: [
      { id: "miso", x: 25.5, y: 34.5, sprite: "shopgirl", facing: "down", dialogue: "shop.miso" },
      { id: "baek", x: 13.5, y: 31.2, sprite: "innkeep", facing: "down", dialogue: "inn.baek", hideAfter: "genocideZone" },
      { id: "kid", x: 36.5, y: 27.5, sprite: "kid", facing: "down", dialogue: "kid.lost", hideAfter: "dogReturned" },
      { id: "prof", x: 26.5, y: 23.5, sprite: "prof", facing: "down", dialogue: "prof.lessons", hideAfter: "genocideZone" },
      { id: "skater", x: 45.5, y: 45.5, sprite: "skater", facing: "down", dialogue: "skater.ryu", hideAfter: "genocideZone" },
      { id: "hermit", x: 25.5, y: 8.5, sprite: "hermit", facing: "down", dialogue: "hermit.shadow", hideAfter: "keshKilled" },
      { id: "dog", x: 21.5, y: 53.5, sprite: "houndOw", facing: "down", dialogue: "dog.rock", hideAfter: "dogFound" },
    ],
    signs: [
      { x: 31.2, y: 60.5, text: "sign.entry" },
      { x: 28.5, y: 30.5, text: "sign.plaza" },
      { x: 37.5, y: 33.5, text: "sign.crater" },
      { x: 34.5, y: 15.5, text: "sign.gate" },
      { x: 24.5, y: 22.5, text: "sign.river" },
      { x: 38.5, y: 24.5, text: "sign.bench" },
      { x: 46.5, y: 44.5, text: "sign.pond" },
      { x: 23.5, y: 10.5, text: "sign.ridge" },
    ],
    zones: [
      { id: "pines", rect: [8, 46, 48, 17], quota: 7, min: 1, max: 9, enemies: ["hare", "hare", "hound", "hare", "imp", "hound"], level: 3 },
      { id: "ridge", rect: [20, 3, 27, 10], quota: 7, min: 7, max: 16, enemies: ["imp", "wight", "hare", "wight", "hound", "imp"], level: 9 },
    ],
    decor: [
      { kind: "ice", rect: [22, 17, 21, 3] },
      { kind: "bridge", rect: [30, 17, 4, 3] },
      { kind: "walls", tiles: [[28, 13], [29, 13], [35, 13], [36, 13]] },
      { kind: "glow", x: 31 * TILE + 2, y: 28 * TILE + 20, r: 26, c: "#3fd2ff" },
    ],
  };
}

const REGION_BUILDERS: Record<string, () => WorldDef> = {
  verdant: buildVerdant, marsh: buildMarsh, caverns: buildCaverns, citadel: buildCitadel, ashenveil: buildAshenveil,
};

export const REGION_ORDER = ["verdant", "marsh", "caverns", "citadel", "ashenveil"] as const;

export function buildWorld(regionId = "ashenveil"): WorldDef {
  const build = REGION_BUILDERS[regionId] ?? buildAshenveil;
  return build();
}

// ---------------- collision grid ----------------

export function buildCollider(world: WorldDef, flags: WorldFlags): Uint8Array {
  const g = new Uint8Array(MAP_TILES * MAP_TILES);
  const mark = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y <= Math.min(MAP_TILES - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(MAP_TILES - 1, x1); x++) g[y * MAP_TILES + x] = 1;
  };
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y <= Math.min(MAP_TILES - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(MAP_TILES - 1, x1); x++) g[y * MAP_TILES + x] = 0;
  };
  const mode = world.region.mode;
  if (mode === "water" || mode === "cave") {
    mark(0, 0, MAP_TILES - 1, MAP_TILES - 1);
    for (const [x, y, w, h] of world.walk ?? []) carve(x, y, x + w - 1, y + h - 1);
    for (const [x, y, w, h] of world.hazard ?? []) mark(x, y, x + w - 1, y + h - 1);
  } else {
    mark(0, 0, MAP_TILES - 1, 0); mark(0, MAP_TILES - 1, MAP_TILES - 1, MAP_TILES - 1);
    mark(0, 0, 0, MAP_TILES - 1); mark(MAP_TILES - 1, 0, MAP_TILES - 1, MAP_TILES - 1);
    if (mode === "hall") { mark(0, 0, 3, 3); mark(MAP_TILES - 4, 0, MAP_TILES - 1, 3); mark(0, MAP_TILES - 4, 3, MAP_TILES - 1); mark(MAP_TILES - 4, MAP_TILES - 4, MAP_TILES - 1, MAP_TILES - 1); }
    for (const p of world.props) {
      if (p.gate) { if (!flags.gateOpen) mark(28, 13, 36, 13); continue; }
      if (p.solid === "none") continue;
      const tx0 = Math.floor(p.x / TILE), ty0 = Math.floor(p.y / TILE);
      const tx1 = Math.floor((p.x + p.w - 1) / TILE);
      const ty1 = Math.floor((p.y + p.h - 1) / TILE);
      if (p.solid === "footprint") {
        if (p.sprite === "water") mark(tx0, ty0, tx1, ty1);
        else mark(tx0, ty1, tx1, ty1);
      } else {
        const bandY0 = ty0 + Math.floor((ty1 - ty0 + 1) * 0.55);
        mark(tx0, bandY0, tx1, ty1);
      }
    }
  }
  // region exits are bricked up until the boss is resolved
  if (world.exit && world.boss && !flags.bossDown[world.boss.id]) {
    const e = world.exit;
    mark(Math.floor(e.x) - 1, Math.floor(e.y) - 1, Math.floor(e.x) + 1, Math.floor(e.y) + 1);
  }
  // the Citadel's unregistered door needs the ceremony, not just the boss
  if (world.region.id === "citadel" && !flags.unregistered) {
    const e = world.exit!;
    mark(Math.floor(e.x) - 1, Math.floor(e.y) - 1, Math.floor(e.x) + 1, Math.floor(e.y) + 1);
  }
  // props in carved regions still block their footprints
  if ((mode === "water" || mode === "cave")) {
    for (const p of world.props) {
      if (p.solid !== "footprint") continue;
      const tx0 = Math.floor(p.x / TILE), tx1 = Math.floor((p.x + p.w - 1) / TILE);
      const ty1 = Math.floor((p.y + p.h - 1) / TILE);
      mark(tx0, ty1, tx1, ty1);
    }
  }
  return g;
}

export function solidAtGrid(g: Uint8Array, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return true;
  return g[ty * MAP_TILES + tx] === 1;
}

export interface WorldSaveData { region: string; x: number; y: number; flags: WorldFlags; }
