// Floor alignment check v2: renders each placeholder floor with its collision
// mask + object overlay, exactly as F3 does in-game, into one 1440×540 montage.
// Run: npx tsx scripts/region-check.mts → shots/51-region-check.png
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

// the only DOM floor.ts needs is createElement("canvas") — napi answers that
(globalThis as never as Record<string, unknown>).document = {
  createElement: (tag: string) => (tag === "canvas" ? createCanvas(1, 1) : { style: {}, setAttribute() {}, appendChild() {} }),
};
try { Object.defineProperty(globalThis, "navigator", { value: { userAgent: "region-check" }, configurable: true }); } catch { /* ok */ }

const { makeFloor, placeholderGround, FLOOR_IDS, MASK } = await import("../src/game/world.ts");

mkdirSync("shots", { recursive: true });
const VIEWS = 960, VIEWH = 540;      // one game view per floor panel
const PW = 280, PH = 158, GAP = 12;  // panel size on the montage
const sheet = createCanvas(FLOOR_IDS.length * (PW + GAP) + GAP, 540);
const sc = sheet.getContext("2d");
sc.fillStyle = "#0b0f18"; sc.fillRect(0, 0, sheet.width, sheet.height);
sc.fillStyle = "#59708f"; sc.font = "bold 12px monospace";
sc.fillText("ASHENVEIL · placeholder floors × collision masks (1 px mask = 8 art px = 4 units) · red=solid blue=water orange=hazard green=exit", GAP, 22);

for (let i = 0; i < FLOOR_IDS.length; i++) {
  const id = FLOOR_IDS[i];
  const fl = makeFloor(id);
  fl.art.ground = placeholderGround(fl); // the generated flat-color+grid ground
  const view = createCanvas(VIEWS, VIEWH);
  const c = view.getContext("2d");
  c.imageSmoothingEnabled = false;
  // camera: follow-clamp at the spawn, small maps centred
  const camX = fl.w > VIEWS ? Math.max(0, Math.min(fl.w - VIEWS, fl.objects.spawn[0] - VIEWS / 2)) : (fl.w - VIEWS) / 2;
  const camY = fl.h > VIEWH ? Math.max(0, Math.min(fl.h - VIEWH, fl.objects.spawn[1] - VIEWH / 2)) : (fl.h - VIEWH) / 2;
  const ox = Math.round(-camX), oy = Math.round(-camY);
  c.fillStyle = "#05070d"; c.fillRect(0, 0, VIEWS, VIEWH);
  if (fl.art.ground) c.drawImage(fl.art.ground as never, ox, oy, fl.w, fl.h);
  const m = fl.mask;
  const cell = m.cell;
  const tint = (v: number) => v === MASK.SOLID ? "rgba(255,64,64,0.30)" : v === MASK.WATER ? "rgba(64,120,255,0.38)" : v === MASK.HAZARD ? "rgba(255,150,40,0.40)" : v === MASK.EXIT ? "rgba(64,255,120,0.34)" : null;
  for (let y = 0; y < m.ch; y++) for (let x = 0; x < m.cw; x++) {
    const t = tint(m.cells[y * m.cw + x]);
    if (!t) continue;
    c.fillStyle = t;
    c.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
  }
  c.lineWidth = 1.5;
  c.strokeStyle = "rgba(255,255,120,0.75)";
  for (const p of fl.objects.props) if (p.solid) {
    if (p.solid === "ellipse") { c.beginPath(); c.ellipse(ox + p.x + p.w / 2, oy + p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); c.stroke(); }
    else c.strokeRect(ox + p.x, oy + p.y, p.w, p.h);
  }
  c.strokeStyle = "rgba(140,255,190,0.95)";
  for (const e of fl.objects.exits) c.strokeRect(ox + e.x, oy + e.y, e.w, e.h);
  c.strokeStyle = "rgba(255,120,140,0.95)";
  if (fl.objects.boss) c.strokeRect(ox + fl.objects.boss.x, oy + fl.objects.boss.y, fl.objects.boss.w, fl.objects.boss.h);
  c.fillStyle = "rgba(127,231,255,0.5)";
  for (const z of fl.objects.zones) c.fillRect(ox + z.x, oy + z.y, z.w, z.h);
  c.fillStyle = "#ffe08a";
  for (const n of fl.objects.npcs) c.fillRect(ox + n.x - 3, oy + n.y - 3, 6, 6);
  c.fillStyle = "#ffffff";
  c.fillRect(ox + fl.objects.spawn[0] - 3, oy + fl.objects.spawn[1] - 3, 6, 6);
  // the panel: downscale the full 960×540 view — never upscale
  const bx = GAP + i * (PW + GAP), by = 40;
  sc.fillStyle = "#1d2430"; sc.fillRect(bx - 2, by - 2, PW + 4, PH + 4);
  sc.drawImage(view as never, bx, by, PW, PH);
  sc.fillStyle = "#9fd8ff"; sc.font = "bold 11px monospace";
  sc.fillText(fl.name, bx, by + PH + 16);
  sc.fillStyle = "#59708f"; sc.font = "10px monospace";
  sc.fillText(`${fl.w}×${fl.h}u · mask ${m.cw}×${m.ch} · ${fl.objects.npcs.length} npc ${fl.objects.exits.length} exit`, bx, by + PH + 30);
}
// legend strip at the bottom
sc.fillStyle = "#59708f"; sc.font = "11px monospace";
sc.fillText("cyan wash = encounter zone · yellow box = prop collider · green box = exit pad · red box = boss trigger · dots = NPCs/spawn", GAP, 340);
const legend: [string, string][] = [["solid", "rgba(255,64,64,0.55)"], ["water", "rgba(64,120,255,0.6)"], ["hazard (walkable! burns)", "rgba(255,150,40,0.6)"], ["exit pad", "rgba(64,255,120,0.55)"]];
legend.forEach(([label, col], k) => {
  const x = GAP + k * 330;
  sc.fillStyle = col; sc.fillRect(x, 360, 26, 14);
  sc.fillStyle = "#9fb4d8"; sc.font = "11px monospace";
  sc.fillText(label, x + 34, 371);
});
writeFileSync("shots/51-region-check.png", sheet.toBuffer("image/png"));
console.log("saved shots/51-region-check.png", `${sheet.width}×${sheet.height}`);
for (const id of FLOOR_IDS) {
  const fl = makeFloor(id);
  let solid = 0;
  for (let i = 0; i < fl.mask.cells.length; i++) if (fl.mask.cells[i] === MASK.SOLID) solid++;
  console.log(`${id}: ${fl.w}×${fl.h}u chunks ${fl.objects.chunks} mask ${fl.mask.cw}×${fl.mask.ch} solid ${solid} npcs ${fl.objects.npcs.length} signs ${fl.objects.signs.length} props ${fl.objects.props.length} rests ${fl.objects.rests.length} exits ${fl.objects.exits.length} boss ${fl.objects.boss ? fl.objects.boss.id : "—"}`);
}
