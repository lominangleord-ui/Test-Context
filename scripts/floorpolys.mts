// floorpolys — replaces the auto-classified collision masks with hand-traced
// obstacle polygons read off the gridshot images (world units, 1920×1080).
// Per floor: a base fill, then water/solid/hazard polygons, then OPEN carving
// (roads, plazas, pads), then entity standing pockets, exits, props, border ring.
// Run: npx tsx scripts/floors.mts  [floorIds...]
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, readFileSync } from "node:fs";

const CW = 480, CH = 270, CELL = 4;
type P = [number, number][];
type Spec = {
  base: 0 | 1 | 2;                       // WALK | SOLID | WATER
  water?: P[]; solid?: P[]; hazard?: P[];
  openRects?: number[][];                // [x,y,w,h] walkable after everything
  solidRects?: number[][]; waterRects?: number[][];
  roads?: { pts: number[][]; w: number }[];
  discsOpen?: number[][];                // [x,y,r]
  discsSolid?: number[][];               // [x,y,r]
};

const POLY = (s: string): P => s.trim().split(/\s+/).map((pair) => pair.split(",").map(Number) as [number, number]);

const SPECS: Record<string, Spec> = {
  verdant: {
    base: 0,
    waterRects: [[210, 665, 205, 225], [1405, 215, 125, 105]],           // W pond, N pond
    solid: [
      // sinkhole fields (cracked purple)
      POLY("825,655 850,600 920,578 1000,585 1065,620 1092,682 1075,750 1005,782 925,782 858,735"),
      // cafe building walls (gap at S door + E opening)
      POLY("328,362 558,362 558,380 328,380"), POLY("328,362 346,362 346,628 328,628"),
      POLY("540,362 558,362 558,452 540,452"), POLY("540,500 558,500 558,628 540,628"),
      POLY("328,610 462,610 462,628 328,628"), POLY("508,610 558,610 558,628 508,628"),
      // bus wrecks (four, roughly axis-aligned hulls)
      POLY("556,232 668,246 660,306 548,292"), POLY("628,290 736,308 728,364 620,346"),
      POLY("514,430 616,448 608,492 506,474"), POLY("600,452 700,466 692,512 592,498"),
      // shrine building + side cells (steps stay walkable)
      POLY("1268,120 1398,120 1398,232 1268,232"), POLY("1244,148 1268,148 1268,214 1244,214"), POLY("1398,148 1422,148 1422,214 1398,214"),
      // camp tents + cabin
      POLY("862,842 922,842 922,884 862,884"), POLY("896,900 956,900 956,944 896,944"),
      POLY("984,826 1038,826 1038,868 984,868"), POLY("1066,842 1126,842 1126,888 1066,888"),
      POLY("1012,918 1072,918 1072,960 1012,960"), POLY("944,936 1024,936 1024,990 944,990"),
      // garden debris: fallen columns + rubble chunks
      POLY("890,192 972,206 968,228 886,214"), POLY("1038,212 1104,218 1100,240 1034,234"),
      POLY("700,92 722,88 728,132 706,136"), POLY("770,100 792,96 798,140 776,144"),
    ],
    discsSolid: [[940, 104, 13], [992, 96, 13], [1038, 122, 13], [1058, 172, 13], [664, 350, 15], [918, 512, 14], [560, 560, 14], [452, 512, 16], [522, 470, 12]], // standing columns + big rubble
    openRects: [],
    roads: [
      { pts: [[700, 8], [706, 130], [748, 228]], w: 60 },
      { pts: [[478, 252], [470, 360], [482, 442], [602, 470], [700, 468]], w: 58 },
      { pts: [[872, 332], [1000, 322], [1152, 342], [1170, 252], [1232, 200]], w: 58 },
      { pts: [[1152, 342], [1332, 382], [1470, 432], [1620, 472], [1782, 502], [1912, 522]], w: 42 },
      { pts: [[872, 332], [880, 470], [890, 592], [912, 704], [932, 862], [938, 1010]], w: 42 },
      { pts: [[912, 704], [1080, 702], [1242, 692], [1362, 642]], w: 54 },
      { pts: [[470, 360], [340, 352], [232, 332], [120, 332]], w: 54 },
      { pts: [[932, 862], [1010, 900], [1064, 950], [1080, 1010]], w: 38 },
      { pts: [[330, 640], [300, 690]], w: 34 }, // pond-side spur (walk the shore, pond stays water)
    ],
  },
  marsh: {
    base: 0, // shallow bog wades; deep pools + reed beds block
    waterRects: [[592, 606, 84, 64], [1042, 635, 62, 46], [800, 620, 130, 90], [420, 550, 120, 60], [1420, 540, 150, 70], [150, 250, 110, 90], [1240, 340, 150, 100], [330, 660, 150, 110]],
    solidRects: [
      [285, 240, 140, 170], [940, 55, 180, 120], [1350, 180, 160, 120], [1450, 620, 160, 160], [150, 710, 130, 150], [470, 860, 140, 120], [760, 240, 120, 90], [1700, 240, 130, 160], [1130, 250, 120, 90],
    ], // reed beds (kept off every boardwalk)
    openRects: [
      [55, 432, 235, 172],   // dock platform
      [778, 398, 218, 226],  // camp island
      [610, 60, 160, 268],   // idol islet body
      [640, 300, 52, 90],    // islet stair foot
      [760, 900, 130, 180],  // S exit stub apron
    ],
    discsOpen: [[690, 190, 108], [690, 330, 40], [940, 606, 30], [556, 470, 26], [880, 470, 46]],
    roads: [
      { pts: [[8, 532], [120, 520], [262, 508], [432, 500], [562, 480], [662, 462], [732, 458]], w: 54 }, // W main
      { pts: [[732, 458], [842, 470], [912, 492], [1012, 506], [1132, 506], [1232, 500], [1332, 502], [1472, 480], [1562, 472], [1662, 494], [1762, 488], [1882, 472], [1919, 468]], w: 54 }, // E main
      { pts: [[732, 458], [762, 562], [802, 662], [872, 762], [992, 812]], w: 38 }, // S loop west leg
      { pts: [[992, 812], [1132, 792], [1212, 702], [1216, 602], [1214, 514]], w: 38 }, // S loop east leg
      { pts: [[912, 492], [928, 422], [938, 342], [944, 282], [930, 240], [760, 225]], w: 36 }, // to islet
      { pts: [[992, 812], [900, 890], [832, 962], [822, 1062]], w: 38 }, // S exit stub
      { pts: [[1214, 514], [1302, 522], [1332, 562], [1348, 604]], w: 34 }, // village spur
    ],
    solid: [
      POLY("150,320 210,318 214,398 154,400"), // boats on dock (3 small hulls below)
      POLY("108,382 168,388 164,432 104,426"), POLY("72,452 132,456 128,498 68,494"), POLY("122,552 186,558 182,606 118,600"),
      POLY("878,450 938,452 940,548 880,546"), // big tent
      POLY("752,430 782,430 782,456 752,456"), POLY("790,438 822,438 822,466 790,466"), POLY("812,448 838,448 838,472 812,472"), // crates
      POLY("754,458 776,458 776,480 754,480"),
    ],
  },
  caverns: {
    base: 1, // solid rock — carve the cavern
    discsOpen: [[228, 152, 150], [180, 432, 142], [660, 210, 142], [952, 322, 132], [1152, 262, 108], [302, 742, 150], [964, 724, 195], [1662, 560, 185], [1466, 902, 150], [1748, 242, 140], [966, 992, 112]],
    roads: [
      { pts: [[196, 96], [300, 150], [430, 210], [560, 236]], w: 74 },
      { pts: [[560, 236], [760, 200], [940, 172], [1120, 190], [1240, 230]], w: 78 },
      { pts: [[1240, 230], [1360, 252], [1452, 300], [1540, 232], [1660, 200], [1748, 210]], w: 62 },
      { pts: [[1540, 320], [1560, 440], [1530, 520], [1560, 620], [1610, 700]], w: 58 }, // E descent
      { pts: [[660, 210], [560, 330], [440, 420], [240, 460]], w: 66 },
      { pts: [[240, 460], [300, 560], [330, 660]], w: 64 },
      { pts: [[440, 420], [560, 470], [700, 480], [820, 520]], w: 70 },
      { pts: [[820, 520], [920, 560], [980, 640], [992, 700]], w: 70 },
      { pts: [[964, 724], [1120, 760], [1280, 800], [1400, 860]], w: 74 },
      { pts: [[1400, 860], [1466, 902], [1560, 860], [1620, 780]], w: 70 },
      { pts: [[1620, 700], [1700, 760], [1740, 850]], w: 60 },
      { pts: [[302, 742], [380, 830], [500, 880], [640, 900], [760, 900]], w: 66 },
      { pts: [[560, 470], [620, 420], [660, 360]], w: 54 },
      { pts: [[940, 172], [932, 60], [930, 8]], w: 70 }, // N exit
      { pts: [[1040, 896], [1090, 930], [1150, 985], [1195, 1040], [1205, 1076]], w: 52 }, // S descent to the citadel doorway (traced on the art)
      { pts: [[1660, 200], [1700, 90], [1690, 8]], w: 58 }, // NE arch spur
      { pts: [[180, 432], [120, 480], [60, 520]], w: 54 },
    ],
    water: [POLY("986,442 1062,438 1074,502 1000,512"), POLY("1104,236 1180,232 1196,292 1120,302")],
    hazard: [
      POLY("1318,8 1402,4 1382,112 1444,192 1488,258 1452,322 1400,336 1372,262 1336,178 1306,88"),
      POLY("1452,378 1530,404 1556,482 1604,556 1636,626 1598,666 1536,628 1494,548 1456,466 1442,404"),
      POLY("322,792 358,704 428,682 512,690 578,728 556,798 470,826 382,822"),
      POLY("258,660 320,640 372,652 352,690 284,700"), // bridge-crossing spur stays open via road carve
    ],
    solidRects: [[432, 240, 34, 34], [836, 128, 30, 30], [1560, 320, 26, 26]],
    discsSolid: [[640, 140, 16], [700, 300, 15], [868, 320, 16], [1004, 108, 14], [508, 540, 18], [556, 552, 14], [1210, 560, 20], [1264, 588, 15], [1700, 120, 16], [1760, 150, 14], [864, 800, 16], [920, 800, 16], [976, 800, 16], [1032, 800, 16], [1088, 800, 16], [1144, 800, 16], [840, 862, 16], [1168, 862, 16]], // stalagmites + notice board stanchions under the arch
  },
  citadel: {
    base: 1, // solid stone — carve the palace
    openRects: [
      [292, 42, 1336, 836],   // great hall
      [0, 428, 300, 104],     // W corridor
      [1620, 428, 300, 104],  // E corridor
      [700, 868, 520, 212],   // stair bowl
      [902, 292, 120, 120],
    ],
    discsOpen: [[960, 880, 150], [960, 300, 90], [640, 300, 110], [1280, 300, 110], [640, 760, 110], [1280, 760, 110]],
    waterRects: [[335, 80, 120, 245], [1468, 80, 118, 242], [440, 635, 140, 255], [1345, 635, 135, 255]], // four green pools (repainted AFTER solid walls so they survive the side-gallery blocks)
    solidRects: [
      [0, 100, 300, 322], [1620, 100, 300, 322],   // outer wall blocks
      [910, 46, 105, 34],                            // throne block (dais floor stays walkable)
      [0, 556, 452, 524], [1468, 556, 452, 524],    // lower side galleries (dark rooms)
      [0, 0, 700, 42], [1220, 0, 700, 42],           // top wall flanks
    ],
    solid: [
      POLY("585,868 1335,868 1335,900 585,900"),  // hall bottom wall band
      POLY("820,868 838,868 838,900 820,900"), POLY("1082,868 1100,868 1100,900 1082,900"), // wall returns flanking the stair gap — carve fixes below
    ],
    discsSolid: [ // colonnade (two rows per wing) + braziers
      [655, 277, 15], [780, 277, 15], [655, 472, 15], [780, 472, 15], [655, 675, 15], [780, 675, 15], [655, 855, 15], [780, 855, 15],
      [1140, 277, 15], [1265, 277, 15], [1140, 472, 15], [1265, 472, 15], [1140, 675, 15], [1265, 675, 15], [1140, 855, 15], [1265, 855, 15],
      [345, 277, 14], [1575, 277, 14], [543, 160, 12], [1210, 160, 12], [543, 828, 12], [1210, 828, 12],
    ],
  },
  ashenveil: {
    base: 0, // bank + pads open; the swirl-pits are the void
    water: [
      POLY("80,140 620,140 620,480 80,480"), POLY("80,600 620,600 620,950 80,950"),
      POLY("700,300 800,300 800,420 700,420"), POLY("700,640 800,640 800,760 700,760"),
      POLY("1130,300 1210,300 1210,440 1130,440"), POLY("1110,600 1210,600 1210,880 1110,880"),
      POLY("1500,470 1600,470 1600,880 1500,880"),
      POLY("455,300 520,300 520,470 455,470"), POLY("455,585 520,585 520,760 455,760"),
      POLY("800,300 858,300 858,470 800,470"), POLY("1140,300 1196,300 1196,470 1140,470"),
      POLY("800,640 858,640 858,760 800,760"), POLY("1140,600 1196,600 1196,760 1140,760"),
      POLY("120,560 200,560 200,600 120,600"),
    ],
    openRects: [
      [136, 356, 172, 344],  // W pad block
      [520, 356, 256, 344],  // M pad block
      [904, 356, 236, 344],  // E pad block — hmm pads measured below; keep rects generous, discs refine
      [412, 486, 112, 92],   // W-M corridor
      [772, 486, 136, 92],   // M-E corridor
      [0, 492, 140, 84],     // W exit corridor
      [636, 296, 64, 96],    // dais stair throat
      [648, 696, 64, 180],   // S street throat
      [1240, 560, 64, 120],  // E-pad down-link
      [560, 886, 800, 76],   // market street under the cabinets
    ],
    discsOpen: [
      [322, 528, 128], [648, 528, 132], [982, 528, 132],
      [534, 40, 168], // dais (walk the whole slab; statue solid below)
      [1108, 178, 120], [1240, 128, 110], // NE door-hall L: top run
      [1300, 250, 120], [1300, 420, 120], // and down-run
      [1360, 528, 120],
      [960, 984, 90], // spawn apron
    ],
    solidRects: [
      [580, 105, 105, 105], // kneeling statue plinth
      [586, 92, 260, 18],  // dais back wall
      [1200, 100, 400, 42], // door-hall wall with doors (doors stay as bumps) — carved discs reopen
      [440, 940, 310, 140], // SW cabinet block
      [1000, 925, 375, 155], // SE cabinet block
      [0, 60, 520, 90], [0, 150, 60, 200], // NW bank ledge decor
    ],
    waterRects: [],
    roads: [{ pts: [[1300, 500], [1360, 560], [1360, 640]], w: 44 }],
  },
};

function run(id: string) {
  const spec = SPECS[id];
  if (!spec) { console.log("no poly spec for", id); return; }
  const c = createCanvas(CW, CH); const g = c.getContext("2d");
  const cells = new Int8Array(CW * CH).fill(spec.base);
  const paintPoly = (poly: P, v: number) => {
    let y0 = 1e9, y1 = -1e9; for (const [, y] of poly) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (let wy = Math.floor(y0 / CELL); wy <= Math.ceil(y1 / CELL); wy++) {
      const xs: number[] = [];
      for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
        const cyw = wy * CELL + 2;
        if ((ay <= cyw && by > cyw) || (by <= cyw && ay > cyw)) xs.push(ax + ((cyw - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let cx = Math.max(0, Math.floor(xs[k] / CELL)); cx <= Math.min(CW - 1, Math.ceil(xs[k + 1] / CELL)); cx++) cells[wy * CW + cx] = v;
    }
  };
  const rect = (r: number[], v: number) => { for (let cy = Math.max(0, Math.floor(r[1] / CELL)); cy <= Math.min(CH - 1, Math.floor((r[1] + r[3]) / CELL)); cy++) for (let cx = Math.max(0, Math.floor(r[0] / CELL)); cx <= Math.min(CW - 1, Math.floor((r[0] + r[2]) / CELL)); cx++) cells[cy * CW + cx] = v; };
  const disc = (r: number[], v: number) => { for (let cy = Math.max(0, Math.floor((r[1] - r[2]) / CELL)); cy <= Math.min(CH - 1, Math.ceil((r[1] + r[2]) / CELL)); cy++) for (let cx = Math.max(0, Math.floor((r[0] - r[2]) / CELL)); cx <= Math.min(CW - 1, Math.ceil((r[0] + r[2]) / CELL)); cx++) { const px = cx * CELL + 2, py = cy * CELL + 2; if ((px - r[0]) ** 2 + (py - r[1]) ** 2 <= r[2] * r[2]) cells[cy * CW + cx] = v; } };
  const road = (pts: number[][], w: number) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const len = Math.hypot(x1 - x0, y1 - y0); for (let t = 0; t <= len; t += w * 0.4) disc([x0 + ((x1 - x0) * t) / len, y0 + ((y1 - y0) * t) / len, w / 2], 0); disc([x1, y1, w / 2], 0); } };

  for (const p of spec.water ?? []) paintPoly(p, 2);
  for (const p of spec.solid ?? []) paintPoly(p, 1);
  for (const p of spec.hazard ?? []) paintPoly(p, 3);
  for (const r of spec.solidRects ?? []) rect(r, 1);
  for (const d of spec.discsSolid ?? []) disc(d, 1);
  for (const r of spec.openRects ?? []) rect(r, 0);
  for (const d of spec.discsOpen ?? []) disc(d, 0);
  for (const r of spec.roads ?? []) road(r.pts, r.w);
  for (const r of spec.waterRects ?? []) rect(r, 2); // water rides ABOVE the open carving — pools survive the hall rect

  const o = JSON.parse(readFileSync(`public/art/floors/${id}/objects.json`, "utf8"));
  // prop colliders block; interact props get an open pad so their trigger is reachable
  for (const p of o.props ?? []) {
    if (p.solid === "rect") rect([p.x, p.y, p.w, p.h], 1);
    else if (p.solid === "ellipse") disc([p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h) / 2], 1);
    disc([p.x + p.w / 2, p.y + p.h + 6, 20], 0);
  }
  const pad = (x: number, y: number, r: number, v: number) => disc([x, y, r], v);
  for (const n of o.npcs) pad(n.x, n.y, 20, 0);
  for (const s of o.signs) pad(s.x, s.y, 16, 0);
  for (const rr of o.rests) { rect([rr.x, rr.y, rr.w, rr.h], 0); pad(rr.x + rr.w / 2, rr.y + rr.h / 2, Math.max(rr.w, rr.h) / 2 + 8, 0); }
  if (o.boss) pad(o.boss.x + o.boss.w / 2, o.boss.y + o.boss.h, 64, 0);
  for (const e of o.exits) { pad(e.x + e.w / 2, e.y + e.h / 2, 36, 4); }
  pad(o.spawn[0], o.spawn[1], 26, 0);
  // border ring LAST except exits touching an edge
  for (let cx = 0; cx < CW; cx++) { if (!(o.exits ?? []).some((e: { x: number; y: number; w: number; h: number }) => e.x < cx * CELL + CELL && e.x + e.w > cx * CELL && e.y < 0)) { cells[cx] = cells[cx] === 4 ? 4 : 1; cells[(CH - 1) * CW + cx] = cells[(CH - 1) * CW + cx] === 4 ? 4 : 1; } }
  for (let cy = 0; cy < CH; cy++) { for (const r of [1]) { cells[cy * CW + r] = cells[cy * CW + r] === 4 ? 4 : 1; cells[cy * CW + CW - 1 - r] = cells[cy * CW + CW - 1 - r] === 4 ? 4 : 1; } if (!(o.exits ?? []).some((e: { x: number; y: number; w: number; h: number }) => e.y < cy * CELL + CELL && e.y + e.h > cy * CELL && e.x < 0)) { cells[cy * CW] = cells[cy * CW] === 4 ? 4 : 1; cells[cy * CW + CW - 1] = cells[cy * CW + CW - 1] === 4 ? 4 : 1; } }

  const im = g.createImageData(CW, CH);
  const COL: Record<number, number[]> = { 0: [255, 255, 255], 1: [0, 0, 0], 2: [30, 70, 220], 3: [228, 48, 48], 4: [46, 204, 92] };
  let walk = 0;
  for (let i = 0; i < cells.length; i++) { const v = cells[i] < 0 ? 1 : cells[i] > 4 ? 1 : cells[i]; if (v === 0 || v === 4) walk++; const [r, gg, b] = COL[v]; im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  writeFileSync(`public/art/floors/${id}/collision.png`, c.toBuffer("image/png"));
  console.log(`${id}: ${(100 * walk / cells.length).toFixed(1)}% walkable (solid+water+hazard ${(100 - 100 * walk / cells.length).toFixed(1)}%)`);
}
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["verdant", "marsh", "caverns", "citadel", "ashenveil"]) run(id);
console.log("floorpolys done");
