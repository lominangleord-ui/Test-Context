// floordiag — read-only diagnosis of mask↔ground alignment + class distribution,
// exactly as observed by the REAL loader (no shims beyond the headless DOM).
// Run: npx tsx scripts/floordiag.mts [floorIds...]
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { existsSync, readFileSync } from "node:fs";
(globalThis as never as Record<string, unknown>).document = { createElement: (t: string) => (t === "canvas" ? createCanvas(1, 1) : { style: {}, setAttribute() {}, appendChild() {}, remove() {} }), addEventListener() {}, removeEventListener() {}, hidden: false, body: { appendChild() {} } };
class FakeImage { onload: (() => void) | null = null; onerror: (() => void) | null = null; width = 0; height = 0; private _src = "";
  set src(v: string) { this._src = v; const path = "public/" + v.replace(/^\//, "").split("?")[0]; if (!existsSync(path)) { this.onerror?.(); return; }
    loadImage(path).then((c) => { (this as never as { __canvas: unknown }).__canvas = c; this.width = (c as { width: number }).width; this.height = (c as { height: number }).height; this.onload?.(); }).catch(() => this.onerror?.()); }
  get src() { return this._src; } get naturalWidth() { return this.width; } }
(globalThis as never as Record<string, unknown>).Image = FakeImage;
const proto = Object.getPrototypeOf(createCanvas(2, 2).getContext("2d")); const origDI = proto.drawImage;
proto.drawImage = function (im: unknown, ...rest: unknown[]) { origDI.call(this, (im as { __canvas?: unknown })?.__canvas ?? im, ...(rest as never[])); };
(globalThis as never as Record<string, unknown>).fetch = (input: unknown) => { const u = String(input); if (u.startsWith("/") || u.startsWith("art/")) { const path = "public/" + u.replace(/^\//, "").split("?")[0]; if (!existsSync(path)) return Promise.resolve(new Response(null, { status: 404 })); return Promise.resolve(new Response(readFileSync(path), { status: 200, headers: { "Content-Type": path.endsWith(".json") ? "application/json" : "image/png" } })); } return Promise.reject(new Error("no net")); };

const { makeFloor, loadFloorArt, MASK, posBlocked } = await import("../src/game/floor.ts");
const { Art } = await import("../src/game/artset.ts");
const NAME: Record<number, string> = { 0: "WALK", 1: "SOLID", 2: "WATER", 3: "HAZARD", 4: "EXIT" };
// expected painted features per floor (world units): [x, y, expectedClass]
// (exits below are auto-derived from objects.json centers — pad-edge misses were
// a probe bug, not a mask bug; keep feature probes pinned to painted truth)
const PROBES: Record<string, [number, number, number][]> = {
  verdant: [[700, 30, 4], [900, 880, 0], [1370, 730, 1], [700, 100, 0], [480, 224, 1], [960, 680, 0], [1470, 270, 2]],
  // v5: bright-paint carve means WATER survives only where the art is actually dark
  marsh: [[722, 458, 0], [1073, 658, 2], [1112, 584, 1], [170, 360, 1]],
  caverns: [[196, 110, 0], [1350, 130, 3], [916, 322, 0], [900, 600, 0]],
  citadel: [[945, 902, 0], [395, 200, 2], [960, 60, 1], [900, 600, 0]],
  ashenveil: [[952, 978, 0], [700, 520, 0], [100, 700, 2], [630, 150, 1]],
};
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["verdant", "marsh", "caverns", "citadel", "ashenveil"]) {
  const fl = makeFloor(id);
  const preMask = { cw: fl.mask.cw, ch: fl.mask.ch };
  await loadFloorArt(fl);
  const m = fl.mask;
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const v of m.cells) counts[v]++;
  const tot = m.cells.length;
  const pct = (k: number) => ((counts[k] / tot) * 100).toFixed(1) + "%";
  const ground = await loadImage(`public/art/floors/${id}/ground.png`);
  const col = await loadImage(`public/art/floors/${id}/collision.png`);
  const asp = (w: number, h: number) => (w / h).toFixed(4);
  const spawnCell = m.cells[Math.floor(fl.objects.spawn[1] / m.cell) * m.cw + Math.floor(fl.objects.spawn[0] / m.cell)];
  console.log(`\n== ${id} ==`);
  console.log(`  mask applied: ${m.cw}×${m.ch} (procedural was ${preMask.cw}×${preMask.ch})  cell=${m.cell}u`);
  console.log(`  collision.png ${col.width}×${col.height} | ground.png ${ground.width}×${ground.height} | floor units ${fl.w}×${fl.h}`);
  console.log(`  aspects: ground ${asp(ground.width, ground.height)}  mask ${asp(m.cw * m.cell, m.ch * m.cell)}  units ${asp(fl.w, fl.h)}  ${asp(ground.width, ground.height) === asp(m.cw * m.cell, m.ch * m.cell) ? "MATCH" : "STRETCHED"}`);
  console.log(`  classes: WALK ${pct(0)}  SOLID ${pct(1)}  WATER ${pct(2)}  HAZARD ${pct(3)}  EXIT ${pct(4)}`);
  console.log(`  spawn (${fl.objects.spawn[0]},${fl.objects.spawn[1]}) cell = ${NAME[spawnCell]}  posBlocked=${posBlocked(fl, fl.objects.spawn[0], fl.objects.spawn[1])}`);
  let bad = 0;
  const exitProbes = (fl.objects.exits ?? []).map((e) => [e.x + e.w / 2, e.y + e.h / 2, 4] as [number, number, number]);
  for (const [x, y, want] of [...(PROBES[id] ?? []), ...exitProbes]) {
    const got = m.cells[Math.floor(y / m.cell) * m.cw + Math.floor(x / m.cell)];
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  probe (${x},${y}): ${NAME[got]}${ok ? " ✓" : ` ✗ expected ${NAME[want]}`}`);
  }
  // flip test: sample a coarse mirrored difference (a vertically flipped mask scores ~0 match on structured art)
  const cmp = (a: number, b: number) => (m.cells[a] >= 1 ? 1 : 0) - (m.cells[b] >= 1 ? 1 : 0);
  let vdiff = 0, hdiff = 0;
  for (let cy = 0; cy < m.ch; cy += 3) for (let cx = 0; cx < m.cw; cx += 3) {
    const i = cy * m.cw + cx;
    if ((m.cells[i] >= 1) !== (m.cells[(m.ch - 1 - cy) * m.cw + cx] >= 1)) vdiff++;
    if ((m.cells[i] >= 1) !== (m.cells[cy * m.cw + (m.cw - 1 - cx)] >= 1)) hdiff++;
  }
  console.log(`  symmetry probes (not a flaw, just context): V-flip-mismatch ${vdiff}, H-flip-mismatch ${hdiff}`);
  console.log(`  collision status via Art: ${Art.status(`floor:${id}:collision`)} | manifest url: ${Art.urlFor(`floor:${id}:collision`)}`);
  const ov = Art.urlFor(`floor:${id}:overlay`);
  console.log(`  overlay url: ${ov ?? "none (fallback fetch of art/floors/<id>/overlay.png will 404 → mask unaffected)"} | probes failing: ${bad}`);
}
console.log("\n== minimap palette source ==");
const view = readFileSync("src/game/view.ts", "utf8");
const mm = view.slice(view.indexOf("private renderMinimap"), view.indexOf("private renderMinimap") + 1400);
for (const line of mm.split("\n")) if (/MASK|fillStyle|#[0-9a-f]/i.test(line)) console.log("  " + line.trim());
