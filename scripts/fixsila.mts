import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
const im = await loadImage("public/art/_raw/actor.sila.front.png");
const c = createCanvas(im.width, im.height); const g = c.getContext("2d");
g.drawImage(im as never, 0, 0);
const d = g.getImageData(0, 0, c.width, c.height).data;
const px = (x: number, y: number) => (y * c.width + x) * 4;
// border median bg color (same idea as artprep)
const samples: number[][] = [];
for (let x = 0; x < c.width; x += 7) { samples.push([d[px(x, 0)], d[px(x, 0) + 1], d[px(x, 0) + 2]], [d[px(x, c.height - 1)], d[px(x, c.height - 1) + 1], d[px(x, c.height - 1) + 2]]); }
samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
const bg = samples[Math.floor(samples.length / 2)];
const subj = (x: number, y: number) => { const i = px(x, y); if (d[i + 3] < 12) return false; const r = d[i], gg = d[i + 1], b = d[i + 2]; return !(r > 150 && b > 150 && gg < 130 && Math.abs(r - b) < 90); };
// drop the outer 1.2% margin (black frame) before analyzing
const mx = Math.round(c.width * 0.012), my = Math.round(c.height * 0.03);
g.clearRect(0, 0, c.width, my); g.clearRect(0, c.height - my, c.width, my);
g.clearRect(0, 0, mx, c.height); g.clearRect(c.width - mx, 0, mx, c.height);
d.set(g.getImageData(0, 0, c.width, c.height).data);
const colHas = new Int32Array(c.width);
for (let x = 0; x < c.width; x++) for (let y = 0; y < c.height; y += 2) if (subj(x, y)) { colHas[x] = 1; break; }
const runs: [number, number][] = [];
let s = -1;
for (let x = 0; x <= c.width; x++) {
  const has = x < c.width && colHas[x];
  if (has && s < 0) s = x;
  if (!has && s >= 0) { if (x - s > 24) runs.push([s, x]); s = -1; }
}
console.log("poses:", runs.length, runs.map(([x0, x1]) => x1 - x0).join(", "));
let best = 0, bestRows = -1;
runs.forEach(([x0, x1], i) => {
  let n = 0;
  for (let x = x0; x < x1; x++) for (let y = 0; y < c.height; y++) if (subj(x, y)) { n++; break; }
  console.log(`  run ${i}: x ${x0}..${x1} density ${(n / (x1 - x0)).toFixed(1)}`);
  if (n / (x1 - x0) > bestRows) { bestRows = n / (x1 - x0); best = i; }
});
// prefer the MIDDLE run when three near-identical poses exist (best lighting variant)
if (runs.length >= 3) best = 1;
const [x0, x1] = runs[best];
let y0 = c.height, y1 = 0;
for (let x = x0; x < x1; x++) for (let y = 0; y < c.height; y++) if (subj(x, y)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
const pad = 12;
const w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
const out = createCanvas(w, h);
out.getContext("2d").drawImage(c as never, x0 - pad, y0 - pad, w, h, 0, 0, w, h);
writeFileSync("public/art/_raw/actor.sila.front.png", out.toBuffer("image/png"));
console.log("kept pose", best, `-> ${w}x${h}`);
