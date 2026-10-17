// traceimport — turn a designer's hand-corrected collision render into the exact
// mask cell grid (480x270 @ 4u) the game uses. Rules: black >=5/9 votes = SOLID
// (thin line-art can never qualify), saturated blue = WATER, bright green = EXIT.
// Then two smoothing passes: drop stray solid cells (stuck-on-corner killers) and
// fill walkable pinholes inside solid masses. Output: scripts/<floor>.cells.json (RLE).
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, readFileSync } from "node:fs";

const CW = 480, CH = 270, CELL = 4;
const floor = process.argv[2] ?? "verdant";
const src = process.argv[3] ?? `public/art/floors/${floor}/trace-ref.png`;
const img = await loadImage(readFileSync(src));
const c = createCanvas(img.width, img.height); const g = c.getContext("2d");
g.drawImage(img as never, 0, 0);
const d = g.getImageData(0, 0, c.width, c.height).data;
const PXC = (img.width / (CW * CELL)) * CELL; // image px per mask cell (img spans world 1920x1080)
const at = (x: number, y: number): [number, number, number] => {
  const xi = Math.min(c.width - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(c.height - 1, Math.max(0, Math.round(y)));
  const i = (yi * c.width + xi) * 4;
  return [d[i], d[i + 1], d[i + 2]];
};
const classify = (r: number, gg: number, b: number) => {
  if (b > 120 && b > r + 45 && b > gg + 35) return 2;   // water
  if (gg > 140 && gg > r + 50 && gg > b + 30) return 4; // exit pad
  if ((r + gg + b) / 3 < 72) return 1;                   // solid
  return 0;
};
const cells = new Uint8Array(CW * CH);
for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
  const v = [0, 0, 0, 0, 0];
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++)
    v[classify(...at((cx + 0.5) * PXC + ox * 0.8, (cy + 0.5) * PXC + oy * 0.8))]++;
  const i = cy * CW + cx;
  cells[i] = v[1] >= 5 ? 1 : v[2] >= 4 ? 2 : v[4] >= 3 ? 4 : 0;
}
// smoothing pass 1: a solid cell with <2 solid neighbours is a stray hairline
const snap = Uint8Array.from(cells);
const solidN = (snapArr: Uint8Array, cx: number, cy: number) => {
  let s = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= CW || y >= CH) { s++; continue; }
    if (snapArr[y * CW + x] === 1) s++;
  }
  return s;
};
let dropped = 0, filled = 0;
for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
  const i = cy * CW + cx;
  if (snap[i] === 1 && solidN(snap, cx, cy) < 2) { cells[i] = 0; dropped++; }
}
const snap2 = Uint8Array.from(cells);
for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
  const i = cy * CW + cx;
  if (snap2[i] === 0 && snap2[i] !== 4 && solidN(snap2, cx, cy) >= 7) { cells[i] = 1; filled++; }
}
// RLE encode
let rle = "", v = cells[0], cnt = 1;
for (let i = 1; i < cells.length; i++) { if (cells[i] === v && cnt < 99999) cnt++; else { rle += `${v}:${cnt},`; v = cells[i]; cnt = 1; } }
rle += `${v}:${cnt}`;
writeFileSync(`scripts/${floor}.cells.json`, JSON.stringify({ cw: CW, ch: CH, cell: CELL, rle }));
const tot = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
for (const x of cells) tot[x]++;
console.log(`${floor}: imported from ${img.width}x${img.height} (scale ${PXC.toFixed(3)}imgpx/cell) — walk ${((tot[0] / (CW * CH)) * 100).toFixed(1)}% solid ${((tot[1] / (CW * CH)) * 100).toFixed(1)}% water ${((tot[2] / (CW * CH)) * 100).toFixed(1)}% exit ${((tot[4] / (CW * CH)) * 100).toFixed(1)}% — smoothed (-${dropped} strays, +${filled} pinholes)`);
