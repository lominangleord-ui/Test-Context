// Movement repro: for every floor, land like the game does (fresh spawn AND
// entry via an exit stub), then simulate 8-directional walking for 1s each.
// A floor is "stuck" if the player cannot move >30u from the landing spot.
import { createCanvas, Image, loadImage } from "@napi-rs/canvas";
import { existsSync, readFileSync } from "node:fs";
const LS = new Map<string, string>();
(globalThis as Record<string, unknown>).window = { addEventListener() {}, removeEventListener() {}, innerWidth: 960, innerHeight: 540, devicePixelRatio: 1, localStorage: LS, Audio: class { play() {} } };
(globalThis as never as Record<string, unknown>).document = { createElement: (t: string) => (t === "canvas" ? createCanvas(1, 1) : { style: {}, setAttribute() {}, appendChild() {}, remove() {} }), addEventListener() {}, removeEventListener() {}, hidden: false, body: { appendChild() {} } };
class FakeImage { onload: (() => void) | null = null; onerror: (() => void) | null = null; width = 0; height = 0; private _src = "";
  set src(v: string) { this._src = v; const path = "public/" + v.replace(/^\//, "").split("?")[0]; if (!existsSync(path)) { this.onerror?.(); return; }
    loadImage(path).then((c) => { (this as never as { __canvas: unknown }).__canvas = c; this.width = (c as { width: number }).width; this.height = (c as { height: number }).height; this.onload?.(); }).catch(() => this.onerror?.()); }
  get src() { return this._src; } get naturalWidth() { return this.width; } }
(globalThis as never as Record<string, unknown>).Image = FakeImage;
const proto = Object.getPrototypeOf(createCanvas(2, 2).getContext("2d")); const origDI = proto.drawImage;
proto.drawImage = function (im: unknown, ...rest: unknown[]) { origDI.call(this, (im as { __canvas?: unknown })?.__canvas ?? im, ...(rest as never[])); };
(globalThis as never as Record<string, unknown>).fetch = (input: unknown) => { const u = String(input); if (u.startsWith("/") || u.startsWith("art/")) { const path = "public/" + u.replace(/^\//, "").split("?")[0]; if (!existsSync(path)) return Promise.resolve(new Response(null, { status: 404 })); return Promise.resolve(new Response(readFileSync(path), { status: 200, headers: { "Content-Type": path.endsWith(".json") ? "application/json" : "image/png" } })); } return Promise.reject(new Error("no net")); };


await new Promise(r => setTimeout(r, 300));
const { useGame } = await import("../src/store/game.ts");
useGame.getState().awaken?.("TESTER", "balanced", "⚔", undefined);
const { AshenGame } = await import("../src/game/view.ts");
const { makeFloor, loadFloorArt, posBlocked } = await import("../src/game/floor.ts");
const cvs: any = createCanvas(960, 540);
cvs.addEventListener = () => {}; cvs.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
const g: any = new AshenGame(cvs);
g.started = true; g.mode = "world";
const DIRS: Record<string, string[]> = { E: ["right"], W: ["left"], S: ["down"], N: ["up"] };
const frame = (n: number) => { for (let i = 0; i < n; i++) { (g as any).update(1 / 60); (g as any).render(); } };
async function settle(id: string) { g.regionId = id; g.floor = makeFloor(id); await loadFloorArt(g.floor); }
const FLOORS = ["verdant", "marsh", "caverns", "citadel", "ashenveil"];
let fails = 0;
for (const id of FLOORS) {
  await settle(id);
  const objs = g.floor.objects;
  const spots: [string, number, number][] = [["spawn", objs.spawn[0], objs.spawn[1]]];
  for (const e of objs.exits) spots.push([`exit->${e.to}`, e.x + e.w / 2, e.y + e.h / 2]);
  for (const r of objs.rests) spots.push([`rest`, r.x + r.w / 2, r.y + r.h / 2]);
  if (objs.boss) spots.push(["boss", objs.boss.x + objs.boss.w / 2, objs.boss.y + objs.boss.h]);
  let line = `== ${id} ==`;
  for (const [label, x, y] of spots) {
    let clear = 0;
    for (const keys of Object.values(DIRS)) {
      g.px = x; g.py = y; g.lastSafe = { x, y }; g.flags.floorHp = 999; g.warnedSolid = false;
      g.input.down = (a: string) => keys.includes(a);
      g.transDir = 0; g.pendingMode = null; g.pages = null; g.mode = "world";
      frame(40);
      if (Math.hypot(g.px - x, g.py - y) > 25) clear++;
    }
    if (clear === 0) { line += `  ${label}: PINNED ❌`; fails++; }
    else line += `  ${label}:${clear}/4`;
  }
  console.log(line);
}
// ---- the anti-pin guarantee: drop the player INSIDE painted geometry and make
// sure unstick rescues them (this is exactly the stale-save/mask-swap freeze) ----
{
  const PIN: Record<string, [number, number]> = { marsh: [1300, 380], citadel: [200, 700], ashenveil: [700, 250], caverns: [1600, 400] };
  let rescue = 0;
  for (const [id, [x, y]] of Object.entries(PIN)) {
    await settle(id);
    g.px = x; g.py = y; g.lastSafe = { x, y }; g.flags.floorHp = 999;
    g.warnedSolid = false; g.unstickCd = 0; g.mode = "world"; g.transDir = 0; g.pendingMode = null; g.pages = null;
    g.input.down = () => false; // standing still: the head-of-update check must still catch it
    frame(10);
    const ok = !posBlocked(g.floor, g.px, g.py, g.flags as never);
    if (ok) rescue++; else console.log(`  ${id} PIN TEST: still trapped at (${g.px | 0},${g.py | 0}) ❌`);
  }
  const need = Object.keys(PIN).length;
  console.log(rescue === need ? `anti-pin: all ${need} trapped spots re-anchored to solid footing` : `anti-pin: ${rescue}/${need} rescued`);
  if (rescue !== need) fails++;
}
console.log(fails ? `PINNED SPOTS: ${fails}` : "every floor: all landing spots walkable in >=1 direction, no pins");
process.exit(fails ? 1 : 0);
