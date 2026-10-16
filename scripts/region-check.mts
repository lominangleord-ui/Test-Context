// Region alignment check: paints each region's collider grid over its ground
// art so authored walk-rects can be compared against what the art suggests.
// Run: npx tsx scripts/region-check.mts → shots/51-region-check.png
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

// minimal globals so core.ts imports cleanly (no DOM is touched at module load)
(globalThis as never as Record<string, unknown>).window = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), location: { href: "http://localhost/", origin: "http://localhost" } };
try { Object.defineProperty(globalThis, "navigator", { value: { userAgent: "region-check", clipboard: { writeText: async () => {} }, addEventListener() {}, removeEventListener() {} }, configurable: true }); } catch { /* ok */ }

const { buildWorld, buildCollider, freshFlags, REGION_ORDER } = await import("../src/game/world.ts");
const { TILE } = await import("../src/game/core.ts");
mkdirSync("shots", { recursive: true });

const SCALE = 0.5;
const PW = 64 * TILE * SCALE; // 512
const PH = 512;
const cols = 3, rows = 2;
const sheet = createCanvas(cols * (PW + 12) + 12, rows * (PH + 26) + 12);
const sc = sheet.getContext("2d");
sc.fillStyle = "#0b0f18"; sc.fillRect(0, 0, sheet.width, sheet.height);

for (let i = 0; i < REGION_ORDER.length; i++) {
  const id = (REGION_ORDER as readonly string[])[i];
  const world = buildWorld(id);
  const col = buildCollider(world, freshFlags());
  const cx = 12 + (i % cols) * (PW + 12), cy = 12 + Math.floor(i / cols) * (PH + 26);
  const ground = await loadImage(`public/${world.region.ground.replace(/^art\//, "art/")}`).catch(() => null);
  if (ground) sc.drawImage(ground as never, cx, cy, PW, PH);
  // collision overlay
  for (let ty = 0; ty < 64; ty++) for (let tx = 0; tx < 64; tx++) {
    const solid = col[ty * 64 + tx] === 1;
    sc.fillStyle = solid ? "rgba(255,40,60,0.30)" : "rgba(40,255,120,0.16)";
    sc.fillRect(cx + tx * TILE * SCALE, cy + ty * TILE * SCALE, TILE * SCALE, TILE * SCALE);
  }
  const dot = (tx: number, ty: number, c: string, r = 5) => {
    sc.fillStyle = c; sc.beginPath(); sc.arc(cx + tx * TILE * SCALE, cy + ty * TILE * SCALE, r, 0, Math.PI * 2); sc.fill();
    sc.strokeStyle = "#000"; sc.lineWidth = 1; sc.stroke();
  };
  dot(world.spawn.x / TILE, world.spawn.y / TILE, "#3fd2ff", 6);
  for (const n of world.npcs) dot(n.x + 0.5, n.y + 0.8, "#ffe08a", 4);
  for (const s of world.signs) dot(s.x + 0.5, s.y + 0.5, "#ffffff", 3);
  if (world.boss) dot(world.boss.x + 0.5, world.boss.y + 1, "#ff5566", 6);
  if (world.exit) dot(world.exit.x + 0.5, world.exit.y + 0.5, "#8fffd8", 5);
  sc.fillStyle = "#9fd8ff"; sc.font = "bold 14px monospace";
  sc.fillText(`${world.region.name}  (${id})  spawn ${Math.round(world.spawn.x / TILE)},${Math.round(world.spawn.y / TILE)}  mode ${world.region.mode}`, cx + 2, cy + PH + 16);
}
writeFileSync("shots/51-region-check.png", sheet.toBuffer("image/png"));
console.log("saved shots/51-region-check.png");
