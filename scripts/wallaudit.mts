// Invisible-wall audit: mask says BLOCKED, the ground art under it says OPEN PAINT.
// Clusters of such cells are the barriers players bump into for no visual reason.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { Mask, MASK, CHUNK_U, FLOOR_IDS } from "../src/game/world.ts";

for (const id of FLOOR_IDS) {
  try {
    const mImg = await loadImage(readFileSync(`public/art/floors/${id}/collision.png`));
    const gImg = await loadImage(readFileSync(`public/art/floors/${id}/ground.png`));
    const c = createCanvas(mImg.width, mImg.height); const g = c.getContext("2d");
    g.drawImage(mImg as never, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const scale = gImg.width / c.width; // art px per mask cell (8)
    const gc = createCanvas(gImg.width, gImg.height); const gg = gc.getContext("2d");
    gg.drawImage(gImg as never, 0, 0);
    const gd = gg.getImageData(0, 0, gc.width, gc.height).data;
    const objs = JSON.parse(readFileSync(`public/art/floors/${id}/objects.json`, "utf8"));
    const w = (objs.chunks?.[0] ?? 1) * CHUNK_U.w;
    const m = new Mask(c.width, c.height, w / c.width);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      m.cells[y * c.width + x] = Mask.classify(d[i], d[i + 1], d[i + 2], d[i + 3]);
    }
    // bright open paint = avg luma of the art cell region
    const luma = (x: number, y: number) => {
      let s = 0, n = 0;
      for (let dy = 0; dy < scale; dy += 2) for (let dx = 0; dx < scale; dx += 2) {
        const px = Math.min(gc.width - 1, Math.round(x * scale + dx)), py = Math.min(gc.height - 1, Math.round(y * scale + dy));
        const j = (py * gc.width + px) * 4;
        s += (gd[j] + gd[j + 1] + gd[j + 2]) / 3; n++;
      }
      return s / Math.max(1, n);
    };
    // flood clusters of SOLID-over-bright cells
    const open = new Uint8Array(c.width * c.height);
    let tot = 0;
    for (let y = 2; y < c.height - 2; y++) for (let x = 2; x < c.width - 2; x++) {
      const i = y * c.width + x;
      if (m.cells[i] === MASK.SOLID && luma(x, y) > 138) { open[i] = 1; tot++; }
    }
    const seen = new Uint8Array(open.length);
    const boxes: { x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
    for (let i = 0; i < open.length; i++) {
      if (!open[i] || seen[i]) continue;
      const q = [i]; seen[i] = 1;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
      while (q.length) {
        const j = q.pop()!; const x = j % c.width, y = (j / c.width) | 0;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); n++;
        for (const k of [j - 1, j + 1, j - c.width, j + c.width]) {
          if (k < 0 || k >= open.length || !open[k] || seen[k]) continue;
          const kk = k; const xk = kk % c.width;
          if (Math.abs(xk - x) > 1) continue;
          seen[kk] = 1; q.push(kk);
        }
      }
      if (n >= 24) boxes.push({ x0: x0 * 4, y0: y0 * 4, x1: (x1 + 1) * 4, y1: (y1 + 1) * 4, n });
    }
    boxes.sort((a, b) => b.n - a.n);
    console.log(`\n${id}: blocked-over-bright-paint cells: ${tot} (${((tot / (c.width * c.height)) * 100).toFixed(1)}%)`);
    for (const b of boxes.slice(0, 8)) console.log(`  block ${b.n} cells — world (${b.x0},${b.y0})–(${b.x1},${b.y1})  [${b.x1 - b.x0}×${b.y1 - b.y0}u]`);
  } catch (e) { console.log(`${id}: skipped (${(e as Error).message.slice(0, 60)})`); }
}
