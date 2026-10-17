// unblock — step 2 of the collision redo: regenerate every floor's collision.png
// as ALL WALKABLE except a solid outer border ring and the prop colliders declared
// in objects.json. Exits stay EXIT-green (walkable pads the loader requires).
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, readFileSync } from "node:fs";
const CW = 480, CH = 270, CELL = 4, RING = 2;
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["verdant", "marsh", "caverns", "citadel", "ashenveil"]) {
  const o = JSON.parse(readFileSync(`public/art/floors/${id}/objects.json`, "utf8"));
  const cells = new Uint8Array(CW * CH); // 0 = walk (white)
  const put = (x: number, y: number, w: number, h: number, v: number) => {
    for (let cy = Math.max(0, Math.floor(y / CELL)); cy <= Math.min(CH - 1, Math.floor((y + h) / CELL)); cy++)
      for (let cx = Math.max(0, Math.floor(x / CELL)); cx <= Math.min(CW - 1, Math.floor((x + w) / CELL)); cx++) cells[cy * CW + cx] = v;
  };
  for (let cx = 0; cx < CW; cx++) { cells[cx] = 1; cells[(CH - 1) * CW + cx] = 1; for (let r = 1; r < RING; r++) { cells[r * CW + cx] = 1; cells[(CH - 1 - r) * CW + cx] = 1; } }
  for (let cy = 0; cy < CH; cy++) { cells[cy * CW] = 1; cells[cy * CW + CW - 1] = 1; for (let r = 1; r < RING; r++) { cells[cy * CW + r] = 1; cells[cy * CW + CW - 1 - r] = 1; } }
  for (const p of o.props ?? []) if (p.solid === "rect") put(p.x, p.y, p.w, p.h, 1);
  else if (p.solid === "ellipse") { const rx = p.w / 2, ry = p.h / 2, mx = p.x + rx, my = p.y + ry;
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) { const px = cx * CELL + 2, py = cy * CELL + 2; if (((px - mx) / rx) ** 2 + ((py - my) / ry) ** 2 <= 1) cells[cy * CW + cx] = 1; } }
  for (const e of o.exits ?? []) put(e.x, e.y, e.w, e.h, 4);
  for (const r of o.rests ?? []) put(r.x, r.y, r.w, r.h, 0);
  const c = createCanvas(CW, CH); const g = c.getContext("2d");
  const im = g.createImageData(CW, CH);
  const COL: Record<number, number[]> = { 0: [255, 255, 255], 1: [0, 0, 0], 2: [30, 70, 220], 3: [228, 48, 48], 4: [46, 204, 92] };
  for (let i = 0; i < cells.length; i++) { const [r, gg, b] = COL[cells[i]]; im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  writeFileSync(`public/art/floors/${id}/collision.png`, c.toBuffer("image/png"));
  const walk = cells.filter((v) => v === 0 || v === 4).length;
  console.log(`unblocked ${id}: ${(100 * walk / cells.length).toFixed(1)}% walkable`);
}
