// Character appearance V3 — the player's paper doll + pronoun tokens.
// Today: the store carries a free-text name (awaken) and an unrelated React-side
// avatar path; the game view paints the hunter from fixed grids; nothing about how
// you LOOK is persisted. V3: an `appearance` object lives in the saved game state
// (with migration: old saves get the default look), and every visual of the player
// — overworld sprite, talk portrait, battle figure, creator preview — composites
// from ONE cached set of layer canvases built from this data alone.
// The player is the ONLY actor that uses this system (locked by tests).
import { Art, PLAYER_COLOR, playerPartKey, fakeCanvas } from "./artset";

export type Pronouns = "he" | "she" | "they";

export interface Appearance {
  name: string;
  pronouns: Pronouns;
  build: number;        // 0 slim · 1 middle · 2 broad
  skin: number;         // 0..7 swatch index
  face: number;         // 0..3
  hair: number;         // 0..7
  hairColor: string;
  streak: boolean;
  streakColor: string;
  jacket: number;       // 0 hoodie · 1 Association windbreaker · 2 patched parka
  jacketColor: string;
  pantsColor: string;
  strapColor: string;
  accessory: number;    // -1 none, else variant index
  accColor: string;
}

export const SKIN_SWATCHES = ["#f7d4b0", "#efc39a", "#dda178", "#c3855c", "#a06a45", "#7d4e33", "#5c3823", "#3e2618"];
export const COLOR_SWATCHES = ["#46617f", "#7a2431", "#3fa0a0", "#8a5a5a", "#c97f3a", "#4f7a46", "#51406b", "#c9a06a", "#1d1a20", "#dfe8f4", "#ffd88a", "#9aa7b5"];
export const HAIR_SWATCHES = ["#2b2320", "#0e0e14", "#4a3020", "#8a6a3f", "#c8b46a", "#cfcfcf", "#5c3a52", "#c2571f"];
export const ACCESSORY_NAMES = ["none", "earring", "beanie", "scarf", "glasses", "satchel", "hairpin", "wrap-bandage"];
export const JACKET_NAMES = ["HOODIE", "ASSOCIATION WINDBREAKER", "PATCHED PARKA"];
export const BUILD_NAMES = ["SLIM", "MIDDLE", "BROAD"];
export const FACE_NAMES = ["OPEN", "TIRED", "SHARP", "SOFT"];

export function defaultAppearance(name = ""): Appearance {
  return {
    name, pronouns: "they", build: 1, skin: 2, face: 0, hair: 2,
    hairColor: HAIR_SWATCHES[0], streak: false, streakColor: "#7fe7ff",
    jacket: 0, jacketColor: PLAYER_COLOR, pantsColor: "#2a3342", strapColor: "#5e4632",
    accessory: -1, accColor: "#ffd88a",
  };
}

const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
const int = (v: unknown, lo: number, hi: number, d: number) =>
  (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : d);

/** Migration entry point: anything old, broken or missing becomes a valid look. */
export function normalizeAppearance(saved: unknown): Appearance {
  const d = defaultAppearance();
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return d;
  const s = saved as Record<string, unknown>;
  return {
    name: typeof s.name === "string" ? s.name.slice(0, 14) : d.name,
    pronouns: s.pronouns === "he" || s.pronouns === "she" || s.pronouns === "they" ? s.pronouns : d.pronouns,
    build: int(s.build, 0, 2, 1),
    skin: int(s.skin, 0, 7, 2),
    face: int(s.face, 0, 3, 0),
    hair: int(s.hair, 0, 7, 2),
    hairColor: hex(s.hairColor, d.hairColor),
    streak: s.streak === true,
    streakColor: hex(s.streakColor, d.streakColor),
    jacket: int(s.jacket, 0, 2, 0),
    jacketColor: hex(s.jacketColor, d.jacketColor),
    pantsColor: hex(s.pantsColor, d.pantsColor),
    strapColor: hex(s.strapColor, d.strapColor),
    accessory: int(s.accessory, -1, ACCESSORY_NAMES.length - 2, -1),
    accColor: hex(s.accColor, d.accColor),
  };
}

// ---------------- pronoun tokens ----------------
// Dialogue text may reference the player ONLY through tokens; every line must read
// correctly for he / she / they (locked by tests). {PLAYER} is the name.

export function pronounTable(p: Pronouns): Record<string, string> {
  return p === "he"
    ? { "{PRON_SUBJ}": "he", "{PRON_OBJ}": "him", "{PRON_POSS}": "his", "{PRON_REF}": "himself", "{PRON_BE}": "is" }
    : p === "she"
      ? { "{PRON_SUBJ}": "she", "{PRON_OBJ}": "her", "{PRON_POSS}": "her", "{PRON_REF}": "herself", "{PRON_BE}": "is" }
      : { "{PRON_SUBJ}": "they", "{PRON_OBJ}": "them", "{PRON_POSS}": "their", "{PRON_REF}": "themselves", "{PRON_BE}": "are" };
}

export function subTokens(text: string, ap: { name?: string; pronouns?: Pronouns } | null): string {
  if (!text) return text;
  if (!text.includes("{")) return text;
  const p = pronounTable(ap?.pronouns ?? "they");
  return text
    .replace(/\{PLAYER\}/g, (ap?.name || "HUNTER"))
    .replace(/\{(PRON_[A-Z]+)\}/g, (m) => p[m] ?? m);
}

export const hasUnresolvedToken = (text: string) => /\{[A-Z_]+\}/.test(text);

// ---------------- paper-doll composite ----------------
// Slots, painted bottom-up. Each slot resolves its art via the manifest
// (playerpart:<slot>:<variant>:<facing>); missing files draw a clean procedural
// part so the creator and the game still work at ZERO art. Real files are tinted
// in code by the chosen colour (source-atop wash) — the same tint pass applies to
// authored PNGs, because that is how a 3-colour jacket becomes any colour.

export const DOLL_SLOTS = ["body", "trousers", "jacket", "strap", "face", "hair", "accessory"] as const;
export type DollSlot = (typeof DOLL_SLOTS)[number];
const PW = 64, PH = 96; // composite canvas in world units worth of px (drawn 1:1 over a 128-tall player)

export interface DollSource { slot: DollSlot; artKey: string }
/** The full source table for one look — tests assert every key belongs to "player". */
export function dollSources(ap: Appearance): DollSource[] {
  const variantFor = (slot: DollSlot): number =>
    slot === "body" ? ap.build
      : slot === "hair" ? ap.hair
        : slot === "face" ? ap.face
          : slot === "jacket" ? ap.jacket
            : slot === "accessory" ? ap.accessory
              : 0;
  return DOLL_SLOTS.map((slot) => {
    const v = variantFor(slot);
    return { slot, artKey: v < 0 ? "" : playerPartKey(slot, v, "front") };
  });
}

const cache = new Map<string, Record<string, HTMLCanvasElement>>();
export function compositeSignature(ap: Appearance) {
  return [ap.build, ap.skin, ap.face, ap.hair, ap.hairColor, ap.streak ? ap.streakColor : "-", ap.jacket,
    ap.jacketColor, ap.pantsColor, ap.strapColor, ap.accessory, ap.accColor].join("|");
}
export function invalidateDollCache() { cache.clear(); Art.invalidatePlaceholders(); }

export function dollFor(ap: Appearance, facing: "front" | "back" | "side"): HTMLCanvasElement {
  const sig = compositeSignature(ap);
  let per = cache.get(sig);
  if (!per) { per = {}; cache.set(sig, per); }
  const hit = per[facing];
  if (hit) return hit;
  const c = hasDom() ? document.createElement("canvas") : fakeCanvas(PW, PH);
  if (hasDom()) { c.width = PW; c.height = PH; }
  const g = c.getContext("2d")!;
  for (const slot of DOLL_SLOTS) {
    const layer = slotLayer(ap, slot, facing);
    if (layer) g.drawImage(layer, 0, 0, PW, PH);
  }
  per[facing] = c;
  return c;
}

function slotLayer(ap: Appearance, slot: DollSlot, facing: DollFacing): HTMLCanvasElement | null {
  const variant = slot === "accessory" && ap.accessory < 0 ? -1 : slotVariant(ap, slot);
  if (variant < 0) return null;
  const key = playerPartKey(slot, variant, facing);
  const real = Art.isReal(key) ? Art.art(key, `${slot} ${variant}`, "playerpart") : null;
  const tint = slotTint(ap, slot);
  const base = real ?? proceduralPart(ap, slot, facing);
  if (!tint) return base;
  // tint wash: colour over the layer, clipped to its pixels (source-atop)
  const c = hasDom() ? document.createElement("canvas") : fakeCanvas(1, 1);
  if (hasDom()) { c.width = base.width; c.height = base.height; const g = c.getContext("2d")!; g.drawImage(base, 0, 0); g.globalCompositeOperation = "source-atop"; g.globalAlpha = 0.42; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; return c; }
  return base;
}
type DollFacing = "front" | "back" | "side";

function slotVariant(ap: Appearance, slot: DollSlot): number {
  switch (slot) {
    case "body": return ap.build;
    case "trousers": return 0;
    case "jacket": return ap.jacket;
    case "strap": return 0;
    case "face": return ap.face;
    case "hair": return ap.hair;
    case "accessory": return ap.accessory;
  }
}
function slotTint(ap: Appearance, slot: DollSlot): string | null {
  switch (slot) {
    case "body": return null;               // body art is painted by skin at authoring; procedural uses skin directly
    case "trousers": return ap.pantsColor;
    case "jacket": return ap.jacketColor;
    case "strap": return ap.strapColor;
    case "face": return null;
    case "hair": return ap.hairColor;
    case "accessory": return ap.accColor;
  }
}

// ---------- procedural parts (the zero-art doll) ----------
// Tiny pixel ops on a 64×96 grid, feet at the bottom centre — the same anchor
// rule the real art follows. Clean shapes, no noise: this doubles as the
// creator's "draw your own around this" wireframe.
function px(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  if (typeof g.fillRect !== "function") return;
  g.fillStyle = color; g.fillRect(x, y, w, h);
}
function proceduralPart(ap: Appearance, slot: DollSlot, facing: DollFacing): HTMLCanvasElement {
  const c = hasDom() ? document.createElement("canvas") : fakeCanvas(1, 1);
  if (!hasDom()) return c;
  c.width = PW; c.height = PH;
  const g = c.getContext("2d")!;
  const skin = SKIN_SWATCHES[ap.skin];
  const shade = "#00000030";
  const wide = 8 + ap.build * 4;          // shoulders widen with build
  const cx = PW / 2, flip = facing === "side" ? 1 : 0;
  const off = (dx: number) => facing === "back" ? -dx : dx; // side faces RIGHT
  switch (slot) {
    case "body": { // torso + legs + arms in skin/undersuit base
      px(g, cx - wide, 40, wide * 2, 26, "#2a3342");
      px(g, cx - 6, 66, 5, 24, "#232b3a"); px(g, cx + 1, 66, 5, 24, "#232b3a");
      px(g, cx - wide - 4, 42, 4, 22, skin); px(g, cx + wide, 42, 4, 22, skin);
      px(g, cx - 7, 24, 14, 16, skin); // neck/head base
      break;
    }
    case "trousers": {
      px(g, cx - wide + 1, 62, wide * 2 - 2, 26, ap.pantsColor);
      px(g, cx - 1, 62, 2, 26, shade);
      break;
    }
    case "jacket": {
      const j = ap.jacket;
      px(g, cx - wide, 38, wide * 2, 24, ap.jacketColor);
      px(g, cx - wide - 4, 40, 4, 20, ap.jacketColor); px(g, cx + wide, 40, 4, 20, ap.jacketColor);
      px(g, cx - 1, 40, 2, 20, shade);
      if (j === 0) px(g, cx - 8, 30, 16, 10, ap.jacketColor);                       // hood at nape
      if (j === 1) { px(g, cx - wide, 48, wide * 2, 3, "#dfe8f4"); px(g, cx + off(3), 38, 2, 24, "#dfe8f4"); } // association stripe
      if (j === 2) { px(g, cx - wide + 2, 52, 5, 6, shade); px(g, cx + wide - 7, 44, 5, 6, shade); px(g, cx - 2, 30, 18, 9, ap.jacketColor); } // patched + big hood
      break;
    }
    case "strap": { // duffel strap: one bold diagonal
      g.save();
      px(g, cx - wide + 2 + flip, 40, 4, 22, ap.strapColor);
      for (let i = 0; i < 10; i++) px(g, cx - wide + 2 + i * 2 + off(i * 0), 40 + i * 2.2, 3, 3, ap.strapColor);
      g.restore();
      break;
    }
    case "face": {
      const f = ap.face;
      const ex = facing === "side" ? 2 : 0;
      if (facing === "back") break;
      px(g, cx - 6, 29, 12, 10, skin);
      if (f !== 3) { px(g, cx - 4 - ex, 33, 2, 2, "#14141c"); px(g, cx + 2 - ex, 33, 2, 2, "#14141c"); }
      else { px(g, cx - 4 - ex, 33, 3, 1, "#14141c"); px(g, cx + 1 - ex, 33, 3, 1, "#14141c"); }
      if (f === 1) { px(g, cx - 4 - ex, 35, 2, 1, "#00000050"); px(g, cx + 2 - ex, 35, 2, 1, "#00000050"); } // tired
      if (f === 2) { px(g, cx - 5 - ex, 32, 4, 1, "#14141c"); px(g, cx + 1 - ex, 32, 4, 1, "#14141c"); }     // sharp
      px(g, cx - 2, 37, 4, 1, "#00000040");
      break;
    }
    case "hair": {
      const h = ap.hair, hc = ap.hairColor;
      px(g, cx - 7, 22, 14, 8, hc); // cap
      if (h === 0) px(g, cx - 7, 24, 14, 4, hc);
      if (h === 1) { px(g, cx - 7, 20, 14, 10, hc); px(g, cx - 6, 30, 2, 4, hc); px(g, cx + 4, 30, 2, 4, hc); } // bowl
      if (h === 2) { px(g, cx - 8, 22, 16, 5, hc); px(g, cx - 3, 18, 6, 5, hc); }                                 // spikes
      if (h === 3) { px(g, cx - 7, 22, 14, 7, hc); px(g, cx + (facing === "back" ? -9 : 7), 24, 3, 16, hc); }     // ponytail (flips with facing)
      if (h === 4) { px(g, cx - 8, 20, 16, 6, hc); for (let i = 0; i < 5; i++) px(g, cx - 8 + i * 4, 17, 3, 4, hc); } // curls
      if (h === 5) { px(g, cx - 7, 22, 14, 6, hc); px(g, cx - 7, 28, 2, 8, hc); px(g, cx + 5, 28, 2, 8, hc); }   // curtain
      if (h === 6) { px(g, cx - 2, 18, 5, 8, hc); }                                                                // mohawk
      if (h === 7) { px(g, cx - 7, 22, 14, 12, hc); }                                                               // long
      if (ap.streak) px(g, cx - 6 + (h === 3 ? 13 : 3), 20, 3, facing === "back" ? 10 : 8, ap.streakColor);
      break;
    }
    case "accessory": {
      const a = ap.accessory, ac = ap.accColor;
      if (a === 0) { px(g, cx + 6, 31, 2, 3, ac); }                                  // earring
      if (a === 1) { px(g, cx - 7, 20, 14, 6, ac); }                                 // beanie
      if (a === 2) { px(g, cx - 7, 36, 14, 4, ac); px(g, cx + 4, 38, 3, 8, ac); }     // scarf
      if (a === 3) { px(g, cx - 5, 32, 4, 3, ac); px(g, cx + 1, 32, 4, 3, ac); px(g, cx - 1, 33, 2, 1, ac); } // glasses
      if (a === 4) { px(g, cx + (facing === "back" ? -wide - 6 : wide + 2), 52, 6, 8, ac); }                  // satchel
      if (a === 5) { px(g, cx - 5, 24, 3, 2, ac); }                                   // hairpin
      if (a === 6) { px(g, cx - 6, 30, 12, 3, ac); }                                  // bandage wrap
      break;
    }
  }
  return c;
}

function hasDom() { return typeof document !== "undefined"; }

// ---------------- creator option model (shared by canvas UI + tests) ----------------
export type CreatorField =
  | "name" | "pronouns" | "build" | "skin" | "face" | "hair" | "hairColor" | "streak" | "streakColor"
  | "jacket" | "jacketColor" | "pantsColor" | "strapColor" | "accessory" | "accColor" | "randomize" | "confirm";

export const CREATOR_FIELDS: CreatorField[] = ["name", "pronouns", "build", "skin", "face", "hair", "hairColor",
  "streak", "streakColor", "jacket", "jacketColor", "pantsColor", "strapColor", "accessory", "accColor", "randomize", "confirm"];

export const NAME_MIN = 2, NAME_MAX = 14;
export const validName = (n: string) => n.trim().length >= NAME_MIN && n.trim().length <= NAME_MAX && /^[\p{L}\p{M}'’\-. ]+$/u.test(n.trim());

export function cycleField(ap: Appearance, f: CreatorField, dir: 1 | -1): Appearance {
  const a = { ...ap };
  switch (f) {
    case "pronouns": { const o: Pronouns[] = ["he", "she", "they"]; a.pronouns = o[(o.indexOf(a.pronouns) + (dir === 1 ? 1 : 2)) % 3]; break; }
    case "build": a.build = (a.build + dir + 3) % 3; break;
    case "skin": a.skin = (a.skin + dir + SKIN_SWATCHES.length) % SKIN_SWATCHES.length; break;
    case "face": a.face = (a.face + dir + 4) % 4; break;
    case "hair": a.hair = (a.hair + dir + 8) % 8; break;
    case "hairColor": a.hairColor = HAIR_SWATCHES[(HAIR_SWATCHES.indexOf(a.hairColor) + dir + HAIR_SWATCHES.length) % HAIR_SWATCHES.length] ?? HAIR_SWATCHES[0]; break;
    case "streak": a.streak = !a.streak; break;
    case "streakColor": a.streakColor = COLOR_SWATCHES[(COLOR_SWATCHES.indexOf(a.streakColor) + dir + COLOR_SWATCHES.length) % COLOR_SWATCHES.length] ?? "#7fe7ff"; break;
    case "jacket": a.jacket = (a.jacket + dir + 3) % 3; break;
    case "jacketColor": a.jacketColor = nextColor(a.jacketColor, dir); break;
    case "pantsColor": a.pantsColor = nextColor(a.pantsColor, dir); break;
    case "strapColor": a.strapColor = nextColor(a.strapColor, dir); break;
    case "accessory": { let v = a.accessory + dir; if (v > ACCESSORY_NAMES.length - 2) v = -1; if (v < -1) v = ACCESSORY_NAMES.length - 2; a.accessory = v; break; }
    case "accColor": a.accColor = nextColor(a.accColor, dir); break;
    default: break;
  }
  invalidateDollCache();
  return a;
}
function nextColor(cur: string, dir: 1 | -1) {
  const i = COLOR_SWATCHES.indexOf(cur);
  return COLOR_SWATCHES[((i < 0 ? 0 : i) + dir + COLOR_SWATCHES.length) % COLOR_SWATCHES.length];
}

export function randomize(rnd: () => number): Appearance {
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length) % arr.length];
  const a = defaultAppearance();
  a.pronouns = pick(["he", "she", "they"] as const);
  a.build = Math.floor(rnd() * 3); a.skin = Math.floor(rnd() * 8); a.face = Math.floor(rnd() * 4); a.hair = Math.floor(rnd() * 8);
  a.hairColor = pick(HAIR_SWATCHES); a.streak = rnd() < 0.35; a.streakColor = pick(COLOR_SWATCHES);
  a.jacket = Math.floor(rnd() * 3); a.jacketColor = pick(COLOR_SWATCHES); a.pantsColor = pick(COLOR_SWATCHES);
  a.strapColor = pick(COLOR_SWATCHES); a.accessory = rnd() < 0.5 ? -1 : Math.floor(rnd() * (ACCESSORY_NAMES.length - 1));
  a.accColor = pick(COLOR_SWATCHES);
  invalidateDollCache();
  return a;
}
