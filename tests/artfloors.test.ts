// Art-floor collision contract: every real public/art/floors/<id>/collision.png must
//   1. keep at least 35% of the floor walkable (WALK or HAZARD — hazard hurts but is floor),
//   2. leave spawn, every NPC, sign, rest pad, exit pad and the boss trigger on
//      standable, flood-fill-reachable ground (water and solids blocked; exits never walled in).
// The mask is decoded exactly like floor.ts loadFloorArt does: one PNG pixel = one mask cell,
// classified through Mask.classify — no DOM needed here, only @napi-rs/canvas.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { Mask, MASK, CHUNK_U, FLOOR_IDS } from "../src/game/world.ts";

const ART_ROOT = join(import.meta.dirname, "..", "public", "art", "floors");

interface DecodedMask { m: Mask; walkable: number; total: number }

async function decodeMask(id: string): Promise<DecodedMask | null> {
  const png = join(ART_ROOT, id, "collision.png");
  if (!existsSync(png)) return null;
  const img = await loadImage(readFileSync(png));
  const c = createCanvas(img.width, img.height);
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const objs = JSON.parse(readFileSync(join(ART_ROOT, id, "objects.json"), "utf8"));
  const w = (objs.chunks?.[0] ?? 1) * CHUNK_U.w;
  const cell = w / c.width;
  const m = new Mask(c.width, c.height, cell);
  let walkable = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    const v = Mask.classify(d[i], d[i + 1], d[i + 2], d[i + 3]);
    m.cells[y * c.width + x] = v;
    if (v === MASK.WALK || v === MASK.HAZARD) walkable++;
  }
  return { m, walkable, total: c.width * c.height };
}

/** 4-connected flood of standable cells (SOLID + WATER block; HAZARD and EXIT do not). */
function reachable(m: Mask, sx: number, sy: number): Set<number> {
  const ok = (v: number) => v !== MASK.SOLID && v !== MASK.WATER;
  const start = sy * m.cw + sx;
  const seen = new Set<number>([start]);
  const q = [start];
  while (q.length) {
    const i = q.pop()!;
    const x = i % m.cw, y = (i / m.cw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.cw || ny >= m.ch) continue;
      const j = ny * m.cw + nx;
      if (seen.has(j) || !ok(m.cells[j])) continue;
      seen.add(j); q.push(j);
    }
  }
  return seen;
}

test("art floors: collision.png keeps ≥35% walkable ground", async () => {
  for (const id of FLOOR_IDS) {
    const dec = await decodeMask(id);
    if (!dec) continue;
    const pct = (dec.walkable / dec.total) * 100;
    assert.ok(pct >= 35, `${id}: only ${pct.toFixed(1)}% walkable — the traced props over-block the floor`);
  }
});

test("art floors: spawn, NPCs, signs, rests, exits and the boss pad all stand on walkable, reachable ground", async () => {
  for (const id of FLOOR_IDS) {
    const dir = join(ART_ROOT, id);
    if (!existsSync(join(dir, "collision.png"))) continue;
    const dec = await decodeMask(id);
    if (!dec) continue;
    const { m } = dec;
    const objs = JSON.parse(readFileSync(join(dir, "objects.json"), "utf8"));
    const cx = (wx: number) => Math.floor(wx / m.cell);
    const cy = (wy: number) => Math.floor(wy / m.cell);
    const spot = (label: string, wx: number, wy: number) => {
      const x = Math.min(m.cw - 1, Math.max(0, cx(wx)));
      const y = Math.min(m.ch - 1, Math.max(0, cy(wy)));
      const v = m.cells[y * m.cw + x];
      assert.ok(v !== MASK.SOLID && v !== MASK.WATER,
        `${id}: ${label} at (${wx.toFixed(0)},${wy.toFixed(0)}) sits on a blocked cell (class ${v})`);
      return y * m.cw + x;
    };
    const spawnCell = spot("spawn", objs.spawn[0], objs.spawn[1]);
    assert.notEqual(m.cells[spawnCell], MASK.EXIT, `${id}: spawn must not stand on an exit pad`);
    const reach = reachable(m, spawnCell % m.cw, (spawnCell / m.cw) | 0);
    for (const n of objs.npcs ?? []) {
      const i = spot(`npc ${n.id}`, n.x, n.y);
      assert.ok(reach.has(i), `${id}: npc ${n.id} is unreachable from spawn (walled in)`);
    }
    for (const s of objs.signs ?? []) {
      const i = spot(`sign @${s.x},${s.y}`, s.x, s.y);
      assert.ok(reach.has(i), `${id}: sign at (${s.x},${s.y}) is unreachable from spawn`);
    }
    for (const r of objs.rests ?? []) {
      const i = spot("rest pad", r.x + r.w / 2, r.y + r.h / 2);
      assert.ok(reach.has(i), `${id}: rest pad at (${r.x},${r.y}) is unreachable from spawn`);
    }
    for (const e of objs.exits ?? []) {
      const i = spot(`exit ${e.to}`, e.x + e.w / 2, e.y + e.h / 2);
      assert.ok(reach.has(i), `${id}: exit to ${e.to} is unreachable from spawn — doorway got traced shut`);
    }
    if (objs.boss) {
      const i = spot("boss pad", objs.boss.x + objs.boss.w / 2, objs.boss.y + objs.boss.h / 2);
      assert.ok(reach.has(i), `${id}: the boss pad is unreachable from spawn`);
    }
  }
});
