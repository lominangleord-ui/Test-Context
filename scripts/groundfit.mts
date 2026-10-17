// groundfit — V3 art-to-collision drafter (v2: art-authored layout).
// Reads public/art/floors/<id>/ground.png, classifies walkable/solid/water/hazard
// from what is actually painted, applies authored overrides + authored entity
// positions read off the art, snaps anything off-ground to the nearest reachable
// walkable cell, and writes collision.png + objects.json into the floor dir.
// The art itself is never touched. Run: npx tsx scripts/groundfit.mts [floorIds...]
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

const AW = 1920, AH = 1080;
const CW = 480, CH = 270;              // mask grid: 1 cell = 4 units = 8 art px
type Cell = number; // 0 walk, 1 solid, 2 water, 3 hazard, 4 exit
type ColorFn = (r: number, g: number, b: number, luma: number) => boolean;

type FloorCfg = {
  walkMin: number;
  water?: ColorFn;
  hazard?: ColorFn;
  solidColor?: ColorFn;
  roads?: number[][][]; roadW?: number;
  walkRects: number[][]; solidRects: number[][]; walkDiscs: number[][]; solidDiscs: number[][];
  exitRects: number[][];
  spawn: [number, number];
  rest: [number, number][];
  boss?: { id: string; name: string; level: number; x: number; y: number };
  npcs: { id: string; x: number; y: number }[];
  signs: { text: string; x: number; y: number }[];
  props: { sprite: string; interactId?: string; prompt?: string; x: number; y: number; w?: number; h?: number; solid?: "rect" | "ellipse"; unlockedBy?: string }[];
  exits: { to: string; label: string; x: number; y: number; w: number; h: number; requires?: string }[];
  zones: { id: string; x: number; y: number; w: number; h: number }[];
};

// ---- authored from the painted art (positions are ground.png px = world units) ----
const CFG: Record<string, FloorCfg> = {
  verdant: {
    walkMin: 88,
    roads: [
      [[700, 8], [706, 120], [740, 230], [800, 300]],
      [[480, 250], [470, 360], [480, 440], [600, 470], [780, 468], [860, 420], [872, 330], [1000, 322], [1150, 340], [1170, 250], [1230, 200]],
      [[1150, 340], [1330, 380], [1470, 430], [1620, 470], [1780, 500], [1910, 520]],
      [[872, 330], [880, 470], [890, 590], [910, 700], [930, 860], [935, 1000]],
      [[910, 700], [1080, 700], [1240, 690], [1360, 640]],
      [[480, 250], [600, 240], [700, 232]],
      [[470, 360], [340, 350], [230, 330], [120, 330]],
      [[660, 470], [668, 380]],
    ],
    roadW: 34,
    walkRects: [[600, 0, 250, 170], [1210, 130, 180, 130], [620, 700, 700, 380], [400, 180, 280, 120], [540, 90, 160, 90]],
    solidRects: [[592, 112, 224, 96], [652, 230, 176, 96], [512, 540, 104, 72], [676, 518, 124, 76], [1228, 636, 300, 236], [1390, 236, 196, 150], [96, 414, 250, 170]],
    walkDiscs: [[1300, 190, 74], [668, 378, 66], [942, 330, 44], [700, 260, 40], [545, 255, 40], [1380, 420, 40]],
    solidDiscs: [[1408, 308, 52], [1488, 424, 60]],
    exitRects: [[642, 0, 150, 66]],
    spawn: [900, 880],
    rest: [[942, 726]],
    boss: { id: "hobgoblin", name: "BLOOD-RED HOBGOBLIN", level: 5, x: 1300, y: 150 },
    npcs: [{ id: "seo", x: 692, y: 408 }, { id: "hana", x: 560, y: 458 }, { id: "jino", x: 606, y: 498 }, { id: "roan", x: 1024, y: 332 }],
    signs: [{ text: "sign.v.gate", x: 860, y: 150 }, { text: "sign.v.pond", x: 1382, y: 424 }, { text: "sign.v.shrine", x: 1288, y: 292 }, { text: "sign.v.road", x: 540, y: 258 }, { text: "sign.v.camp", x: 828, y: 728 }],
    props: [{ sprite: "shrine", interactId: "plaza.shrine", prompt: "READ", x: 668, y: 348, w: 90, h: 60 }],
    exits: [{ to: "marsh", label: "SUNKEN MARSH", x: 648, y: 0, w: 140, h: 62 }],
    zones: [{ id: "thicket", x: 200, y: 330, w: 240, h: 170 }, { id: "garden", x: 1230, y: 130, w: 200, h: 150 }],
  },
  marsh: {
    walkMin: 100,
    water: (r, g, b, luma) => b > r + 4 && b >= g - 4 && luma < 178,
    solidColor: (r, g, b) => r > 88 && g > r - 16 && g < r + 64 && b < r - 30, // reed khaki
    roads: [
      [[8, 530], [120, 520], [260, 508], [430, 500], [560, 480], [660, 462], [730, 458], [840, 470], [910, 490], [1010, 505], [1130, 505], [1230, 498], [1330, 500], [1470, 478], [1560, 470], [1660, 492], [1760, 486], [1880, 470], [1919, 466]],
      [[730, 458], [760, 560], [800, 660], [870, 760], [990, 810], [1130, 790], [1210, 700], [1215, 600], [1212, 512]],
      [[910, 490], [925, 420], [935, 340], [942, 280]],
      [[990, 810], [970, 900], [955, 1000], [952, 1079]],
      [[1212, 512], [1300, 520], [1330, 560], [1345, 600]],
    ],
    roadW: 26,
    walkRects: [[640, 430, 260, 90], [1740, 440, 180, 140], [900, 640, 240, 200], [420, 460, 320, 90], [1150, 440, 260, 160]],
    solidRects: [],
    walkDiscs: [[556, 470, 36], [942, 210, 66], [242, 500, 60], [1218, 508, 110], [722, 458, 40], [1120, 545, 40]],
    solidDiscs: [],
    exitRects: [[924, 1014, 140, 66]],
    spawn: [722, 458],
    rest: [[1228, 512]],
    boss: { id: "sentinel", name: "STONE SENTINEL", level: 12, x: 942, y: 140 },
    npcs: [{ id: "sila", x: 1302, y: 470 }, { id: "seo", x: 1148, y: 428 }, { id: "reed", x: 556, y: 470 }],
    signs: [{ text: "sign.m.arrive", x: 762, y: 424 }, { text: "sign.m.village", x: 1330, y: 604 }, { text: "sign.m.posters", x: 902, y: 508 }, { text: "sign.m.stairs", x: 998, y: 300 }],
    props: [{ sprite: "hut", interactId: "shop.sila", prompt: "TRADE", x: 1116, y: 560, w: 60, h: 48, solid: "rect" }, { sprite: "boat", x: 190, y: 470, w: 45, h: 30 }, { sprite: "boat", x: 205, y: 610, w: 45, h: 30 }],
    exits: [{ to: "caverns", label: "ASHEN CAVERNS", x: 930, y: 1018, w: 130, h: 60 }],
    zones: [{ id: "reedflats", x: 440, y: 470, w: 230, h: 76 }, { id: "deepbog", x: 770, y: 830, w: 280, h: 86 }],
  },
  caverns: {
    walkMin: 106,
    roads: [
      [[196, 96], [260, 140], [330, 190], [430, 226], [560, 236], [700, 210], [860, 190], [990, 230], [1060, 300], [980, 330], [880, 330]],
      [[880, 330], [800, 410], [730, 500], [670, 620], [680, 750], [770, 850], [900, 910], [1040, 940], [1150, 990]],
      [[1040, 940], [1180, 940], [1310, 930], [1420, 900], [1450, 860]],
      [[1060, 300], [1200, 280], [1330, 240], [1450, 170], [1520, 200], [1560, 320], [1580, 440], [1540, 560], [1520, 680], [1580, 790], [1640, 860], [1700, 900]],
      [[1560, 320], [1440, 360], [1310, 420], [1160, 470], [1010, 500], [880, 560]],
      [[1450, 170], [1500, 100], [1560, 60]],
    ],
    roadW: 30,
    water: (r, g, b, luma) => luma < 54,
    hazard: (r, g, b) => r > 175 && g > 60 && g < 190 && b < 95,
    walkRects: [[890, 0, 200, 150], [540, 300, 200, 140], [700, 600, 150, 200], [1060, 770, 320, 240], [380, 900, 380, 140], [1450, 90, 220, 150], [980, 420, 360, 120], [1660, 560, 180, 300]],
    solidRects: [[295, 255, 90, 70], [1000, 292, 44, 56], [912, 452, 52, 44]],
    walkDiscs: [[238, 232, 80], [600, 190, 52], [160, 480, 46], [1520, 500, 60], [1700, 240, 46], [1150, 1000, 50]],
    solidDiscs: [[180, 205, 30], [300, 165, 26]],
    exitRects: [[1120, 1014, 150, 66], [905, 0, 150, 56]],
    spawn: [196, 110],
    rest: [[196, 152]],
    boss: { id: "irontusk", name: "IRON TUSK", level: 20, x: 1444, y: 900 },
    npcs: [{ id: "kang", x: 916, y: 322 }, { id: "verity", x: 452, y: 392 }, { id: "ember", x: 732, y: 244 }, { id: "seo", x: 232, y: 142 }],
    signs: [{ text: "sign.c.rails", x: 862, y: 182 }, { text: "sign.c.lava", x: 520, y: 604 }, { text: "sign.c.tusk", x: 1330, y: 942 }, { text: "sign.c.cult", x: 462, y: 424 }],
    props: [{ sprite: "bones", interactId: "den", prompt: "ENTER THE DEN", x: 240, y: 256, w: 45, h: 30 }],
    exits: [{ to: "citadel", label: "MONARCH'S CITADEL", x: 1128, y: 1016, w: 136, h: 62 }],
    zones: [{ id: "galleries", x: 620, y: 110, w: 400, h: 160 }, { id: "shafts", x: 980, y: 430, w: 300, h: 100 }],
  },
  citadel: {
    walkMin: 88,
    roads: [
      [[960, 90], [960, 240], [960, 420], [960, 530], [960, 700], [960, 830], [960, 940], [960, 1040]],
      [[8, 530], [140, 530], [400, 525], [700, 528], [960, 530], [1220, 528], [1520, 525], [1780, 530], [1919, 530]],
      [[740, 250], [738, 420], [735, 600], [740, 760]],
      [[1180, 250], [1182, 420], [1185, 600], [1180, 760]],
      [[870, 900], [960, 970], [1050, 900]],
    ],
    roadW: 42,
    water: (r, g, b, luma) => g > r + 8 && luma < 116 && b < g + 40 && g > 52, // the four green marble pools
    walkRects: [[0, 470, 180, 120], [1740, 470, 180, 120], [850, 810, 220, 210]],
    solidRects: [[426, 88, 132, 246], [1338, 88, 132, 246], [426, 614, 132, 310], [1338, 614, 132, 310], [926, 58, 68, 30]],
    walkDiscs: [[960, 168, 84], [960, 512, 70], [960, 880, 80], [700, 300, 46], [1120, 340, 46], [770, 470, 40], [1150, 470, 40], [150, 540, 40], [1700, 540, 40]],
    solidDiscs: [
      [648, 238, 17], [836, 238, 17], [648, 415, 17], [836, 415, 17], [648, 590, 17], [836, 590, 17], [648, 765, 17], [836, 765, 17],
      [1084, 238, 17], [1272, 238, 17], [1084, 415, 17], [1272, 415, 17], [1084, 590, 17], [1272, 590, 17], [1084, 765, 17], [1272, 765, 17],
      [460, 218, 16], [460, 396, 16], [1460, 218, 16], [1460, 396, 16], [460, 745, 16], [1460, 745, 16],
    ],
    exitRects: [[0, 480, 86, 100]],
    spawn: [945, 902],
    rest: [[947, 802]],
    boss: { id: "warden", name: "THE GATE WARDEN", level: 38, x: 948, y: 120 },
    npcs: [{ id: "herald", x: 1120, y: 340 }, { id: "ivy", x: 770, y: 470 }, { id: "seo", x: 1150, y: 470 }],
    signs: [{ text: "sign.t.enter", x: 880, y: 936 }, { text: "sign.t.crack", x: 1700, y: 545 }, { text: "sign.t.throne", x: 838, y: 122 }, { text: "sign.t.door", x: 150, y: 542 }],
    props: [{ sprite: "arch", interactId: "bossGate", prompt: "KNEEL OR FIGHT", x: 960, y: 214, w: 60, h: 34 }],
    exits: [{ to: "ashenveil", label: "THE UNREGISTERED DOOR", x: 6, y: 486, w: 100, h: 92, requires: "unregistered" }],
    zones: [{ id: "hall", x: 600, y: 300, w: 720, h: 420 }],
  },
  ashenveil: {
    walkMin: 108,
    roads: [
      [[952, 1079], [952, 980], [950, 880], [952, 760], [958, 640], [960, 560], [960, 470], [955, 380], [930, 300], [900, 240], [872, 200]],
      [[470, 522], [620, 528], [790, 534], [960, 540], [1120, 540], [1260, 530], [1370, 522]],
      [[470, 522], [330, 528], [180, 530], [8, 538]],
      [[1370, 522], [1480, 460], [1560, 380], [1610, 280], [1640, 200], [1650, 160]],
      [[620, 528], [640, 640], [680, 760], [720, 850], [860, 870], [1040, 872], [1200, 866], [1330, 820], [1370, 700], [1370, 560]],
      [[1650, 160], [1520, 140], [1400, 150], [1310, 170]],
      [[720, 850], [560, 830], [430, 780], [360, 700], [340, 620]],
    ],
    roadW: 30,
    water: (r, g, b, luma) => luma < 80,
    walkRects: [[872, 900, 152, 180], [840, 250, 250, 120], [1100, 610, 440, 110], [150, 480, 280, 90], [1712, 430, 130, 280], [1300, 90, 380, 120], [600, 830, 740, 90], [640, 540, 320, 90], [980, 380, 120, 160]],
    solidRects: [[536, 902, 342, 178], [996, 872, 432, 208], [140, 106, 490, 336], [1052, 246, 268, 336], [330, 596, 388, 268], [1500, 696, 268, 224], [1330, 240, 96, 420]],
    walkDiscs: [[960, 168, 92], [470, 522, 92], [960, 520, 84], [1370, 522, 92], [1000, 634, 44], [1650, 160, 74], [240, 540, 52], [868, 856, 40]],
    solidDiscs: [],
    exitRects: [[0, 496, 92, 84]],
    spawn: [952, 978],
    rest: [[470, 522]],
    npcs: [{ id: "miso", x: 862, y: 856 }, { id: "baek", x: 700, y: 862 }, { id: "kid", x: 1010, y: 856 }, { id: "prof", x: 1122, y: 856 }, { id: "skater", x: 1242, y: 856 }, { id: "hermit", x: 872, y: 222 }, { id: "dog", x: 1120, y: 878 }],
    signs: [{ text: "sign.entry", x: 936, y: 1016 }, { text: "sign.plaza", x: 905, y: 528 }, { text: "sign.crater", x: 1012, y: 560 }, { text: "sign.gate", x: 1584, y: 214 }, { text: "sign.river", x: 330, y: 542 }, { text: "sign.bench", x: 895, y: 562 }, { text: "sign.pond", x: 1700, y: 702 }, { text: "sign.ridge", x: 1520, y: 122 }],
    props: [
      { sprite: "obelisk", interactId: "save", prompt: "SAVE", x: 1000, y: 640, w: 24, h: 38, solid: "rect" },
      { sprite: "gate", interactId: "gate", prompt: "OPEN", x: 1630, y: 168, w: 90, h: 56, solid: "rect", unlockedBy: "gateOpen" },
      { sprite: "portal", interactId: "bossGate", prompt: "ENTER", x: 1370, y: 488, w: 60, h: 48 },
      { sprite: "stall", interactId: "shop.miso", prompt: "TRADE", x: 858, y: 894, w: 45, h: 30 },
    ],
    exits: [{ to: "citadel", label: "RETURN TO THE CITADEL", x: 0, y: 500, w: 84, h: 80 }],
    zones: [{ id: "pines", x: 1120, y: 620, w: 380, h: 92 }, { id: "ridge", x: 700, y: 300, w: 320, h: 100 }],
  },
};

const cellW = AW / CW, cellH = AH / CH;
const cellOf = (x: number, y: number): [number, number] => [Math.floor(x / cellW), Math.floor(y / cellH)];

async function run(id: string) {
  const cfg = CFG[id];
  if (!cfg) { console.log("no config for", id); return; }
  const img = await loadImage(`public/art/floors/${id}/ground.png`);
  const c = createCanvas(img.width, img.height);
  const g = c.getContext("2d");
  g.drawImage(img as never, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;

  const cells = new Uint8Array(CW * CH);
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
    let r = 0, gg = 0, b = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const i = (((cy * 4) + y) * AW + ((cx * 4) + x)) * 4;
      r += d[i]; gg += d[i + 1]; b += d[i + 2];
    }
    r /= 16; gg /= 16; b /= 16;
    const luma = (r + gg + b) / 3;
    let v: Cell = luma >= cfg.walkMin ? 0 : 1;
    if (cfg.water?.(r, gg, b, luma)) v = 2;
    else if (cfg.solidColor?.(r, gg, b, luma)) v = 1;
    else if (v === 0 && cfg.hazard?.(r, gg, b, luma)) v = 3;
    cells[cy * CW + cx] = v;
  }

  const stampRect = (rect: number[], v: Cell) => {
    const [x0, y0] = cellOf(rect[0], rect[1]);
    const [x1, y1] = cellOf(rect[0] + rect[2], rect[1] + rect[3]);
    for (let cy = Math.max(0, y0); cy <= Math.min(CH - 1, y1); cy++) for (let cx = Math.max(0, x0); cx <= Math.min(CW - 1, x1); cx++) cells[cy * CW + cx] = v;
  };
  const stampDisc = (disc: number[], v: Cell) => {
    const [dx, dy, dr] = disc;
    const [cx0, cy0] = cellOf(dx - dr, dy - dr);
    const [cx1, cy1] = cellOf(dx + dr, dy + dr);
    for (let cy = Math.max(0, cy0); cy <= Math.min(CH - 1, cy1); cy++)
      for (let cx = Math.max(0, cx0); cx <= Math.min(CW - 1, cx1); cx++) {
        const px = (cx + 0.5) * cellW, py = (cy + 0.5) * cellH;
        if (Math.hypot(px - dx, py - dy) <= dr) cells[cy * CW + cx] = v;
      }
  };
  for (const rr of cfg.solidRects) stampRect(rr, 1);
  for (const rr of cfg.walkRects) stampRect(rr, 0);
  const rw = cfg.roadW ?? 28;
  for (const line of cfg.roads ?? []) for (let k = 0; k < line.length - 1; k++) {
    const [x0, y0] = line[k], [x1, y1] = line[k + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let t = 0; t <= len; t += rw * 0.55) stampDisc([x0 + ((x1 - x0) * t) / len, y0 + ((y1 - y0) * t) / len, rw], 0);
    stampDisc([x1, y1, rw], 0);
  }
  for (const dd of cfg.solidDiscs) stampDisc(dd, 1);
  for (const dd of cfg.walkDiscs) stampDisc(dd, 0);

  const pass = (from: Cell, to: Cell, min: number) => {
    const out = new Uint8Array(cells);
    for (let cy = 1; cy < CH - 1; cy++) for (let cx = 1; cx < CW - 1; cx++) {
      const i = cy * CW + cx;
      if (cells[i] !== from) continue;
      let n = 0;
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (!(x === 0 && y === 0) && cells[(cy + y) * CW + cx + x] === from) n++;
      if (n < min) out[i] = to;
    }
    cells.set(out);
  };
  pass(1, 0, 2); pass(0, 1, 3); pass(2, 1, 3);

  { // lava lakes: wade-through only for narrow flows; wide molten fields are solid
    const out = new Uint8Array(cells);
    const seen = new Uint8Array(CW * CH);
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== 3 || seen[i]) continue;
      const stack = [i]; seen[i] = 1; const comp: number[] = [];
      while (stack.length) {
        const p = stack.pop()!; comp.push(p);
        const px = p % CW, py = (p / CW) | 0;
        for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]] as const)
          if (nx >= 0 && ny >= 0 && nx < CW && ny < CH && cells[ny * CW + nx] === 3 && !seen[ny * CW + nx]) { seen[ny * CW + nx] = 1; stack.push(ny * CW + nx); }
      }
      if (comp.length > 300) for (const p of comp) out[p] = 1;
    }
    cells.set(out);
  }

  const walk = (i: number) => cells[i] === 0 || cells[i] === 3 || cells[i] === 4;

  const dist = new Int32Array(CW * CH).fill(-1);
  const bfsFrom = (sx: number, sy: number) => {
    let [cx, cy] = cellOf(sx, sy);
    cx = Math.max(0, Math.min(CW - 1, cx)); cy = Math.max(0, Math.min(CH - 1, cy));
    let start = cy * CW + cx;
    if (!walk(start)) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < cells.length; i++) if (walk(i)) {
        const px = ((i % CW) + 0.5) * cellW, py = (((i / CW) | 0) + 0.5) * cellH;
        const dd = Math.hypot(px - sx, py - sy); if (dd < bd) { bd = dd; best = i; }
      }
      if (best < 0) return;
      start = best;
    }
    dist[start] = 0;
    const q = [start];
    while (q.length) {
      const p = q.shift()!;
      const px = p % CW, py = (p / CW) | 0;
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]] as const)
        if (nx >= 0 && ny >= 0 && nx < CW && ny < CH && walk(ny * CW + nx) && dist[ny * CW + nx] < 0) { dist[ny * CW + nx] = dist[p] + 1; q.push(ny * CW + nx); }
    }
  };
  const notes: string[] = [];
  const { makeFloor } = await import(`../src/game/floor.ts`);
  const legacy = makeFloor(id).objects; // old data supplies only non-positional fields (facing, sprites, hides, enemies)

  // carve standing pockets for every authored entity BEFORE connectivity, so a
  // slightly-off art reading never strands someone on their own island
  const carve = (x: number, y: number, r: number) => {
    const [cx, cy] = cellOf(x, y);
    const rc = Math.ceil(r / cellW);
    for (let yy = -rc; yy <= rc; yy++) for (let xx = -rc; xx <= rc; xx++) {
      const nx = cx + xx, ny = cy + yy;
      if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
      if (Math.hypot(xx, yy) <= rc - 0.5 && cells[ny * CW + nx] !== 4) cells[ny * CW + nx] = 0;
    }
  };
  for (const n of cfg.npcs) carve(n.x, n.y, 12);
  for (const s of cfg.signs) carve(s.x, s.y, 10);
  for (const p of cfg.props) carve(p.x, p.y + (p.h ?? 30) / 2, 16);
  for (const rr of cfg.rest) carve(rr[0], rr[1], 26);
  if (cfg.boss) carve(cfg.boss.x, cfg.boss.y + 20, 40);
  for (const e of cfg.exits) carve(e.x + e.w / 2, e.y + e.h / 2, 26);
  carve(cfg.spawn[0], cfg.spawn[1], 18);

  for (const rr of cfg.exitRects) stampRect(rr, 4);
  bfsFrom(cfg.spawn[0], cfg.spawn[1]);
  for (let i = 0; i < cells.length; i++) if (walk(i) && dist[i] < 0) cells[i] = 1; // sealed pockets → solid

  const snap = (x: number, y: number, what: string, tag?: string): [number, number] => {
    const [c0, r0] = cellOf(x, y);
    const i0 = Math.max(0, Math.min(CH - 1, r0)) * CW + Math.max(0, Math.min(CW - 1, c0));
    if (walk(i0) && dist[i0] >= 0) return [x, y];
    let best = -1, bd = 1e9;
    for (let i = 0; i < cells.length; i++) {
      if (dist[i] < 0) continue;
      const px = ((i % CW) + 0.5) * cellW, py = (((i / CW) | 0) + 0.5) * cellH;
      const dd = Math.hypot(px - x, py - y);
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best < 0) { notes.push(`UNPLACED ${what} ${tag ?? ""}`); return [x, y]; }
    const px = Math.round(((best % CW) + 0.5) * cellW), py = Math.round((((best / CW) | 0) + 0.5) * cellH);
    notes.push(`nudged ${what} ${tag ?? ""}: (${Math.round(x)},${Math.round(y)}) → (${px},${py}) ${Math.round(bd)}px`);
    return [px, py];
  };

  const [sx, sy] = snap(cfg.spawn[0], cfg.spawn[1], "spawn");
  const npcMeta = new Map(legacy.npcs.map((n) => [n.id, n]));
  const npcs = cfg.npcs.map((n) => {
    const [x, y] = snap(n.x, n.y, "npc", n.id);
    const old = npcMeta.get(n.id);
    return { id: n.id, x, y, sprite: old?.sprite ?? n.id, facing: old?.facing ?? "down", dialogue: old?.dialogue ?? `${n.id}.${id}`, ...(old?.hideAfter ? { hideAfter: old.hideAfter } : {}) };
  });
  const signs = cfg.signs.map((s, i) => {
    const [x, y] = snap(s.x, s.y, "sign", s.text ?? String(i));
    return { x, y, text: s.text };
  });
  const propMeta = new Map(legacy.props.filter((p) => p.interactId).map((p) => [p.interactId, p]));
  const props = cfg.props.map((p) => {
    const [x, y] = snap(p.x, p.y + (p.h ?? 30) / 2, "prop", p.interactId ?? p.sprite);
    const w = p.w ?? 45, h = p.h ?? 30;
    const m = propMeta.get(p.interactId ?? "");
    return { x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h, sprite: p.sprite, ...(p.interactId ? { interactId: p.interactId, prompt: p.prompt ?? "USE" } : {}), ...(p.solid ? { solid: p.solid } : {}), ...(p.unlockedBy ? { unlockedBy: p.unlockedBy } : {}), ...(m?.unlockedBy && !p.unlockedBy ? { unlockedBy: m.unlockedBy } : {}) };
  });
  const rests = cfg.rest.map(([rx, ry]) => {
    const [x, y] = snap(rx, ry, "rest");
    return { x: Math.round(x - 52), y: Math.round(y - 38), w: 104, h: 76 };
  });
  let boss: Record<string, number | string> | undefined;
  if (cfg.boss) {
    const [x, y] = snap(cfg.boss.x, cfg.boss.y, "boss", cfg.boss.id);
    boss = { id: cfg.boss.id, name: cfg.boss.name, level: cfg.boss.level, x: Math.round(x - 68), y: Math.round(y - 26), w: 136, h: 52 };
  }
  const exits = cfg.exits.map((e) => {
    const [x, y] = snap(e.x + e.w / 2, e.y + e.h / 2, "exit", e.to);
    return { x: Math.round(x - e.w / 2), y: Math.round(y - e.h / 2), w: e.w, h: e.h, to: e.to, label: e.label, ...(e.requires ? { requires: e.requires } : {}) };
  });
  const zoneEnemies = new Map(legacy.zones.map((z) => [z.id, z.enemies]));
  const zones = cfg.zones.flatMap((z) => {
    const [ax, ay] = cellOf(z.x, z.y); const [bx, by] = cellOf(z.x + z.w, z.y + z.h);
    let tot = 0, ok = 0;
    for (let cy = Math.max(0, ay); cy <= Math.min(CH - 1, by); cy++) for (let cx = Math.max(0, ax); cx <= Math.min(CW - 1, bx); cx++) { tot++; const i = cy * CW + cx; if (dist[i] >= 0 && cells[i] !== 1 && cells[i] !== 2) ok++; }
    if (tot && ok / tot >= 0.15) return [{ id: z.id, x: z.x, y: z.y, w: z.w, h: z.h, enemies: zoneEnemies.get(z.id) ?? legacy.zones[0]?.enemies ?? [] }];
    notes.push(`zone ${z.id}: weak spot (open coverage ${Math.round((ok / Math.max(1, tot)) * 100)}%) — keeping anyway; verify spawns`);
    return [{ id: z.id, x: z.x, y: z.y, w: z.w, h: z.h, enemies: zoneEnemies.get(z.id) ?? legacy.zones[0]?.enemies ?? [] }];
  });

  const COL: Record<number, [number, number, number]> = { 0: [255, 255, 255], 1: [0, 0, 0], 2: [30, 70, 220], 3: [228, 48, 48], 4: [46, 204, 92] };
  const cc = createCanvas(CW, CH);
  const cg = cc.getContext("2d");
  const im = cg.createImageData(CW, CH);
  for (let i = 0; i < cells.length; i++) {
    const [r, gg, b] = COL[cells[i]];
    im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255;
  }
  cg.putImageData(im, 0, 0);
  writeFileSync(`public/art/floors/${id}/collision.png`, cc.toBuffer("image/png"));
  const out = { chunks: [2, 2], spawn: [Math.round(sx), Math.round(sy)], npcs, signs, props, exits, rests, zones, ...(boss ? { boss } : {}) };
  writeFileSync(`public/art/floors/${id}/objects.json`, JSON.stringify(out, null, 1) + "\n");
  let reach = 0;
  for (let i = 0; i < cells.length; i++) if (dist[i] >= 0) reach++;
  console.log(`groundfit ${id}: collision + objects written — reachable cells ${reach} (${Math.round((reach / cells.length) * 100)}% of map)`);
  for (const n of notes) console.log("  ·", n);
}

const args = process.argv.slice(2);
for (const id of args.length ? args : ["verdant", "marsh", "caverns", "citadel", "ashenveil"]) await run(id);
console.log("groundfit done");
