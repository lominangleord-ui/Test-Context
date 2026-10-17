// Ashenveil — floor system v2. A floor is a folder: public/art/floors/<id>/
//   ground_{x}_{y}.png  (1920x1080 art px per chunk; floors are 2x2..3x3)  — or one ground.png
//   overlay.png         (optional, draws ABOVE the player; tree/arch/wall tops)
//   collision.png       (any size; 1 mask px ≈ 8 art px; white=walkable, black/blue=solid,
//                        red=hazard, green=exit — scaled proportionally to the ground)
//   objects.json        (spawn, npcs, signs, props+colliders, exits, rests, boss, zones)
// WORLD SCALE: 1 world unit = 2 art px. The design view is 960x540 world units.
// Everything here is pure math + data so the test suite can fuzz movement headless.
import { clamp } from "./core";
import { Art } from "./artset";

export const VIEW_UX = 960; // design view, world units
export const VIEW_UY = 540;
export const CHUNK_U = { w: 960, h: 540 }; // one 1920x1080 art chunk, in world units
export const ART_PER_UNIT = 2;            // 1 world unit = 2 art px
export const FOOT = { w: 20, h: 12 };     // player foot box, world units
export const CELL = 4;                    // mask cell = 8 art px = 4 world units

export const MASK = { WALK: 0, SOLID: 1, WATER: 2, HAZARD: 3, EXIT: 4 } as const;

export interface PropObj {
  x: number; y: number; w: number; h: number;
  sprite: string;
  solid?: "rect" | "ellipse";           // its own collider; absent = non-blocking art
  occlude?: boolean;                    // draw above the player
  unlockedBy?: string;                  // solid only while this flag is FALSY (e.g. gateOpen)
  interactId?: string; prompt?: string; // [Z] target
}
export interface NpcObj { id: string; x: number; y: number; sprite: string; facing: "up" | "down" | "left" | "right"; dialogue: string; hideAfter?: string }
export interface SignObj { x: number; y: number; text: string }
export interface ExitObj { x: number; y: number; w: number; h: number; to: string; label: string; requires?: string }
export interface RestObj { x: number; y: number; w: number; h: number }
export interface ZoneObj { id: string; x: number; y: number; w: number; h: number; enemies: string[] }
export interface BossObj { id: string; name: string; level: number; x: number; y: number; w: number; h: number }

export interface FloorSave {
  chunks: [number, number];             // ground chunk grid, 2..3 each axis
  spawn: [number, number];
  npcs: NpcObj[]; signs: SignObj[]; props: PropObj[];
  exits: ExitObj[]; rests: RestObj[]; zones: ZoneObj[];
  boss?: BossObj;
}

export class Mask {
  cw: number; ch: number; cell: number;
  cells: Uint8Array;
  constructor(cw: number, ch: number, cell = CELL) {
    this.cw = cw; this.ch = ch; this.cell = cell;
    this.cells = new Uint8Array(cw * ch);
  }
  at(wx: number, wy: number): number {
    const cx = Math.floor(wx / this.cell), cy = Math.floor(wy / this.cell);
    if (cx < 0 || cy < 0 || cx >= this.cw || cy >= this.ch) return MASK.SOLID;
    return this.cells[cy * this.cw + cx];
  }
  blockedCode(wx: number, wy: number): boolean {
    const c = this.at(wx, wy);
    return c === MASK.SOLID || c === MASK.WATER;
  }
  set(cx: number, cy: number, v: number) {
    if (cx < 0 || cy < 0 || cx >= this.cw || cy >= this.ch) return;
    this.cells[cy * this.cw + cx] = v;
  }
  /** classify one RGBA pixel of collision.png */
  static classify(r: number, g: number, b: number, a: number): number {
    if (a < 128) return MASK.WALK;
    if (b > 120 && b > r + 28 && b > g + 18) return MASK.WATER;   // blue = deep water (solid)
    if (r > 120 && r > g + 40 && r > b + 40) return MASK.HAZARD;   // red = hazard (walkable, hurts)
    if (g > 110 && g > r + 30 && g > b + 30) return MASK.EXIT;     // green = exit pad
    const luma = (r + g + b) / 3;
    return luma >= 128 ? MASK.WALK : MASK.SOLID;                   // white walks, black blocks
  }
}

export interface Floor {
  id: string; name: string;
  w: number; h: number;          // world units
  mask: Mask;
  objects: FloorSave;
  music: "town" | "battle" | "boss" | "final" | "marsh" | "cave";
  tint: "open" | "water" | "cave" | "hall";
  art: { ground: HTMLCanvasElement | HTMLImageElement | null; overlay: HTMLCanvasElement | HTMLImageElement | null; ready: boolean };
}

// ---------------- collision queries ----------------

function rectVsProps(floor: Floor, x0: number, y0: number, x1: number, y1: number, flags: Record<string, boolean>): boolean {
  for (const p of floor.objects.props) {
    if (!p.solid) continue;
    if (p.unlockedBy && flags[p.unlockedBy]) continue; // e.g. the ridge gate: an open door does not block
    if (p.solid === "rect") {
      if (x0 < p.x + p.w && x1 > p.x && y0 < p.y + p.h && y1 > p.y) return true;
    } else {
      // ellipse collider ≈ rect shrunk to its inscribed box (forgiving, predictable)
      const ix = p.x + p.w * 0.15, iw = p.w * 0.7;
      const iy = p.y + p.h * 0.15, ih = p.h * 0.7;
      if (x0 < ix + iw && x1 > ix && y0 < iy + ih && y1 > iy) return true;
    }
  }
  return false;
}

/** Is the foot box (centered on x, resting so its bottom is at y) blocked? */
export function posBlocked(floor: Floor, x: number, y: number, flags: Record<string, boolean> = {}): boolean {
  const m = floor.mask;
  const x0 = x - FOOT.w / 2, x1 = x + FOOT.w / 2, y0 = y - FOOT.h, y1 = y;
  const c0 = Math.floor(x0 / m.cell), c1 = Math.floor(x1 / m.cell);
  const r0 = Math.floor(y0 / m.cell), r1 = Math.floor(y1 / m.cell);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    if (cx < 0 || cy < 0 || cx >= m.cw || cy >= m.ch) return true;
    const v = m.cells[cy * m.cw + cx];
    if (v === MASK.SOLID || v === MASK.WATER) return true;
  }
  return rectVsProps(floor, x0, y0, x1, y1, flags);
}

export function atHazard(floor: Floor, x: number, y: number): boolean {
  return floor.mask.at(x, y - FOOT.h / 2) === MASK.HAZARD;
}
export function onExit(floor: Floor, x: number, y: number): ExitObj | null {
  for (const e of floor.objects.exits) {
    if (x > e.x && x < e.x + e.w && y > e.y && y < e.y + e.h) return e;
  }
  return null;
}
export function onRest(floor: Floor, x: number, y: number): RestObj | null {
  for (const r of floor.objects.rests) {
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return r;
  }
  return null;
}
export function inZone(floor: Floor, x: number, y: number): ZoneObj | null {
  for (const z of floor.objects.zones) {
    if (x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h) return z;
  }
  return null;
}
export function overBoss(floor: Floor, x: number, y: number): BossObj | null {
  const b = floor.objects.boss;
  if (!b) return null;
  if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  return null;
}

/**
 * The move: sample at the foot-box corners, X first then Y so you slide along
 * walls. dt is capped by the caller (50 ms). If the target is blocked, the
 * axis simply refuses — that IS the slide.
 */
export function stepMove(floor: Floor, x: number, y: number, dx: number, dy: number, flags: Record<string, boolean> = {}) {
  let nx = x, ny = y, bx = false, by = false;
  if (dx !== 0) {
    const t = x + dx;
    if (posBlocked(floor, t, y, flags)) bx = true; else nx = t;
  }
  if (dy !== 0) {
    const t = y + dy;
    if (posBlocked(floor, nx, t, flags)) by = true; else ny = t;
  }
  nx = clamp(nx, FOOT.w / 2, floor.w - FOOT.w / 2);
  ny = clamp(ny, FOOT.h, floor.h);
  return { x: nx, y: ny, blockedX: bx, blockedY: by };
}

// ---------------- placeholder floors (until real art arrives) ----------------

/** Deterministic hash for prop scatter. */
function h2(x: number, y: number, salt: number): number {
  return Math.abs(Math.floor((x * 7919 + y * 104729 + salt * 6151) % 1000)) / 1000;
}

export function placeholderMask(w: number, h: number, extra: { solid?: [number, number, number, number][]; hazard?: [number, number, number, number][] } = {}): Mask {
  const m = new Mask(Math.ceil(w / CELL), Math.ceil(h / CELL), CELL);
  const fill = (x: number, y: number, ww: number, hh: number, v: number) => {
    for (let cy = Math.floor(y / m.cell); cy <= Math.floor((y + hh) / m.cell); cy++)
      for (let cx = Math.floor(x / m.cell); cx <= Math.floor((x + ww) / m.cell); cx++) m.set(cx, cy, v);
  };
  const t = 28; // wall thickness, world units
  fill(0, 0, w, t, MASK.SOLID); fill(0, h - t, w, t, MASK.SOLID);
  fill(0, 0, t, h, MASK.SOLID); fill(w - t, 0, t, h, MASK.SOLID);
  for (const [x, y, ww, hh] of extra.solid ?? []) fill(x, y, ww, hh, MASK.SOLID);
  for (const [x, y, ww, hh] of extra.hazard ?? []) fill(x, y, ww, hh, MASK.HAZARD);
  // a few boxes scattered clear of the middle road — visible proof the mask works
  for (let i = 0; i < 7; i++) {
    const bx = 120 + Math.floor(h2(i, 3, 11) * (w - 380));
    const by = 120 + Math.floor(h2(i, 7, 13) * (h - 340));
    if (Math.abs(by - h / 2) < 90) continue;
    fill(bx, by, 90, 60, MASK.SOLID);
  }
  return m;
}

/** Flat color + grid + floor name. Drawn on a real canvas when a DOM exists. */
export function placeholderGround(floor: Floor): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = floor.w * ART_PER_UNIT; c.height = floor.h * ART_PER_UNIT;
  const g = c.getContext("2d")!;
  const pal: Record<string, [string, string]> = {
    verdant: ["#1d2b20", "#274029"], marsh: ["#17242c", "#1f3a44"], caverns: ["#241a16", "#33241c"],
    citadel: ["#201d29", "#2c2838"], ashenveil: ["#141a24", "#1d2430"], veil: ["#141a24", "#1d2430"],
  };
  const [bg, grid] = pal[floor.id] ?? ["#141a24", "#1d2430"];
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = grid; g.lineWidth = 1;
  for (let x = 0; x <= c.width; x += 64) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, c.height); g.stroke(); }
  for (let y = 0; y <= c.height; y += 64) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(c.width, y + 0.5); g.stroke(); }
  g.fillStyle = "rgba(220,232,255,0.14)";
  g.font = `900 ${Math.round(c.height / 9)}px "Share Tech Mono", monospace`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(floor.name, c.width / 2, c.height / 2);
  g.font = `${Math.round(c.height / 26)}px "Share Tech Mono", monospace`;
  g.fillStyle = "rgba(220,232,255,0.10)";
  g.fillText("placeholder ground — drop public/art/floors/" + floor.id + "/ art to replace it", c.width / 2, c.height / 2 + c.height / 10);
  (c as never as { __ph: boolean }).__ph = true;
  return c;
}

// ---------------- authored defaults per floor (kept from the v1 maps) ----------------

export const FLOOR_META: Record<string, { name: string; music: Floor["music"]; tint: Floor["tint"] }> = {
  verdant: { name: "VERDANT RUINS", music: "town", tint: "open" },
  marsh: { name: "SUNKEN MARSH", music: "marsh", tint: "water" },
  caverns: { name: "ASHEN CAVERNS", music: "cave", tint: "cave" },
  citadel: { name: "MONARCH'S CITADEL", music: "marsh", tint: "hall" },
  ashenveil: { name: "ASHENVEIL", music: "town", tint: "open" },
};
export const FLOOR_IDS = Object.keys(FLOOR_META);
// legacy maps were 1024px; the new canvas is 1920x1080 units — old tiles map 30×/16.875×
const SX = 30, SY = 16.875, SS = 1.875;
const T = (tiles: number) => Math.round(tiles * SX);      // x in old tiles -> world units
const TY = (tiles: number) => Math.round(tiles * SY);      // y
const SZ = (px: number) => Math.round(px * SS);            // size in old px -> width units
const SZY = (px: number) => Math.round(px * SS * 0.5417);  // size y (1080/1990 vertical squash)

function defaults(id: string): FloorSave {
  const o: FloorSave = {
    chunks: [2, 2], spawn: [T(31.5), TY(57)], npcs: [], signs: [], props: [], exits: [], rests: [], zones: [],
  };
  const prop = (tx: number, ty: number, wpx: number, hpx: number, sprite: string, extra: Partial<PropObj> = {}): PropObj =>
    ({ x: T(tx), y: TY(ty), w: SZ(wpx), h: SZY(hpx), sprite, ...extra });
  if (id === "verdant") {
    o.spawn = [T(31.5), TY(56)];
    o.props.push(
      prop(23, 36, 16, 22, "pillar", { solid: "rect", occlude: true }), prop(27, 34, 16, 22, "pillar", { solid: "rect", occlude: true }),
      prop(35, 34, 16, 22, "pillar", { solid: "rect", occlude: true }), prop(37, 38, 16, 22, "pillar", { solid: "rect", occlude: true }),
      prop(23, 45, 16, 22, "pillar", { solid: "rect", occlude: true }), prop(36, 46, 16, 22, "pillar", { solid: "rect", occlude: true }),
      prop(28, 39, 48, 32, "shrine", { occlude: true, solid: "rect", interactId: "plaza.shrine", prompt: "READ" }),
      prop(30, 3, 64, 24, "arch", { occlude: true }),
    );
    for (let y = 14; y <= 40; y++) for (let x = 5; x <= 26; x++)
      if (h2(x, y, 1) < 0.12) o.props.push(prop(x, y - 0.75, 14, 28, "gpine", { solid: "rect", occlude: true }));
    for (let y = 14; y <= 24; y++) for (let x = 37; x <= 57; x++) {
      if (x >= 48 && x <= 55 && y >= 20) continue;
      if (h2(x, y, 2) < 0.10) o.props.push(prop(x, y - 0.75, 14, 28, "gpine", { solid: "rect", occlude: true }));
    }
    o.npcs.push(
      { id: "seo", x: T(36), y: TY(43), sprite: "seo", facing: "left", dialogue: "seo.verdant" },
      { id: "hana", x: T(25), y: TY(46), sprite: "hana", facing: "down", dialogue: "hana.verdant" },
      { id: "jino", x: T(27), y: TY(47), sprite: "jino", facing: "down", dialogue: "jino.verdant" },
      { id: "roan", x: T(39.5), y: TY(40), sprite: "roan", facing: "down", dialogue: "roan.verdant", hideAfter: "genocideVerdant" },
    );
    o.signs.push(
      { x: T(29), y: TY(49), text: "sign.v.gate" }, { x: T(50), y: TY(26), text: "sign.v.pond" },
      { x: T(31), y: TY(5), text: "sign.v.shrine" }, { x: T(20), y: TY(14), text: "sign.v.road" },
      { x: T(26), y: TY(44), text: "sign.v.camp" },
    );
    o.zones.push(
      { id: "thicket", x: T(5), y: TY(14), w: T(22), h: TY(26), enemies: ["crawler", "rhound", "stalker", "crawler", "rhound"] },
      { id: "garden", x: T(37), y: TY(14), w: T(20), h: TY(10), enemies: ["stalker", "rhound", "crawler", "stalker"] },
    );
    o.rests.push({ x: T(24.5), y: TY(43), w: SZ(56), h: SZY(40) });
    o.boss = { id: "hobgoblin", name: "BLOOD-RED HOBGOBLIN", level: 5, x: T(29.5), y: TY(5), w: SZ(72), h: SZY(30) };
    o.exits.push({ x: T(29.5), y: TY(1), w: SZ(90), h: SZY(26), to: "marsh", label: "SUNKEN MARSH" });
  } else if (id === "marsh") {
    o.spawn = [T(37), TY(5)];
    o.props.push(
      prop(38, 22, 32, 26, "hut", { solid: "rect", occlude: true }), prop(43, 22, 32, 26, "hut", { solid: "rect", occlude: true }),
      prop(48, 27, 32, 26, "hut", { solid: "rect", occlude: true }),
      prop(38, 29, 32, 26, "hut", { solid: "rect", occlude: true, interactId: "shop.sila", prompt: "TRADE" }),
      prop(9, 26, 24, 16, "boat"), prop(13, 49, 24, 16, "boat"),
    );
    o.npcs.push(
      { id: "sila", x: T(40), y: TY(33), sprite: "sila", facing: "down", dialogue: "sila.marsh" },
      { id: "seo", x: T(37), y: TY(38), sprite: "seo", facing: "down", dialogue: "seo.marsh" },
      { id: "reed", x: T(15), y: TY(48), sprite: "reedwatcher", facing: "down", dialogue: "reedwatcher.marsh", hideAfter: "genocideMarsh" },
    );
    o.signs.push(
      { x: T(35), y: TY(6), text: "sign.m.arrive" }, { x: T(46), y: TY(31), text: "sign.m.village" },
      { x: T(30), y: TY(37), text: "sign.m.posters" }, { x: T(50), y: TY(40), text: "sign.m.stairs" },
    );
    o.zones.push(
      { id: "reedflats", x: T(8), y: TY(14), w: T(18), h: TY(8), enemies: ["lurker", "reed", "dsentry", "lurker"] },
      { id: "deepbog", x: T(8), y: TY(44), w: T(16), h: TY(12), enemies: ["dsentry", "lurker", "reed", "dsentry"] },
    );
    o.rests.push({ x: T(41), y: TY(31), w: SZ(56), h: SZY(40) });
    o.boss = { id: "sentinel", name: "STONE SENTINEL", level: 12, x: T(27.5), y: TY(16.5), w: SZ(72), h: SZY(30) };
    o.exits.push({ x: T(35), y: TY(59.5), w: SZ(90), h: SZY(26), to: "caverns", label: "ASHEN CAVERNS" });
  } else if (id === "caverns") {
    o.spawn = [T(7), TY(5)];
    o.props.push(
      prop(9, 25, 24, 16, "shrine", { occlude: true, solid: "rect" }),
      prop(52, 52, 48, 30, "arch", { occlude: true }),
      prop(47, 31, 12, 19, "pillar", { solid: "rect", occlude: true }),
    );
    for (const [x, y] of [[10, 24], [30, 24], [10, 40], [30, 40], [40, 26], [42, 48]] as const) o.props.push(prop(x, y, 12, 16, "crystal", { solid: "rect" }));
    for (const [x, y] of [[13, 24], [17, 22], [31, 30], [24, 38], [48, 44]] as const) o.props.push(prop(x, y, 12, 12, "dead", { solid: "rect", occlude: true }));
    o.npcs.push(
      { id: "kang", x: T(30), y: TY(17), sprite: "kang", facing: "down", dialogue: "kang.caverns" },
      { id: "verity", x: T(11), y: TY(27), sprite: "verity", facing: "down", dialogue: "verity.caverns" },
      { id: "ember", x: T(24), y: TY(15), sprite: "ember", facing: "down", dialogue: "ember.caverns", hideAfter: "genocideCaverns" },
      { id: "seo", x: T(5), y: TY(7), sprite: "seo", facing: "down", dialogue: "seo.caverns" },
    );
    o.signs.push(
      { x: T(25), y: TY(9), text: "sign.c.rails" }, { x: T(12), y: TY(26), text: "sign.c.lava" },
      { x: T(40), y: TY(49), text: "sign.c.tusk" }, { x: T(13), y: TY(23), text: "sign.c.cult" },
    );
    o.zones.push(
      { id: "galleries", x: T(16), y: TY(13), w: T(22), h: TY(9), enemies: ["bat", "golem", "revenant", "bat"] },
      { id: "shafts", x: T(36), y: TY(24), w: T(18), h: TY(6), enemies: ["golem", "revenant", "bat", "golem"] },
    );
    o.rests.push({ x: T(4), y: TY(4), w: SZ(56), h: SZY(40) });
    o.props.push({ x: T(20), y: TY(10.5), w: SZ(24), h: SZY(16), sprite: "bones", interactId: "den", prompt: "ENTER THE DEN" });
    o.boss = { id: "irontusk", name: "IRON TUSK", level: 20, x: T(43.5), y: TY(51.5), w: SZ(72), h: SZY(30) };
    o.exits.push({ x: T(52), y: TY(53), w: SZ(90), h: SZY(26), to: "citadel", label: "MONARCH'S CITADEL" });
  } else if (id === "citadel") {
    o.spawn = [T(31.5), TY(57)];
    for (const row of [10, 22, 44, 54]) for (const col of [8, 20, 42, 54])
      o.props.push(prop(col, row, 14, 16, "column", { solid: "rect", occlude: true }));
    for (const [x, y] of [[14, 16], [14, 48], [48, 16], [48, 48], [31, 14]] as const) o.props.push(prop(x, y, 11, 13, "brazier", { solid: "rect" }));
    o.props.push(prop(29, 6, 48, 32, "throne", { occlude: true, solid: "rect" }), prop(3, 30, 32, 24, "arch", { occlude: true }));
    o.npcs.push(
      { id: "herald", x: T(31), y: TY(20), sprite: "herald", facing: "down", dialogue: "herald.citadel" },
      { id: "ivy", x: T(24), y: TY(27), sprite: "ivy", facing: "down", dialogue: "ivy.citadel" },
      { id: "seo", x: T(38), y: TY(27), sprite: "seo", facing: "down", dialogue: "seo.citadel" },
    );
    o.signs.push(
      { x: T(31), y: TY(57), text: "sign.t.enter" }, { x: T(56), y: TY(36), text: "sign.t.crack" },
      { x: T(27), y: TY(7), text: "sign.t.throne" }, { x: T(4), y: TY(32), text: "sign.t.door" },
    );
    o.zones.push({ id: "hall", x: T(6), y: TY(34), w: T(52), h: TY(24), enemies: ["gsent", "hknife", "acolyte", "gsent", "acolyte"] });
    o.rests.push({ x: T(30), y: TY(46), w: SZ(56), h: SZY(40) });
    o.boss = { id: "warden", name: "THE GATE WARDEN", level: 38, x: T(29.5), y: TY(8), w: SZ(72), h: SZY(30) };
    o.exits.push({ x: T(2.5), y: TY(30.5), w: SZ(64), h: SZY(30), to: "ashenveil", label: "THE UNREGISTERED DOOR", requires: "unregistered" });
  } else if (id === "ashenveil") {
    o.spawn = [T(31.5), TY(33.5)];
    o.props.push(
      prop(22, 17, 128, 48, "water"), prop(34, 17, 144, 48, "water"),
      prop(24, 5, 32, 20, "house", { solid: "rect", occlude: true }),
      prop(11, 25, 28, 18, "inn", { solid: "rect", occlude: true }),
      prop(19, 26, 32, 20, "house", { solid: "rect", occlude: true }),
      prop(24, 33, 24, 11, "stall", { solid: "rect" }), prop(24, 36, 24, 11, "stall2", { solid: "rect" }),
      prop(31, 28, 12, 19, "obelisk", { solid: "rect", occlude: true, interactId: "save", prompt: "SAVE" }),
      prop(30, 12, 48, 30, "gate", { occlude: true, solid: "rect", unlockedBy: "gateOpen", interactId: "gate", prompt: "OPEN" }),
      prop(58, 26, 32, 26, "portal", { solid: "rect", interactId: "bossGate", prompt: "ENTER" }),
    );
    for (let y = 4; y <= 12; y++) for (let x = 22; x <= 44; x++) {
      if (x >= 29 && x <= 34 && y >= 9) continue;
      if (h2(x, y, 3) < 0.09) o.props.push(prop(x, y, 12, 10, "dead", { solid: "rect", occlude: true }));
    }
    for (let y = 46; y <= 62; y++) for (let x = 10; x <= 52; x++) {
      if (x >= 28 && x <= 35) continue;
      if (h2(x, y, 1) < 0.10) o.props.push({ x: T(x) - 4, y: TY(y) - SZY(12), w: SZ(14), h: SZY(28), sprite: "pine", solid: "rect", occlude: true });
    }
    o.npcs.push(
      { id: "miso", x: T(26.9), y: TY(34.5), sprite: "shopgirl", facing: "down", dialogue: "shop.miso" },
      { id: "baek", x: T(13.5), y: TY(31.2), sprite: "innkeep", facing: "down", dialogue: "inn.baek", hideAfter: "genocideZone" },
      { id: "kid", x: T(36.5), y: TY(27.5), sprite: "kid", facing: "down", dialogue: "kid.lost", hideAfter: "dogReturned" },
      { id: "prof", x: T(26.5), y: TY(23.5), sprite: "prof", facing: "down", dialogue: "prof.lessons", hideAfter: "genocideZone" },
      { id: "skater", x: T(45.5), y: TY(45.5), sprite: "skater", facing: "down", dialogue: "skater.ryu", hideAfter: "genocideZone" },
      { id: "hermit", x: T(25.5), y: TY(8.5), sprite: "hermit", facing: "down", dialogue: "hermit.shadow", hideAfter: "keshKilled" },
      { id: "dog", x: T(29), y: TY(53.5), sprite: "houndOw", facing: "down", dialogue: "dog.rock", hideAfter: "dogFound" },
    );
    o.signs.push(
      { x: T(31.2), y: TY(60.5), text: "sign.entry" }, { x: T(28.5), y: TY(30.5), text: "sign.plaza" },
      { x: T(37.5), y: TY(33.5), text: "sign.crater" }, { x: T(34.5), y: TY(15.5), text: "sign.gate" },
      { x: T(24.5), y: TY(22.5), text: "sign.river" }, { x: T(38.5), y: TY(24.5), text: "sign.bench" },
      { x: T(46.5), y: TY(44.5), text: "sign.pond" }, { x: T(23.5), y: TY(10.5), text: "sign.ridge" },
    );
    o.zones.push(
      { id: "pines", x: T(8), y: TY(46), w: T(48), h: TY(17), enemies: ["hare", "hare", "hound", "hare", "imp", "hound"] },
      { id: "ridge", x: T(20), y: TY(3), w: T(27), h: TY(10), enemies: ["imp", "wight", "hare", "wight", "hound", "imp"] },
    );
    o.rests.push({ x: T(28), y: TY(31.5), w: SZ(56), h: SZY(40) });
    o.exits.push({ x: T(1), y: TY(30), w: SZ(48), h: SZY(30), to: "citadel", label: "RETURN TO THE CITADEL" });
  }
  return o;
}

/** Solid/hazard rectangles baked into each floor's placeholder mask. */
function maskExtras(id: string): { solid?: [number, number, number, number][]; hazard?: [number, number, number, number][] } {
  const e: { solid?: [number, number, number, number][]; hazard?: [number, number, number, number][] } = { solid: [], hazard: [] };
  if (id === "verdant") e.solid!.push([T(48), TY(27), SZ(8 * 16), SZY(4 * 16)]); // the pond blocks
  if (id === "marsh") { e.solid!.push([T(10), TY(20), SZ(10 * 16), SZY(9 * 16)]); e.solid!.push([T(46), TY(44), SZ(12 * 16), SZY(8 * 16)]); }
  if (id === "caverns") {
    e.hazard!.push([T(15), TY(25), SZ(18 * 16), SZY(17 * 16)]);   // the lava ring, as painted
    e.hazard!.push([T(40), TY(46), SZ(10 * 16), SZY(6 * 16)]);
    e.solid!.push([T(20), TY(15), SZ(3 * 16), SZY(3 * 16)]);
  }
  if (id === "citadel") { e.solid!.push([T(0), TY(0), SZ(4 * 16), SZY(4 * 16)]); e.solid!.push([T(60), TY(0), SZ(4 * 16), SZY(4 * 16)]); }
  return e;
}

/** Synchronous floor: authored objects + placeholder mask, both deterministic.
 *  Real art (chunks/overlay/collision/objects.json) layers on async via applyArt. */
export function makeFloor(id: string): Floor {
  const meta = FLOOR_META[id] ?? FLOOR_META.ashenveil;
  const objects = defaults(id);
  const w = objects.chunks[0] * CHUNK_U.w, h = objects.chunks[1] * CHUNK_U.h;
  const mask = placeholderMask(w, h, maskExtras(id));
  carveClearings(mask, objects);
  return { id, name: meta.name, w, h, mask, objects, music: meta.music, tint: meta.tint, art: { ground: null, overlay: null, ready: false } };
}

/** No spawn, exit, rest, NPC or interact point may sit inside a wall — the
 *  placeholder mask carves generous clearings so every authored point walks. */
export function carveClearings(mask: Mask, objects: FloorSave, radius = 110) {
  const pts: [number, number][] = [objects.spawn as [number, number]];
  for (const n of objects.npcs) pts.push([n.x, n.y]);
  for (const s of objects.signs) pts.push([s.x, s.y]);
  for (const e of objects.exits) pts.push([e.x + e.w / 2, e.y + e.h / 2]);
  for (const r of objects.rests) pts.push([r.x + r.w / 2, r.y + r.h / 2]);
  if (objects.boss) pts.push([objects.boss.x + objects.boss.w / 2, objects.boss.y + objects.boss.h / 2]);
  for (const p of objects.props) if (p.interactId) pts.push([p.x + p.w / 2, p.y + p.h / 2]);
  const rc = Math.ceil(radius / mask.cell);
  for (const [x, y] of pts) {
    const cx = Math.floor(x / mask.cell), cy = Math.floor(y / mask.cell);
    for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
      if (dx * dx + dy * dy > rc * rc) continue;
      const i = (cy + dy) * mask.cw + (cx + dx);
      if (cx + dx < 0 || cy + dy < 0 || cx + dx >= mask.cw || cy + dy >= mask.ch) continue;
      if (mask.cells[i] === MASK.SOLID || mask.cells[i] === MASK.WATER) mask.cells[i] = MASK.WALK;
      const j = (cy + dy) * mask.cw + (cx + dx);
      if (mask.cells[j] === MASK.HAZARD && Math.hypot(dx, dy) < rc * 0.55) mask.cells[j] = MASK.WALK;
    }
  }
}

// ---------------- real art loading (graceful: any file may be absent) ----------------

function img(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    if (typeof Image === "undefined") return res(null);
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

export async function loadFloorArt(floor: Floor): Promise<void> {
  // The manifest may retarget any floor file with no code change (art/floors/… is only the default).
  const dir = Art.urlFor(`floor:${floor.id}:dir`);
  const base = dir ? (dir.endsWith("/") ? dir : dir + "/") : `art/floors/${floor.id}/`;
  const file = (part: string, fallback: string) => Art.urlFor(`floor:${floor.id}:${part}`) ?? `${base}${fallback}`;
  const objs = typeof fetch === "function"
    ? await fetch(file("objects", "objects.json")).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    : null;
  if (objs && typeof objs === "object") { floor.objects = normalizeSave(objs as Partial<FloorSave>, floor.objects); Art.markLoaded(`floor:${floor.id}:objects`); }
  floor.w = floor.objects.chunks[0] * CHUNK_U.w;
  floor.h = floor.objects.chunks[1] * CHUNK_U.h;
  const groundSingle = await img(file("ground", "ground.png"));
  let pieces: HTMLImageElement[] = [];
  if (!groundSingle) {
    const n = floor.objects.chunks[0] * floor.objects.chunks[1];
    const arr = await Promise.all(Array.from({ length: n }, (_, i) =>
      img(`${base}ground_${i % floor.objects.chunks[0]}_${Math.floor(i / floor.objects.chunks[0])}.png`)));
    pieces = arr.filter((x): x is HTMLImageElement => !!x);
    if (pieces.length < n) pieces = []; // a half-painted floor is worse than the placeholder
  }
  if ((groundSingle || pieces.length) && typeof document !== "undefined") {
    const g = document.createElement("canvas");
    g.width = floor.w * ART_PER_UNIT; g.height = floor.h * ART_PER_UNIT;
    const gg = g.getContext("2d")!;
    if (groundSingle) gg.drawImage(groundSingle as never, 0, 0, g.width, g.height);
    else for (let i = 0; i < pieces.length; i++) {
      const cx = (i % floor.objects.chunks[0]) * 1920, cy = Math.floor(i / floor.objects.chunks[0]) * 1080;
      gg.drawImage(pieces[i] as never, cx, cy, 1920, 1080); // 1:1 art px — never upscaled
    }
    floor.art.ground = g;
    Art.markLoaded(`floor:${floor.id}:ground`);
  }
  const ov = await img(file("overlay", "overlay.png"));
  if (ov && typeof document !== "undefined") {
    const oc = document.createElement("canvas");
    oc.width = floor.w * ART_PER_UNIT; oc.height = floor.h * ART_PER_UNIT;
    oc.getContext("2d")!.drawImage(ov as never, 0, 0, oc.width, oc.height);
    floor.art.overlay = oc;
    Art.markLoaded(`floor:${floor.id}:overlay`);
  }
  const cm = await img(file("collision", "collision.png"));
  if (cm && typeof document !== "undefined" && cm.width > 0) {
    const c = document.createElement("canvas");
    c.width = cm.width; c.height = cm.height;
    const cg = c.getContext("2d")!;
    cg.drawImage(cm as never, 0, 0);
    const d = cg.getImageData(0, 0, c.width, c.height).data;
    const cell = floor.w / c.width; // any size allowed: scale proportionally to the ground
    const m = new Mask(c.width, c.height, cell);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      m.cells[i / 4] = Mask.classify(d[i], d[i + 1], d[i + 2], d[i + 3]);
    }
    floor.mask = m; // if the player is now inside a wall, the view's safety net snaps them out
    Art.markLoaded(`floor:${floor.id}:collision`);
  }
  floor.art.ready = true;
}

/** objects.json is allowed to be partial; missing keys keep the authored defaults. */
export function normalizeSave(j: Partial<FloorSave>, fallback: FloorSave): FloorSave {
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    chunks: (() => { const cc = j.chunks as unknown as number[] | undefined; return Array.isArray(cc) && cc.length === 2 ? [clamp(num(cc[0], 2), 2, 3) as 2 | 3, clamp(num(cc[1], 2), 2, 3) as 2 | 3] : fallback.chunks; })(),
    spawn: (() => { const sp = j.spawn as unknown as number[] | undefined; return Array.isArray(sp) ? [num(sp[0], fallback.spawn[0]), num(sp[1], fallback.spawn[1])] : fallback.spawn; })(),
    npcs: Array.isArray(j.npcs) ? (j.npcs as NpcObj[]) : fallback.npcs,
    signs: Array.isArray(j.signs) ? (j.signs as SignObj[]) : fallback.signs,
    props: Array.isArray(j.props) ? (j.props as PropObj[]) : fallback.props,
    exits: Array.isArray(j.exits) ? (j.exits as ExitObj[]) : fallback.exits,
    rests: Array.isArray(j.rests) ? (j.rests as RestObj[]) : fallback.rests,
    zones: Array.isArray(j.zones) ? (j.zones as ZoneObj[]) : fallback.zones,
    boss: j.boss && typeof j.boss === "object" ? (j.boss as BossObj) : fallback.boss,
  };
}

/** Serialize for the editor's export button. */
export function saveToJson(f: FloorSave): string { return JSON.stringify(f, null, 1); }

/** Export the live mask as a collision.png-equivalent (RGBA canvas). */
export function maskToCanvas(floor: Floor): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = floor.mask.cw; c.height = floor.mask.ch;
  const g = c.getContext("2d")!;
  const imgData = g.createImageData(c.width, c.height);
  const COL: Record<number, [number, number, number]> = {
    0: [255, 255, 255], 1: [0, 0, 0], 2: [40, 90, 220], 3: [225, 45, 45], 4: [45, 200, 90],
  };
  for (let i = 0; i < floor.mask.cells.length; i++) {
    const [r, gg, b] = COL[floor.mask.cells[i]] ?? [255, 0, 255];
    imgData.data[i * 4] = r; imgData.data[i * 4 + 1] = gg; imgData.data[i * 4 + 2] = b; imgData.data[i * 4 + 3] = 255;
  }
  g.putImageData(imgData, 0, 0);
  return c;
}
