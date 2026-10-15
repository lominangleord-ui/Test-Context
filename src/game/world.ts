// Ashenveil — world map data: one large hand-laid map over the generated ground.
// 64×64 tiles @16px = 1024², matched to public/art/ashenveil-ground.png:
// plaza medallion centered ~tile (31,31); N-S road on cols 29-34; scorched path east at rows 29-34; frozen pond SE.

import { TILE, clamp } from "./core";

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
  occlude?: boolean;    // drawn after the player when the player stands above its baseline
  gate?: boolean;       // ridge portcullis: solid until flags.gateOpen
  interact?: { id: string; prompt: string };
}

export interface SignDef { x: number; y: number; text: string; }

export interface ZoneDef {
  id: "pines" | "ridge";
  rect: [number, number, number, number];
  quota: number;
  enemies: string[];
  level: number;
}

export interface WorldDef {
  spawn: { x: number; y: number };
  props: PropDef[];
  npcs: NpcDef[];
  signs: SignDef[];
  zones: ZoneDef[];
}

function hash(x: number, y: number, salt: number): number {
  return Math.abs(Math.floor((x * 7919 + y * 104729 + salt * 6151) % 1000)) / 1000;
}

export function buildWorld(): WorldDef {
  const props: PropDef[] = [];

  // ---- frozen stream (view draws ice tiles; solid except the bridge span) ----
  // rows 17..19, cols 22..42; bridge crosses at cols 30..33 (rows 16..20 drawn as planks)
  props.push({ sprite: "water", x: 22 * TILE, y: 17 * TILE, w: 8 * TILE, h: 3 * TILE, solid: "footprint" });
  props.push({ sprite: "water", x: 34 * TILE, y: 17 * TILE, w: 9 * TILE, h: 3 * TILE, solid: "footprint" });
  props.push({ sprite: "bridgeRail", x: 30 * TILE, y: 16 * TILE, w: 4 * TILE, h: 16, solid: "none", occlude: false });
  props.push({ sprite: "bridgeRail", x: 30 * TILE, y: 20 * TILE, w: 4 * TILE, h: 16, solid: "none", occlude: false });

  // ---- town west of the plaza ----
  props.push({ sprite: "inn", x: 11 * TILE, y: 25 * TILE, w: 28, h: 18, solid: "bottom", occlude: true });
  props.push({ sprite: "house", x: 19 * TILE, y: 26 * TILE, w: 16, h: 10, solid: "bottom", occlude: true });
  props.push({ sprite: "stall", x: 24 * TILE, y: 33 * TILE, w: 24, h: 11, solid: "bottom" });
  props.push({ sprite: "stall2", x: 24 * TILE, y: 36 * TILE, w: 24, h: 11, solid: "bottom" });
  props.push({ sprite: "obelisk", x: 31 * TILE - 4, y: 28 * TILE - 4, w: 12, h: 19, solid: "footprint", occlude: true, interact: { id: "save", prompt: "SAVE" } });

  // ---- north ridge: the portcullis gate across the road ----
  props.push({ sprite: "gate", x: 30 * TILE, y: 12 * TILE, w: 24, h: 28, solid: "none", gate: true, occlude: true });

  for (let y = 4; y <= 12; y++) for (let x = 22; x <= 44; x++) {
    if (x >= 29 && x <= 34 && y >= 9) continue; // keep the road open north of the gate
    if (hash(x, y, 3) < 0.20) props.push({ sprite: "dead", x: x * TILE, y: y * TILE, w: 12, h: 10, solid: "footprint", occlude: true });
  }
  props.push({ sprite: "house", x: 24 * TILE, y: 5 * TILE, w: 16, h: 10, solid: "bottom", occlude: true });

  // ---- east: scorched path to the Gate ----
  props.push({ sprite: "portal", x: 58 * TILE, y: 26 * TILE, w: 16, h: 13, solid: "footprint", interact: { id: "bossGate", prompt: "ENTER" } });

  // ---- south forest: pines with a road gap and two clearings ----
  for (let y = 46; y <= 62; y++) for (let x = 10; x <= 52; x++) {
    if (x >= 28 && x <= 35) continue;
    const h = hash(x, y, 1);
    if (h < 0.30) props.push({ sprite: "pine", x: x * TILE - 2, y: y * TILE - 12, w: 14, h: 28, solid: "footprint", occlude: true });
  }

  const npcs: NpcDef[] = [
    { id: "miso", x: 25.5, y: 34.5, sprite: "shopgirl", facing: "down", dialogue: "shop.miso" },
    { id: "baek", x: 13.5, y: 31.2, sprite: "innkeep", facing: "down", dialogue: "inn.baek", hideAfter: "genocideZone" },
    { id: "kid", x: 36.5, y: 27.5, sprite: "kid", facing: "down", dialogue: "kid.lost", hideAfter: "dogReturned" },
    { id: "prof", x: 26.5, y: 23.5, sprite: "prof", facing: "down", dialogue: "prof.lessons", hideAfter: "genocideZone" },
    { id: "skater", x: 45.5, y: 45.5, sprite: "skater", facing: "down", dialogue: "skater.ryu", hideAfter: "genocideZone" },
    { id: "hermit", x: 25.5, y: 8.5, sprite: "hermit", facing: "down", dialogue: "hermit.shadow", hideAfter: "keshKilled" },
    { id: "dog", x: 21.5, y: 53.5, sprite: "houndOw", facing: "down", dialogue: "dog.rock", hideAfter: "dogFound" },
  ];
  const signs: SignDef[] = [
    { x: 31.2, y: 60.5, text: "sign.entry" },
    { x: 28.5, y: 30.5, text: "sign.plaza" },
    { x: 37.5, y: 33.5, text: "sign.crater" },
    { x: 34.5, y: 15.5, text: "sign.gate" },
    { x: 24.5, y: 22.5, text: "sign.river" },
    { x: 38.5, y: 24.5, text: "sign.bench" },
    { x: 46.5, y: 44.5, text: "sign.pond" },
    { x: 23.5, y: 10.5, text: "sign.ridge" },
  ];

  const zones: ZoneDef[] = [
    { id: "pines", rect: [8, 46, 55, 59], // south rows 60+ are the safe walk-in road
    quota: 7, enemies: ["hare", "hare", "hound", "hare", "imp", "hound"], level: 3 },
    { id: "ridge", rect: [20, 3, 46, 12], quota: 7, enemies: ["imp", "wight", "hare", "wight", "hound", "imp"], level: 9 },
  ];

  return { spawn: { x: 31.5 * TILE, y: 61 * TILE }, props, npcs, signs, zones };
}

// ---------------- collision grid ----------------

/** Build a solid-tile grid. gateOpen reopens the road through the portcullis. */
export function buildCollider(world: WorldDef, flags: WorldFlags): Uint8Array {
  const g = new Uint8Array(MAP_TILES * MAP_TILES);
  const mark = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y <= Math.min(MAP_TILES - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(MAP_TILES - 1, x1); x++) g[y * MAP_TILES + x] = 1;
  };
  // world borders: nothing leaves the map
  mark(0, 0, MAP_TILES - 1, 0); mark(0, MAP_TILES - 1, MAP_TILES - 1, MAP_TILES - 1);
  mark(0, 0, 0, MAP_TILES - 1); mark(MAP_TILES - 1, 0, MAP_TILES - 1, MAP_TILES - 1);
  // one tile of hard snowbank beyond the border tiles for visual edge
  for (const p of world.props) {
    if (p.gate) { if (!flags.gateOpen) mark(28, 13, 36, 13); continue; }
    if (p.solid === "none") continue;
    const tx0 = Math.floor(p.x / TILE), ty0 = Math.floor(p.y / TILE);
    const tx1 = Math.floor((p.x + p.w - 1) / TILE);
    const ty1 = Math.floor((p.y + p.h - 1) / TILE);
    if (p.solid === "footprint") {
      // only the object's bottom row of tiles is solid (trunks, posts, water)
      if (p.sprite === "water") mark(tx0, ty0, tx1, ty1);
      else mark(tx0, ty1, tx1, ty1);
    } else {
      // "bottom": the bottom ~40% band
      const bandY0 = ty0 + Math.floor((ty1 - ty0 + 1) * 0.55);
      mark(tx0, bandY0, tx1, ty1);
    }
  }
  return g;
}

export function solidAtGrid(g: Uint8Array, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return true;
  return g[ty * MAP_TILES + tx] === 1;
}

// ---------------- flags ----------------

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
}

export function freshFlags(): WorldFlags {
  return {
    hasKey: false, dogFound: false, dogReturned: false, gateOpen: false,
    killsPines: 0, killsRidge: 0, sparedHare: false, sparedHound: false, sparedKesh: false,
    architectSpared: false, met: {}, bought: {}, bossDone: false, keshKilled: false,
    genocideZone: false, tpDone: false, genDone: false, deaths: 0, saved: false,
  };
}

export interface WorldSaveData { x: number; y: number; flags: WorldFlags; }

export function zoneAt(world: WorldDef, px: number, py: number): ZoneDef | null {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  for (const z of world.zones) {
    const [x0, y0, x1, y1] = z.rect;
    if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1) return z;
  }
  return null;
}

export function totalKills(f: WorldFlags): number { return f.killsPines + f.killsRidge; }

/** Which finale this save is heading toward, by what you've done. */
export function routeOf(f: WorldFlags): "pacifist" | "neutral" | "genocide" {
  if (f.genDone) return "genocide";
  if (totalKills(f) >= 12) return "genocide";
  if (totalKills(f) === 0 && (f.sparedKesh || f.bossDone)) return "pacifist";
  return "neutral";
}

export function clampPos(v: number, span: number): number {
  return clamp(v, span, MAP_PX - span);
}
