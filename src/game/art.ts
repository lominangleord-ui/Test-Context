// Ashenveil — hand-authored pixel art. All sprites are string grids: '.' transparent.
// Palette:
//   o outline   s skin  e eyes  H hair   c coat main  d coat dark  l coat light
//   p pants     b boots w eye-white    W white        K black
import { buildSprite, outlineSprite, tintSprite } from "./core";

export const PAL = {
  o: "#12141d", s: "#f2c9a0", S: "#d9a97f", e: "#14141c", w: "#ffffff",
  H: "#2b2320", h: "#3d322c",
  c: "#46617f", d: "#334a63", l: "#5b7ba0",
  p: "#2a3342", b: "#181d26",
  snow: "#dfe8f4", snowDark: "#b9c9de", snowLight: "#f4f8ff",
  roof: "#7c4a3a", roofLight: "#9c6049", wall: "#c8a06a", wallDark: "#8a6a45",
  wood: "#5e4632", woodDark: "#3f2e20",
  glow: "#ffd88a", glowCyan: "#7fe7ff",
};

const BASE: Record<string, string> = {
  ".": "-", o: PAL.o, s: PAL.s, S: PAL.S, e: PAL.e, w: PAL.w,
  H: PAL.H, h: PAL.h, c: PAL.c, d: PAL.d, l: PAL.l, p: PAL.p, b: PAL.b,
};

// ---------- the hunter (16×20), 4 directions, 2-frame walk ----------

const HEAD_DOWN = [
  "....oooo....",
  "..ooHHHHoo..",
  ".oHHhhhhHHo.",
  ".oHssssssHo.",
  ".osewssweso.",
  ".oSssssesSo.",
  "..SssssssS..",
];
const TORSO_DOWN = [
  "..occccccо..",
  ".occllllcо.",
  ".ocsccccso.",
  ".os.cd.c.so",
  "...cccccc...",
  "...dddddd...",
];
const LEGS_IDLE = ["...pp..pp...", "...pp..pp...", "...bb..bb...", "..obb..bbo.."];
const LEGS_A = ["..ppp..pp...", "..pp....pp..", "..bb.....bb.", ".obb.....bbo"];
const LEGS_B = ["...pp..ppp..", "...pp...pp..", "...bb....bb.", "..bb....bbo."];

type Rowish = string[] | string;
function join(rows: Rowish[]): string[] {
  return (rows as unknown[]).flat(2).map((r) => String(r).padEnd(16, "."));
}
export function pad16(rows: string[]): string[] { return rows.map((r) => r.padEnd(16, ".")); }

export function hunterDown(frame: 0 | 1): HTMLCanvasElement {
  return buildSprite(join([HEAD_DOWN, TORSO_DOWN, frame === 0 ? LEGS_IDLE : LEGS_A]), BASE);
}
export function hunterDown2(): HTMLCanvasElement {
  return buildSprite(join([HEAD_DOWN, TORSO_DOWN, LEGS_B]), BASE);
}
const HEAD_UP = [
  "....oooo....",
  "..ooHHHHoo..",
  ".oHHHHHHHHo.",
  ".oHHhHHhHHо.",
  ".oHHHHHHHHo.",
  ".oddddddddo.",
  "..dddddddd..",
];
export function hunterUp(frame: 0 | 1): HTMLCanvasElement {
  const head = HEAD_UP.map((r) => r.replace("о", "o"));
  return buildSprite(join([head, ["..occcccccо.".replace("о", "o")], TORSO_DOWN.slice(1, 3).map((r) => r.replace("о", "o")), TORSO_DOWN[4], TORSO_DOWN[5], frame === 0 ? LEGS_IDLE : LEGS_A]), BASE);
}
const HEAD_SIDE = [
  "....oooo....",
  "..ooHHHHoo..",
  ".oHHhhhhhо..",
  ".oHHssssso..",
  "..osewssso..",
  "..oSssssо...",
  "...sssss....",
];
const TORSO_SIDE = [
  "...occcо....",
  "..ocllccо...",
  "..occcccsо..",
  "..osccccc...",
  "...ccccc....",
  "...ddddd....",
];
export function hunterSide(frame: 0 | 1, flip = false): HTMLCanvasElement {
  const head = HEAD_SIDE.map((r) => r.replace("о", "o"));
  const torso = TORSO_SIDE.map((r) => r.replace("о", "o"));
  let rows = join([head, torso, frame === 0 ? LEGS_IDLE : LEGS_A]);
  if (flip) rows = rows.map((r) => [...r].reverse().join(""));
  return buildSprite(rows, BASE);
}

// ---------- generic NPC builder (palette-swapped humans) ----------

export interface NpcStyle {
  hair: string; hairLt: string; coat: string; coatDk: string; coatLt: string;
  accent?: string; small?: boolean; hat?: "none" | "beanie" | "helmet"; beard?: boolean;
}
export function npcSprite(st: NpcStyle): HTMLCanvasElement {
  const m: Record<string, string> = { ...BASE, H: st.hair, h: st.hairLt, c: st.coat, d: st.coatDk, l: st.coatLt };
  const head = [...HEAD_DOWN];
  if (st.beard) { head[5] = ".SbsssbsS."; m["b"] = st.hairLt; }
  if (st.hat === "beanie") { head[1] = "..ooaaaaoo.."; head[2] = ".oaaaaaaaao."; m["a"] = st.coatLt; }
  if (st.hat === "helmet") { head[1] = ".oooaaааooo."; head[2] = "oaаaaaaaaaaа".slice(0, 12); head[3] = ".oHssssssHo."; m["a"] = "#9aa7b5"; }
  const rows = join([head, TORSO_DOWN, LEGS_IDLE]);
  const c = buildSprite(rows, m);
  if (st.small) {
    const s = document.createElement("canvas");
    s.width = 14; s.height = 17;
    s.getContext("2d")!.drawImage(c, 1, 3, 14, 17);
    return s;
  }
  return c;
}

// ---------- overworld monsters (compact) ----------

export const RABBIT_OW = [
  ".o...o..", ".o..ao..", ".osaao..", "osoaaos.", "osWWWSo.", ".oWWWо..",
];
export function rabbitOw(): HTMLCanvasElement {
  return buildSprite(pad16(RABBIT_OW.map((r) => r.replace("о", "o"))), { ...BASE, W: "#e8eef8", a: "#f2b8c6" });
}
export const HOUND_OW = [
  "..ooooo.....", ".oKKWWWKo...", "oKWWWWWWWo..", "oKWeWWWeWo..", ".oWWWWWWo...", ".oWW..WWо...",
];
export function houndOw(): HTMLCanvasElement {
  return buildSprite(pad16(HOUND_OW.map((r) => r.replace("о", "o"))), { ...BASE, K: "#4a4f5e", W: "#b8c2d2" });
}

// ---------- battle sprites ----------

export function spr(rows: string[], map: Record<string, string>): HTMLCanvasElement {
  return buildSprite(rows.map((r) => r.padEnd(Math.max(...rows.map((x) => x.length)), ".")), map);
}

// ---------- expedition sprites (regions 1-4) ----------

/** Moss Crawler — a fat velvet caterpillar with a leaf mane and amber eyes. */
export function crawlerBattle(): HTMLCanvasElement {
  return spr([
    "......GG..GG......",
    ".....gGG..GGg.....",
    "..ddDDDDDDDDDDdd..",
    ".dDDDDDDDDDDDDDDd.",
    ".dDDffDDDDDDffDDDd",
    "dDDDDDDDDDDDDDDDd.",
    "dDpDDDDDDDDDDDDpDd",
    "dDDDDDDDDDDDDDDDd.",
    ".dDDDppDDDDppDDDd.",
    "..dddddddddddddd..",
    "....pp....pp......",
  ], { G: "#79c26f", g: "#4f8b46", D: "#2e6b3d", d: "#1d4428", f: "#ffdf6e", p: "#c46a9e" });
}
/** Cinder Bat — palm-sized, wings like torn embers. */
export function batBattle(): HTMLCanvasElement {
  return spr([
    "e.............e...",
    "ee....o..o....ee..",
    ".eee.wWWWWw.eee...",
    "..eeWWWWWWWWee....",
    "..eWWfWWWfWWe.....",
    ".eWWWWWWWWWWWWe...",
    ".eEWWWmmmWWWWEe...",
    "..eEEWEDEWEEEe....",
    "...e..EEE..e......",
    "......E.E.........",
  ], { e: "#f0782e", E: "#b34a17", W: "#3c2a33", w: "#241a22", o: "#181014", m: "#ffd88a", f: "#ff5f6e", D: "#ffffff" });
}
/** Bog Lurker — a hill of muscle and old anger that pretends to be mud. */
export function lurkerBattle(): HTMLCanvasElement {
  return spr([
    ".....LLLLLLLL.....",
    "..LlLLLLLLLLLlL...",
    ".LLLLLLwLLLLLLLLL.",
    ".LLLLLwwwLLLLLLLLL",
    "kLLLLLLwLLLLLLLLk.",
    "kLLLLLLLLLLLLLLLk.",
    "LmMLLLLLLLLLLLLmML",
    "LLMMMLLLLmLLLLMMMLL".slice(0, 20),
    ".LLLLLLLmLLLLLLL..",
    "..ss..ssss..ss....",
  ], { L: "#5d6e3d", l: "#8da15e", w: "#ffe66e", k: "#3f4d29", m: "#7a6845", s: "#41502c" });
}
/** Reed Stalker — woven stalks tied around a stolen lantern for a heart. */
export function reedBattle(): HTMLCanvasElement {
  return spr([
    "....r.r.r.r.......",
    ".rr..rr..rr..rr...",
    "..rRr..r..r..Rr...",
    "...R................",
    "...RRR............",
    "....RLLLLLRRR.....",
    "....LlffflL.......".slice(0, 18),
    "....LlffflL.......",
    "....RLLLLLR.......",
    ".....R..R.R.......",
    "....R.R.R..R.R....",
  ], { r: "#9ab84e", R: "#6f7f3a", L: "#48542b", l: "#2c3319", f: "#ffd88a" });
}
/** Slag Golem — furnace dross with a furnace still lit inside. */
export function golemBattle(): HTMLCanvasElement {
  return spr([
    "..KKKKKKKKKKK.....",
    ".KKfKfKfKfKKK.....",
    ".KKKKKKKKKKKKKK...",
    "kKKKKKKKKKKKKKKKk.",
    "kKkKKoooooKKKKKKk.",
    "KKKoooo.ooKKKKoKK.",
    "KKKo.oF.oKKKKKKKK.",
    "KKKKo.oKKKKKKoKKK.",
    ".KKKKKKKKKoooooK..",
    "..KKkKKKKKKKkKK...",
    "..KKK...KKK..KK...",
    ".kkkk...kkkk.kkk..",
  ], { K: "#5a5260", k: "#3a3440", o: "#ff8a3c", f: "#ffd88a", F: "#fff2c2" });
}
/** Blood-Red Hobgoblin — two metres of scar tissue wearing a butcher's kit. */
export function hobgoblinBattle(): HTMLCanvasElement {
  return spr([
    ".....RRRRRRR......",
    "....RRRRRRRRR.....",
    "...RrRRRRRRRrR....",
    "...RWWWRRRWWW.....",
    "...RrWWRWWRrR.....",
    "....RRRDWDRRR.....",
    "....RRRmmmR.......",
    ".....RWWWWW.......",
    "..SSSSbbbbSSSS....",
    ".SkSSbbbbbbSSkS...",
    ".SSSSbbbbbbSSSS...",
    "..SRRbRRRRbRRS..H.",
    "...RRbRRRRbRR..HH.",
    "....Rb.RR.b..HH...",
    "....TT.TT.TT......",
    "...tt...tt.tt.....",
  ], { R: "#a03a2e", r: "#7c2a22", W: "#ffd88a", D: "#ffffff", m: "#3c1410", b: "#6b5646", S: "#3d4657", k: "#20262f", H: "#9aa7b5", h: "#6e7784", T: "#57402c", t: "#33261a" });
}
/** Stone Sentinel — four hundred years of statue, ten seconds of patience. */
export function sentinelBattle(): HTMLCanvasElement {
  return spr([
    "....SSSSSSSS......",
    "...SSSSSSSSSS.....",
    "...SsSSSSSSsS.....",
    "...SGGOOOGOGS.....",
    "...SSSSSSSSSS.....",
    "....SSSmSSS.......",
    "..SSSSSSSSSSSS....",
    ".SSySSSSSSSSSSyS..",
    ".SSSSSSSSSSSSSSS..",
    ".SSxSSSSSSSSSSSS..",
    "..SSSSSxxSSSSS....",
    "...SSSSSSSSSS.....",
    "...SS..SS..SS.....",
    "...SS..SS..SS.....",
    "..xxS..SS..Sxx....",
    "..SSS..SS..SSS....",
  ], { S: "#8a8fa0", s: "#62677a", G: "#7fe7ff", O: "#0d1219", m: "#4a4f5e", x: "#57606e", y: "#4f8b46" });
}
/** Iron Tusk — a cavern boar with a broken sword in the shoulder and chains for bristles. */
export function irontuskBattle(): HTMLCanvasElement {
  return spr([
    "........Hh..............",
    ".......Hh...............",
    ".TTTTTTTTTTTTtttt.......",
    "TTTTbTTTTTTTTTTTTtT.....",
    "TTbTTTWWWTTTTTTTTTt.....",
    "TTbTTWfWTfWTTTTtt.......",
    ".TTTTTWWWWTTTTt.........",
    ".HHHHHHHHHHHHH..........",
    "TTTbTTTTTTTTTTTT........",
    ".TTTTTTTTTTTTTt.........",
    "..TT..TT..TT............",
    "..tt..tt..tt............",
  ], { T: "#6b4a35", b: "#42301f", t: "#8a6647", W: "#ff5f6e", f: "#ffffff", H: "#9aa7b5", h: "#5f6a78" });
}
/** Black Fang Alpha — the pack's mathematics in fur form. */
export function alphaBattle(): HTMLCanvasElement {
  return spr([
    "....K................KKK......",
    "...KK...............KWWWK....",
    "..KKKK.....KKKKK....KWfWfK....",
    ".KKKKKKKKKKKKKKKKKKKKWWWWK....",
    "KKKKKKKKKKKKKKKKKKKKKKKKKK....",
    "KKkKKKKKKKKKKKKKKKKKKKKKKKk...",
    ".KKKKKKKKKKKKKKKKKKKKKKKKK....",
    "..KsKKsKKsKKKKKKKKsKKsKK......",
    "..KKKK..KKKKKKKK..KKKK........",
    "..KKK...KKKKKKK...KKK.........",
    "..kkk...kkkkkkk...kkk.........",
  ], { K: "#17141f", k: "#2e2a3d", s: "#b8c2d2", W: "#4a4f5e", f: "#ff3355" });
}
/** The Gate Warden — plate armour with a halberd and no opinion about you. */
export function wardenBattle(): HTMLCanvasElement {
  return spr([
    ".........P........................",
    "........PPP....A..............H...",
    ".......PPPPP...AAA...........HH...",
    "........PPP....AA...........HH....",
    ".........P.....oAo.........H......",
    ".........P....oAAAo.......HHHH....",
    ".........P..AAAAAAA......AAaHH....",
    ".........P.AAaAAAAaA....AAHH......",
    ".........PAAAAAAAAAAA..HHH........",
    ".........PAAmAAAAAmAA.H...........",
    ".........P.AAAAAAAAAA.............",
    ".........P.AAaAAAAaAA.............",
    ".........P..AAAAAAAA..............",
    ".........P...AAaAAaA..............",
    "........PPP..AA..AA..............",
    ".......PPPP.PPP..PPP.............",
    ".......PP....P....P..............",
  ], { P: "#7a2540", A: "#8d95a8", a: "#5b6373", o: "#ffd88a", m: "#10121a", H: "#b9c9de", h: "#7c8798" });
}

/** Rimehare — 26×26 white snow bunny with rosy cheeks and an axe carved from ice. */
export function hareBattle(): HTMLCanvasElement {
  const rows = [
    "...oo......oo.........",
    "..oWOо....oWOо........",
    "..oWWо....oWWо........",
    "..oWWо....oWWо........",
    "..oWWо....oWWо........",
    "...oWооooоoWо.........",
    "..oWWWWWWWWWWо........",
    ".oWWWPPWWWWWWWWо......",
    "oWWWWWeWWWWWPeWWo.....",
    "oWWWWWWWWWWWWWWeWo....",
    "oWWWWWWWWWWWWWWWpWWo..",
    ".oWWWWWWWWWWWWWWWWо...",
    ".oWtWWWWWWWWWWWWWWo...",
    ".oWWWWWWWWWWWWWWWWo...",
    "..oWWWWWWWWWWWWWWо....",
    "..oPPоWWWWWWoPPо......",
    "...oo.oWWо.oо.........",
    "......oPPо............",
    "......oPPо............",
    ".......oo.............",
  ];
  return spr(rows, { ...BASE, W: "#eef4fc", P: "#c8d8ea", t: "#a06a4a", e: "#1a1a24" });
}

/** Stone Hound — 30×24 blocky dog, glowing amber eyes. */
export function houndBattle(): HTMLCanvasElement {
  const rows = [
    "....ooo........ooo........",
    "...oKKо........oKKо.......",
    "...oKKо........oKKо.......",
    "....ooooooooooooо.........",
    "...oKKKKKKKKKKKKKKо.......",
    "..oKKKGGKKKKKGGKKKо.......",
    "..oKKKGGKKKKKGGKKKо.......",
    "..oKKKKKKKKKKKKKKKKо......",
    "..oKKKKKooooKKKKKKKо......",
    "...oKKKKoWWoKKKKKKо.......",
    "....oooooooooooooo........",
    "...oKKKKKKKKKKKKKKо.......",
    "..oKKKKKKKKKKKKKKKKо......",
    "..oKKKKKKKKKKKKKKKKо......",
    "..oKKKКKKKKKKKKKKKо.......",
    "...ooKKooKKooKKooо........",
    "...oKKоoKKоoKKоoKKо.......",
    "....оо..оо..оо..оо........",
  ];
  return spr(rows, { ...BASE, K: "#98a3b8", G: "#ffd88a", W: "#5b6474" });
}

/** Frost Imp — 24×30 snarling blue goblin with icicle teeth. */
export function impBattle(): HTMLCanvasElement {
  const rows = [
    "..oо......оo.........",
    "..oWo....oWo.........",
    "..oWoоooоoWo.........",
    "...oIIIIIIо..........",
    "..oIIIIIIIо..........",
    "..oIeIIIIIeо.........",
    "..oIIIIIIIо..........",
    "..oIIWWWWoо..........",
    "...oWWWWо............",
    "...oIoIoо............",
    "..oIIIIIо...........",
    ".oIIIooIIIо.........",
    ".oIIоWWоIIIо........",
    "oIIоWWWWоIIIо.......",
    "oIоWWWWWWоIIо.......",
    "oIоWWWWWWоIо........",
    ".o.WWWWоо.........",
    "...оо..оо...........",
    "..oIo..oIo..........",
    "..ooo..ooo..........",
  ];
  return spr(rows, { ...BASE, I: "#7fa8d9", W: "#dfe8f4", o2: "#12141d" });
}

/** Ice Wight — 26×36 hollow pale specter with lantern eyes. */
export function wightBattle(): HTMLCanvasElement {
  const rows = [
    ".....oooooooooo......",
    "...ooBBBBBBBBBBоо....",
    "..oBBBBBBBBBBBBBBо...",
    "..oBBBYYBBBBYYBBBо...",
    "..oBBBYYBBBBYYBBBо...",
    "..oBBBBBBBBBBBBBBо...",
    "..oBBBoBoBoBoBoBBо...",
    "...oBBBBBBBBBBBBо....",
    "....ooBBBBBBBоo......",
    "......oBBBBBо........",
    ".....oBBоBоBBо.......",
    "....oBBо.BоBBо.......",
    "...oBBо..o..BBо......",
    "...oBо..ooo..Bo......",
    "....oo.oBBB.oо.......",
    ".......oBBBо.........",
    ".......oBBBо.........",
    ".......oBBBо.........",
    "........ooo..........",
  ];
  return spr(rows, { ...BASE, B: "#3a4a66", Y: "#9ff3d0" });
}

/** Hobgoblin Warlord Kesh — 40×44 green brute with a chipped sword. */
export function keshBattle(): HTMLCanvasElement {
  const rows = [
    "..оo............оo...........",
    ".oKo............oKo..........",
    ".oKо............оKо..........",
    ".oKKooоooооooоооKKо..........",
    "..oGGGGGGGGGGGGGо...........",
    "..oGGeGGGGGGGeGGo...........",
    "..oGGGGGGGGGGGGGо...........",
    "..oGWWWWoWoWWWWWо...........",
    "..oGGGGGGGGGGGGGо...........",
    "...ooooooooooooо............",
    "...oRRRRRRRRRRRо...........",
    "..oRRRRRRRRRRRRRо...........",
    ".oRRRAAAAAAAAARRRо...........",
    "oRRAAAAAAAAAAAARRRRо.........",
    "oGAAAAAAAAAAAAAARRGGo........",
    "oGAAAAAAAAAAAAAARRGGo........",
    ".oGAAAAAAAAAAAAARRGGо........",
    "..ooAAAAAAAAAAARRoo........",
    "...оGAAAAAAAARRGо...........",
    "....oGAAAAAAAGo.............",
    "....oGGо..оGGо..............",
    "....oGGо..oGGо..............",
    "....oRRо..oRRо..............",
    "....оoo....ooo..............",
  ];
  return spr(rows, { ...BASE, G: "#8fae70", R: "#6a5a8f", A: "#3f3a2e", K: "#d8d8d8" });
}

/** The Architect — 48×52: faceless gold-masked figure in a black mantle with a halo of runes. */
export function architectBattle(): HTMLCanvasElement {
  const rows = [
    "............oooooo............",
    "..........ooKKKKKKoo..........",
    ".........oKKGGGGGGKKо.........",
    ".........oKGGYYYYGGKо.........",
    "........oKGYeYYYYeYGKо........",
    "........oKGYeYYYYeYGKо........",
    ".........oKGGYYYYGGKо.........",
    ".........oKKGGGGGGKKо.........",
    "..........ooKKKKKKoo..........",
    "............оooooо............",
    ".........ooKKKKKKKKоо.........",
    ".......ooKKKKKKKKKKKKоо.......",
    "......oKKKKKKKKKKKKKKKKо......",
    ".....oKKKKKKYYYYKKKKKKKKо.....",
    ".....oKKKKKYYYYYYYYKKKKKо.....",
    "....oKKKKKKYYYYYYYYKKKKKKо....",
    "....oKKKKKKKYYYYYYKKKKKKKо....",
    "....oKKKKKKKKYYYYKKKKKKKKо....",
    "....oKKKKKKKKKKKKKKKKKKKKо....",
    ".....oKKKKKKKKKKKKKKKKKKо.....",
    "......oKKKKKKKKKKKKKKKо......",
    ".......ooKKKKKKKKKKKоо.......",
    ".........ooKKKKKKKKKоо.......",
    "............ooooooо.........",
  ];
  return spr(rows, { ...BASE, K: "#141424", Y: "#ffd88a", G: "#e8e2c8" });
}

/** The System Itself — 40×40: a bracketed mechanical eye, genocide route final. */
export function sentryBattle(): HTMLCanvasElement {
  const rows = [
    "....оо.................оо....",
    "....oKo...............oKo....",
    "....oKо...............oKо....",
    "....oKо....oooooo....oKо....",
    "....oKо..ooBBBBBBoo..oKо....",
    "....oKо.oBBWBBBBWBBo.oKо....",
    "....oKо.BBWWBBBBWWBBо.oKо...",
    "....oKо.BBWBRRBRBWBBо.oKо...",
    "....oKо.BBWBRRBRBWBBо.oKо...",
    "....oKо.BBWWBBBBWWBBо.oKо...",
    "....oKо.oBBWBBBBWBBо.oKо....",
    "....oKо..ooBBBBBBoo..oKо....",
    "....oKо....oooooo....oKо....",
    "....oKo...............oKo....",
    "....оо.................оо....",
  ];
  return spr(rows, { ...BASE, K: "#8b93a5", B: "#1c1f2e", W: "#e8eefc", R: "#ff5566" });
}

// ---------- props / structures ----------

/** Snow-roofed inn with door + windows: 48 wide × 40 tall. */
export function innSprite(): HTMLCanvasElement {
  const rows = [
    ".......oooooooooooooo.......",
    ".....ooWWWWWWWWWWWWWWoo.....",
    "...oWWWWWWWWWWWWWWWWWWWWo...",
    "..oWWWWLLLLLLLLLLLLLLWWWWо..",
    "..oRLLLLLLLLLLLLLLLLLLLRо...",
    "..oRLLLLLLLLLLLLLLLLLLLRо...",
    "..oRRRRRRRRRRRRRRRRRRRRRо...",
    "..oRRRRRRRRRRRRRRRRRRRRRо...",
    ".oRRRRRRRRRRRRRRRRRRRRRRRо.",
    ".oRRRRRRRRRRRRRRRRRRRRRRRо.",
    "oooooooooooooooooooooooooooo",
    "оWWWWWWWWWWWWWWWWWWWWWWWWWо",
    "оWWwGGGGWWWWWWWWGGGGWWWWWwо",
    "оWWwGGGGWWWWbbWWGGGGWWWWWwо",
    "оWWWWWWWbwwwwwwWWWWWWWWWWWо",
    "оGGGGGGGGGoooggоGGGGGGGGGGо".slice(0, 28),
    "оRGGGGGGGGgoggggоGGGGGGGGGо".slice(0, 28),
    "оRRRRRRRRRRRRRRRRRRRRRRRRRRо",
  ];
  const map = { ...BASE, W: PAL.snowLight, L: PAL.roofLight, R: PAL.roof, G: PAL.glow, b: PAL.woodDark, w: PAL.wood, o2: PAL.o };
  return spr(rows, map);
}

export function houseSprite(): HTMLCanvasElement {
  const rows = [
    "....oooooooo....",
    "..ooWWWWWWWWоо..",
    ".oLLLLLLLLLLLLo.",
    "oRLLLLLLLLLLLLRо",
    "oRRRRRRRRRRRRRRо",
    "oooooooooooooooo",
    "оWWGGWwwwWGGWWо",
    "оWWGGWwwwwWGGWо",
    "оWWWWWWbbWWWWWо",
    "оRRRRRRRRRRRRRо".slice(0, 16),
  ];
  return spr(rows.map((r) => r.replace(/о/g, "o")), { ...BASE, W: PAL.wall, L: PAL.roofLight, R: PAL.roof, G: PAL.glow, b: PAL.woodDark, w: PAL.wood });
}

export function pineTree(): HTMLCanvasElement {
  const rows = [
    ".......oo.......",
    ".....ooNNo......",
    "....oWWwWNo.....",
    "...oNNNNNNNo....",
    "..oNWNWNNWNo....",
    "..oNNNNNNNNNo...",
    ".oWWNNNNNNNNNo..",
    "oNNNWWNNNNNNNo..",
    "oNNNNNNNNNNNo...",
    "..oNNNNNNNo.....",
    "...oNNNoо.......",
    "....owo.........",
    "....oWo.........",
  ];
  return spr(rows.map((r) => r.replace(/о/g, "o")), { ...BASE, N: "#2c4a3a", W: PAL.snowLight, w: PAL.wood });
}

export function deadTree(): HTMLCanvasElement {
  const rows = [
    "..ооooоoо.......",
    "oБBBбBBБbBo.....",
    ".oБbБbББBo......",
    "..oБbББBo.......",
    "...oБbbBo.......",
    "...oБbbBo.......",
    "....oБBo........",
    "....oБBo........",
    "....oБBo........",
    "...obbbbo.......",
  ];
  return spr(rows.map((r) => r.replace(/о/g, "o").replace(/Б/g, "B").replace(/б/g, "b")), { ...BASE, B: "#6a5a4a", b: "#4a3e32" });
}

/** System save obelisk — 16 wide × 34 tall, cyan runes. */
export function obeliskSprite(): HTMLCanvasElement {
  const rows = [
    "....oooo....",
    "...oYYYYo...",
    "..oYоCCоYo..",
    "..oYoCCoYo..",
    "..oYCCCCYo..",
    "..oYoCCoYo..",
    "..oYCCCCYo..",
    "..oYoCCoYo..",
    "..oYCCCCYo..",
    "..oYoCCoYo..",
    "..oYCCCCYo..",
    "..oYoCCoYo..",
    "..oYCCCCYo..",
    "..oYoCCoYo..",
    "..oYCCCCYo..",
    "..oYooooYo..",
    ".ooYYYYYYoo.",
    "oKKKKKKKKKKo",
    "oooooooooooo",
  ];
  return spr(rows.map((r) => r.replace(/о/g, "o")), { ...BASE, Y: "#2a3550", C: PAL.glowCyan, K: "#1a1f2e" });
}

/** Portcullis gate — 24×28. closed = bars; open = rolled grate above frame. */
export function gateClosed(): HTMLCanvasElement {
  const rows: string[] = [
    "oooooooooooooooooooooooo",
    "оSSSSSSSSSSSSSSSSSSSSSSо".slice(0, 24),
    "оSSSSSSSSSSSSSSSSSSSSSSо".slice(0, 24),
    "oooooooooooooooooooooooo",
    "оo..оo..оo..оo..оo..оo..".slice(0, 24),
  ];
  for (let i = 0; i < 19; i++) rows.push("оB..оB..оB..оB..оB..оB..".slice(0, 24));
  return spr(rows.map((r) => r.replace(/о/g, "o")), { ...BASE, B: "#8a93a5", S: "#5e4632" });
}
export function gateOpen(): HTMLCanvasElement {
  const rows: string[] = [
    "oooooooooooooooooooooooo",
    "оSSSSSSSSSSSSSSSSSSSSSSо".slice(0, 24),
    "оBSSBSSBSSBSSBSSBSSBSSBо".slice(0, 24),
    "oooooooooooooooooooooooo",
  ];
  return spr(rows.map((r) => r.replace(/о/g, "o")), { ...BASE, B: "#8a93a5", S: "#5e4632" });
}

/** Market stall — 24×18 striped awning + counter. */
export function stallSprite(accent: string): HTMLCanvasElement {
  const rows = [
    ".oRRooRRooRRooRRooRRo...",
    "oRRWRRWWRRWWRRWWRRWRRо..",
    "oooooooooooooooooooooooo",
    "оbbbbbbbbbbbbbbbbbbbbbo.",
    "оbBBBBbbbbbbbbbbbbbBBbo.",
    "оbbbbbbbbbbbbbbbbbbbbbo.",
    "оwwwwwwwwwwwwwwwwwwwwbo.",
    "оwWWWWWWWWWWWWWWWWWWWwo.",
    "оwWWWWWWWWWWWWWWWWWWWwo.",
    "оowо............оwo....",
    "обbo............obbo...",
  ];
  return spr(rows.map((r) => r.replace(/о/g, "o")), { ...BASE, R: accent, W: "#efe6d0", b: PAL.woodDark, B: PAL.wood });
}

export function signSprite(): HTMLCanvasElement {
  return spr([
    "oooooooooooo",
    "oWWWWWWWWWWo",
    "oWBBBBBBBWо".slice(0, 12),
    "oWByyyyyyBWо".slice(0, 12),
    "oWBBBBBBBWо".slice(0, 12),
    "oWWWWWWWWWWo",
    "..ob....bo..",
    "..ob....bo..",
    ".obb....bbo.",
  ], { ...BASE, W: "#8a6a45", B: PAL.wood, y: "#d8cfb8" });
}

/** Bridge deck tile 16×16 planks + rail. */
export function bridgeTile(): HTMLCanvasElement {
  return spr([
    "bbbbbbbbbbbbbbbb",
    "bppbppppbppppppb",
    "bppbppppbppppppb",
    "bdddddddddddddb",
    "bppppppbppbppppb",
    "bppppppbppbppppb",
    "bdddddddddddddb",
    "bppbppppbppppppb",
    "bppbppppbppppppb",
    "bdddddddddddddb",
    "bppppppbppbppppb",
    "bppppppbppbppppb",
    "bdddddddddddddb",
    "bppbppppbppppppb",
    "bppbppppbppppppb",
    "bbbbbbbbbbbbbbbb",
  ], { b: "#33261a", p: "#8a6647", d: "#57402c" });
}
export function bridgeRail(): HTMLCanvasElement {
  return spr([
    "оbbbbbbbbbbbbbbо".replace("о", "o"),
    "oooooooooooooooo",
    ".o.o.o.o.o.o.o.o",
    "oooooooooooooooo",
  ], { ...BASE });
}

/** Ice sheet tile 16×16 (the frozen stream). */
export function iceTile(): HTMLCanvasElement {
  return spr([
    "iiiiiiiiiiiiiiii",
    "iiiiiiiiiiiiiiii",
    "iiiWiWiWiiiiiiii",
    "iiiiiiiiiiiiWiii",
    "iiiiiiWiiiiiiiii",
    "iiiiiiiiiiiiiiii",
    "iWiiiiiiWiiWiiii",
    "iiiiiiiiiiiiiiii",
    "iiiiiiiiiiiiiiii",
    "iiiiiiWiiiiiiiii",
    "iiWiiiiiiiWiiiii",
    "iiiiiiiiiiiiiiii",
    "iiiiiiiiiiiiiiii",
    "iiiWiiiiiiiiWiii",
    "iiiiiiiiiiiiiiii",
    "iiiiiiiiiiiiiiii",
  ], { ...BASE, i: "#7fa4c9", W: "#e6f3ff" });
}

/** Dark dungeon portal arch (the Gate to the Crater). */
export function gatePortal(): HTMLCanvasElement {
  const rows = [
    "......oooooo......",
    "...ooKKKKKKoo.....",
    "..oKRRRRRRRRKo....",
    "..oKRddddddRKо....",
    ".oKRddddddddRKo...",
    ".oKddKddddKddKo...",
    "oKdddKKddKKdddKо..",
    "oKddddddddddddKо..",
    "oKddddddddddddKо..",
    "oKddddddddddddKо..",
    "oKddddddddddddKо..",
    "oKddddddddddddKо..",
    "oooooooooooooooooo",
  ];
  return spr(rows.map((r) => r.replace(/о/g, "o")), { ...BASE, K: "#3a0f14", R: "#a03844", d: "#120810" });
}

export function ashPile(): HTMLCanvasElement {
  return spr([
    "...o...o....",
    "..oBo.oBo...",
    ".oBBBBBBBo..",
    "oBBbBbBbBBo.",
    "oBbBbBbBbBo.",
    ".oooooooooo.",
  ], { ...BASE, B: "#4a4a52", b: "#2e2e36" });
}

// ---------- UI bits ----------

export function soulSprite(): HTMLCanvasElement {
  return spr([
    ".oo.oo.",
    "oWWoWWo",
    "oWWWWWo",
    "oWWWWWo",
    ".oWWWo.",
    "..oоo..",
    "...o...",
  ].map((r) => r.replace("оо", "oo")), { ...BASE, W: "#ff3355" });
}

export function arrowCursor(): HTMLCanvasElement {
  return spr([
    "оoo...",
    "oWwo..",
    "ooWwo.",
    "oWWwo.",
    "ooWwo.",
    "oWwo..",
    "ooo...",
  ].map((r) => r.replace("оoo", "ooo")), { ...BASE, W: "#ffd88a" });
}

export function heartIcon(): HTMLCanvasElement {
  return spr([
    ".oo.oo.",
    "oWWWWWWo",
    "oWWWWWWo",
    ".oWWWWо.".slice(0, 8),
    "..oWWo..",
    "...oo...",
  ].map((r) => r.replace("о", "o")), { ...BASE, W: "#ff3355" });
}

export function starIcon(): HTMLCanvasElement {
  return spr([
    "...o...",
    "..oYo..",
    "ooYYYoo",
    ".oYYYo.",
    ".oYoYo.",
    "oo...oo",
  ], { ...BASE, Y: "#9fe8ff" });
}

export function potionIcon(): HTMLCanvasElement {
  return spr([
    ".ooo.",
    ".oKo.",
    "oRPRo",
    "oPPPo",
    "oPRPo",
    ".ooo.",
  ], { ...BASE, K: "#8a6a45", R: "#ff5566", P: "#c8e8ff" });
}

export function keyIcon(): HTMLCanvasElement {
  return spr([
    ".oo.",
    "oWWo",
    "oWWо".slice(0, 4).replace("о", "o"),
    ".oo.",
    ".oW.",
    "oWWo",
  ], { ...BASE, W: "#ffd88a" });
}

// prebuilt singletons
let cache: Record<string, HTMLCanvasElement> | null = null;

// ---------- expedition recolors + region props ----------
export function rhoundBattle(): HTMLCanvasElement { return tintSprite(houndBattle(), [["#4a4f5e", "#5d5348"], ["#33363f", "#3b342d"], ["#b8c2d2", "#8b7f6c"], ["#ffdf6e", "#ff5f6e"]]); }
export function stalkerBattle(): HTMLCanvasElement { return tintSprite(impBattle(), [["#7fb2ff", "#9ab84e"], ["#4a6bb5", "#48542b"], ["#cfe0ff", "#d9e08a"], ["#ff5f6e", "#ffd88a"]]); }
export function dsentryBattle(): HTMLCanvasElement { return tintSprite(wightBattle(), [["#9fb4d8", "#5f8f92"], ["#5b6a80", "#37555c"], ["#7fe7ff", "#9de8d2"], ["#0d1219", "#101c22"]]); }
export function hknifeBattle(): HTMLCanvasElement { return tintSprite(wightBattle(), [["#9fb4d8", "#6e6a80"], ["#5b6a80", "#2e2a3d"], ["#7fe7ff", "#ffd88a"], ["#0d1219", "#14101f"]]); }
export function acolyteBattle(): HTMLCanvasElement { return tintSprite(impBattle(), [["#7fb2ff", "#a03a2e"], ["#4a6bb5", "#6b1f1f"], ["#cfe0ff", "#ffd88a"], ["#ff5f6e", "#ff8a3c"]]); }
export function gsentBattle(): HTMLCanvasElement { return tintSprite(sentinelBattle(), [["#8a8fa0", "#7d8494"], ["#7fe7ff", "#ffd88a"], ["#4f8b46", "#57402c"]]); }

export function pillarSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    "..PPPPPPPP..",
    ".PpPPPPPPpP.",
    ".PpPpPPpPpP.",
    ".PpPPPPPPpP.",
    ".PpPPPPPPpP.",
    ".PpPPPPPPpP.",
    ".PpPPPPPPpP.",
    ".PpPPPPPPpP.",
    ".PPPPPPPPPP.",
    "PPpPPPPpPPpP",
    "PPPPPPPPPPPP",
    "bbbbbbbbbbbb",
  ]), { P: "#b9c2c9", p: "#8a949c", b: "#5c6670" });
}
export function hutSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    "....RRRRRRRRRR....",
    "...RrRRRRRRRRrR...",
    "..RRRRRRRRRRRRRR..",
    ".RRRRRRRRRRRRRRRR.",
    "RRRRRRRRRRRRRRRRRR",
    "wwwwwwwwwwwwwwwwww",
    "wdDwDDwdDwDDwdDwdw",
    "wdDwDDwdDwDDwdDwdw",
    "wwwwwwwwwwwwwwwwww",
    "...pp....pp.......",
    "...pp....pp.......",
  ]), { R: "#8a5a3a", r: "#b87a4e", w: "#57402c", D: "#33261a", d: "#6e5138", p: "#42301f" });
}
export function crystalSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    ".....cc.....",
    "....cCCCc...",
    "...cCCCCCc..",
    "...cCfCCCc..",
    "..cCCCCCCCc.",
    "..cCCCfCCCC.",
    ".cCCCCCCCCC.",
    ".cCCCCCCCCc.",
    "ccCCCCCCCcc.",
  ]), { c: "#3f4670", C: "#7fe7ff", f: "#ffffff" });
}
export function columnSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    ".kkkkkkkk.",
    ".kKKKKKKk.",
    ".kKkKKkKk.",
    ".kKKKKKKk.",
    ".kKkKKKKk.",
    ".kKKKKkKk.",
    ".kKkKKKKk.",
    ".kKKKkKKk.",
    ".kKKKKKKk.",
    "kkkkkkkkkk",
  ]), { k: "#33261a", K: "#c9a86a" });
}
export function brazierSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    "....f.....",
    "...fFf....",
    "...fFFf...",
    "....f.....",
    "...BBB....",
    "..BBBBB...",
    "...BbB....",
    "...BbB....",
    "..BBbBB...",
  ]), { f: "#7fe7ff", F: "#ffffff", B: "#4a4f5e", b: "#2c303a" });
}
export function throneSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    "..GGGGGGGG..",
    ".GgGGGGGGgG.",
    ".GgGGGGGGgG.",
    ".GGGGGGGGGG.",
    ".GGgGGGGgGG.",
    ".GGGGGGGGGG.",
    ".GrGGGGGGrG.",
    ".GGGGGGGGGG.",
    "GGgGGGGGGgGG",
    "GGGGGGGGGGGG",
    "gggggggggggg",
  ]), { G: "#c9a86a", g: "#8a6f3a", r: "#7a2540" });
}
export function bonesSprite(): HTMLCanvasElement {
  return buildSprite([
    "..W..W..",
    "WWW.WWW.",
    ".WWWWW..",
    "..W..W..",
    "WWW.WWW.",
  ], { W: "#cfd6e0" });
}
export function archSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    ".AAAAAAAAA.",
    "AaaaaaaaaaA",
    "Aa.......aA",
    "Aa..DDDD..A",
    "Aa.DDDDDD.A",
    "Aa.DD..DD.A",
    "Aa.D....D.A",
    "Aa.D....D.A",
    "Aa.......aA",
    "AaaaaaaaaaA",
    "AAAAAAAAAAA",
  ]), { A: "#6e7784", a: "#3f4657", D: "#1a1e28" });
}
export function shrineSprite(): HTMLCanvasElement {
  return buildSprite(pad16([
    "....SS....",
    "...SSSS...",
    "..SSmSS...",
    "..SGGSS...",
    "..SSSSS...",
    ".SSSSSSS..",
    "SSSSSSSSSS",
    "SSSSSSSSSS",
    "mmmSSSmmm.",
  ]), { S: "#8a949c", m: "#5c6670", G: "#7fe7ff" });
}

export function gpineSprite(): HTMLCanvasElement {
  return tintSprite(pineTree(), [["#2c4a3a", "#3f7a3a"], ["#1d4428", "#275c2c"], ["#dfe8f4", "#9fd88a"], ["#f4f8ff", "#c4e8a2"]]);
}
export function boatSprite(): HTMLCanvasElement {
  return buildSprite([
    ".wwwwwwwwww.",
    "ww........ww",
    "w.dddddddd.w",
    ".ww......ww.",
    "..wwwwww...",
  ], { w: "#57402c", d: "#8a6647" });
}
export function poolTile(): HTMLCanvasElement {
  return tintSprite(iceTile(), [["#b9d8f4", "#2f6ba8"], ["#ffffff", "#7fb2e8"], ["#8fb4d8", "#1d4a7a"], ["#dfe8f4", "#4b87c4"]]);
}
export function slabTile(): HTMLCanvasElement {
  return tintSprite(iceTile(), [["#b9d8f4", "#6e7784"], ["#ffffff", "#98a3b2"], ["#8fb4d8", "#4a4f5e"], ["#dfe8f4", "#5f6873"]]);
}
export function lavaTile(): HTMLCanvasElement {
  return buildSprite([
    "ooLOLooLooLo",
    "oLOooLoLooLo",
    "LoLoOoLoLoOL",
    "ooLoLoLooLoo",
    "oLooOLooLoLo",
    "LoOoLoLooLoO",
    "ooLoOLooLooL",
    "oLooLoLooLoL",
  ], { o: "#b3341a", L: "#f0782e", O: "#ffd88a" });
}

export const PROP_KEYS = ["inn","house","pine","dead","obelisk","gateClosed","gateOpen","stall","stall2","sign","bridge","bridgeRail","ice","portal","ash","soul","cursor","heart","star","potion","key","rabbit","hound","pillar","hut","crystal","column","brazier","throne","bones","arch","shrine","lantern","gpine","boat","pool","slab","lava","altar"];

export function getProp(key: string): HTMLCanvasElement {
  if (typeof document === "undefined") return document as never;
  if (!cache) {
    cache = {
      inn: innSprite(),
      house: houseSprite(),
      pine: outlineSprite(pineTree(), "#0d1219"),
      dead: outlineSprite(deadTree(), "#0d1219"),
      obelisk: obeliskSprite(),
      gateClosed: gateClosed(),
      gateOpen: gateOpen(),
      stall: stallSprite("#c05050"),
      stall2: stallSprite("#5078a0"),
      sign: signSprite(),
      bridge: bridgeTile(),
      bridgeRail: bridgeRail(),
      ice: iceTile(),
      portal: gatePortal(),
      ash: ashPile(),
      soul: soulSprite(),
      cursor: arrowCursor(),
      heart: heartIcon(),
      star: starIcon(),
      potion: potionIcon(),
      key: keyIcon(),
      rabbit: outlineSprite(rabbitOw(), "#0d1219"),
      hound: outlineSprite(houndOw(), "#0d1219"),
      pillar: outlineSprite(pillarSprite(), "#0d1219"),
      hut: outlineSprite(hutSprite(), "#0d1219"),
      crystal: crystalSprite(),
      column: outlineSprite(columnSprite(), "#0d1219"),
      brazier: brazierSprite(),
      throne: outlineSprite(throneSprite(), "#0d1219"),
      bones: bonesSprite(),
      arch: outlineSprite(archSprite(), "#0d1219"),
      shrine: outlineSprite(shrineSprite(), "#0d1219"),
      lantern: obeliskSprite(),
      gpine: outlineSprite(gpineSprite(), "#0d1219"),
      boat: outlineSprite(boatSprite(), "#0d1219"),
      pool: poolTile(),
      slab: slabTile(),
      lava: lavaTile(),
      altar: stallSprite("#5a3a6e"),
    };
  }
  return cache[key];
}

export function ashTint(c: HTMLCanvasElement): HTMLCanvasElement {
  return tintSprite(c, [["#dfe8f4", "#57535a"], ["#f4f8ff", "#6a666e"], ["#b9c9de", "#48444c"], ["#2c4a3a", "#332f36"]]);
}

/** id → battle sprite, used by the view's cache. */
export function getBattleSprite(id: string): HTMLCanvasElement {
  const M: Record<string, () => HTMLCanvasElement> = {
    hare: hareBattle, hound: houndBattle, imp: impBattle, wight: wightBattle,
    kesh: keshBattle, architect: architectBattle, sentry: sentryBattle,
    crawler: crawlerBattle, rhound: rhoundBattle, stalker: stalkerBattle,
    lurker: lurkerBattle, dsentry: dsentryBattle, reed: reedBattle,
    bat: batBattle, golem: golemBattle, revenant: wightBattle,
    gsent: gsentBattle, hknife: hknifeBattle, acolyte: acolyteBattle,
    hobgoblin: hobgoblinBattle, sentinel: sentinelBattle, irontusk: irontuskBattle,
    alpha: alphaBattle, warden: wardenBattle,
  };
  return (M[id] ?? impBattle)();
}
