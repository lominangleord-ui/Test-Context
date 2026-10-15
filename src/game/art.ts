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
    };
  }
  return cache[key];
}

export function ashTint(c: HTMLCanvasElement): HTMLCanvasElement {
  return tintSprite(c, [["#dfe8f4", "#57535a"], ["#f4f8ff", "#6a666e"], ["#b9c9de", "#48444c"], ["#2c4a3a", "#332f36"]]);
}
