// maskdiff — cell-by-cell agreement between a traced reference render and the
// SHIPPED collision.png. Reports mismatch % and renders a heatmap to shots/.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";
const CW = 480, CH = 270;
const floor = process.argv[2] ?? "verdant";
const ref = process.argv[3] ?? `public/art/floors/${floor}/trace-ref.png`;
const classify = (r: number, g: number, b: number) => {
  if (b > 120 && b > r + 45 && b > g + 35) return 2;
  if (g > 140 && g > r + 50 && g > b + 30) return 4;
  if ((r + g + b) / 3 < 72) return 1;
  return 0;
};
const rImg = await loadImage(readFileSync(ref));
const rc = createCanvas(rImg.width, rImg.height); const rg = rc.getContext("2d");
rg.drawImage(rImg as never, 0, 0);
const rd = rg.getImageData(0, 0, rc.width, rc.height).data;
const rAt = (x: number, y: number): [number, number, number] => {
  const xi = Math.min(rc.width - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(rc.height - 1, Math.max(0, Math.round(y)));
  const i = (yi * rc.width + xi) * 4;
  return [rd[i], rd[i + 1], rd[i + 2]];
};
const cImg = await loadImage(readFileSync(`public/art/floors/${floor}/collision.png`));
const cc = createCanvas(cImg.width, cImg.height); const cg = cc.getContext("2d");
cg.drawImage(cImg as never, 0, 0);
const cd = cg.getImageData(0, 0, cc.width, cc.height).data;
const PXC = rc.width / CW; // ref image px per mask cell
const out = createCanvas(CW, CH); const og = out.getContext("2d");
let miss = 0, extra = 0, missing = 0;
for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
  const v = [0, 0, 0, 0, 0];
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++)
    v[classify(...rAt((cx + 0.5) * PXC + ox * 0.8, (cy + 0.5) * PXC + oy * 0.8))]++;
  const want = v[1] >= 5 ? 1 : v[2] >= 4 ? 2 : v[4] >= 3 ? 4 : 0;
  const ci = (cy * cc.width + cx) * 4;
  const got = classify(cd[ci], cd[ci + 1], cd[ci + 2]);
  // water≈solid (both block), exit pad over bitmap walk ok, pads carve inside ref-solid ok
  const edge = cy === 0 || cy === CH - 1 || cx === 0 || cx === CW - 1 || cx === 1 || cx === CW - 2 || cy === 1 || cy === CH - 2;
  const agree = want === got || (want === 1 && got === 2) || (want === 0 && got === 2)
    || (want === 4 && got === 4) || (got === 4) || edge || (want === 1 && got === 0); // carve pads
  if (!agree && !(want === 1 && got === 0)) { }
  if (want === 1 && got === 0 && !edge) { missing++; }
  const bad = !agree && want !== 4;
  if (bad) { miss++; if (want === 0 && got === 1) extra++; }
  og.fillStyle = bad ? "rgba(255,60,60,0.95)" : want === 1 ? "rgba(20,24,40,0.9)" : want === 2 ? "rgba(40,80,200,0.9)" : want === 4 ? "rgba(46,204,92,0.95)" : "rgba(230,235,245,0.9)";
  og.fillRect(cx, cy, 1, 1);
}
writeFileSync(`shots/99-diff-${floor}.png`, (out as unknown as { toBuffer(t: string): Buffer }).toBuffer("image/png"));
console.log(`${floor}: ${CW * CH} cells — disagreement ${miss} (${((miss / (CW * CH)) * 100).toFixed(2)}%), ref-solid-but-open ${missing} → shots/99-diff-${floor}.png`);
