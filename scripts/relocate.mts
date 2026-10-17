// One-shot: for each art floor, flood-fill standable cells from spawn on the SHIPPED
// collision.png and move any entity that can't be walked to onto the nearest
// reachable cell (objects.json is rewritten; rerun floorpolys.mts afterwards).
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";
import { Mask, MASK, CHUNK_U, FLOOR_IDS } from "../src/game/world.ts";

const ok = (v: number) => v !== MASK.SOLID && v !== MASK.WATER;
for (const id of FLOOR_IDS) {
  let maskImg: Awaited<ReturnType<typeof loadImage>>;
  try { maskImg = await loadImage(readFileSync(`public/art/floors/${id}/collision.png`)); } catch { continue; }
  const c = createCanvas(maskImg.width, maskImg.height); const g = c.getContext("2d");
  g.drawImage(maskImg as never, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const objs = JSON.parse(readFileSync(`public/art/floors/${id}/objects.json`, "utf8"));
  const w = (objs.chunks?.[0] ?? 1) * CHUNK_U.w;
  const m = new Mask(c.width, c.height, w / c.width);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    m.cells[y * c.width + x] = Mask.classify(d[i], d[i + 1], d[i + 2], d[i + 3]);
  }
  const sCell = [Math.floor(objs.spawn[0] / m.cell), Math.floor(objs.spawn[1] / m.cell)];
  const reach = new Set<number>();
  const q = [sCell[1] * m.cw + sCell[0]];
  reach.add(q[0]);
  while (q.length) {
    const i = q.pop()!; const x = i % m.cw, y = (i / m.cw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.cw || ny >= m.ch) continue;
      const j = ny * m.cw + nx;
      if (reach.has(j) || !ok(m.cells[j])) continue;
      reach.add(j); q.push(j);
    }
  }
  let moves = 0;
  const relocate = (label: string, gx: number, gy: number, put: (x: number, y: number) => void, cx0?: number, cy0?: number) => {
    const cx = Math.floor(gx / m.cell), cy = Math.floor(gy / m.cell);
    const i0 = Math.min(m.ch - 1, Math.max(0, cy)) * m.cw + Math.min(m.cw - 1, Math.max(0, cx));
    if (reach.has(i0)) return;
    // BFS outward for the nearest reachable cell
    const seen = new Set<number>([i0]); const qq = [i0];
    let found = -1;
    while (qq.length && found < 0) {
      const i = qq.shift()!; const x = i % m.cw, y = (i / m.cw) | 0;
      if (reach.has(i)) { found = i; break; }
      for (const dx2 of [-2, 0, 2]) for (const dy2 of [-2, 0, 2]) {
        const nx = x + dx2, ny = y + dy2;
        if (nx < 0 || ny < 0 || nx >= m.cw || ny >= m.ch) continue;
        const j = ny * m.cw + nx;
        if (seen.has(j)) continue;
        seen.add(j); qq.push(j);
      }
    }
    if (found < 0) { console.log(`${id}: ${label} — NO reachable ground nearby, left as-is`); return; }
    const fx = (found % m.cw + 0.5) * m.cell + (cx0 ?? 0), fy = (Math.floor(found / m.cw) + 0.5) * m.cell + (cy0 ?? 0);
    console.log(`${id}: ${label} (${gx.toFixed(0)},${gy.toFixed(0)}) → (${fx.toFixed(0)},${fy.toFixed(0)})`);
    put(fx, fy); moves++;
  };
  objs.npcs.forEach((n: { id: string; x: number; y: number }, i: number) => relocate(`npc ${n.id}`, n.x, n.y, (x, y) => { objs.npcs[i].x = x; objs.npcs[i].y = y; }));
  objs.signs.forEach((s: { x: number; y: number }, i: number) => relocate(`sign @${s.x},${s.y}`, s.x, s.y, (x, y) => { objs.signs[i].x = x; objs.signs[i].y = y; }));
  objs.rests.forEach((r: { x: number; y: number; w: number; h: number }, i: number) => relocate(`rest`, r.x + r.w / 2, r.y + r.h / 2, (x, y) => { objs.rests[i].x = x - objs.rests[i].w / 2; objs.rests[i].y = y - objs.rests[i].h / 2; }));
  objs.exits.forEach((e: { x: number; y: number; w: number; h: number; to: string }, i: number) => relocate(`exit→${e.to}`, e.x + e.w / 2, e.y + e.h / 2, (x, y) => { objs.exits[i].x = x - objs.exits[i].w / 2; objs.exits[i].y = y - objs.exits[i].h / 2; }));
  if (objs.boss) relocate("boss pad", objs.boss.x + objs.boss.w / 2, objs.boss.y + objs.boss.h / 2, (x, y) => { objs.boss.x = x - objs.boss.w / 2; objs.boss.y = y - objs.boss.h / 2; });
  if (moves) { writeFileSync(`public/art/floors/${id}/objects.json`, JSON.stringify(objs, null, 2) + "\n"); console.log(`${id}: ${moves} entity move(s) saved`); }
  else console.log(`${id}: all entities reachable from spawn ✓`);
}
