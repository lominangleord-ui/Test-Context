// Headless visual verification for the Ashenveil game: boots the real
// AshenGame class under a minimal DOM shim (@napi-rs/canvas) and saves frames
// of every screen state as PNGs for human/agent inspection.
// Run: npx tsx scripts/game-shot.mts
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";

const SHOTS = "shots";
mkdirSync(SHOTS, { recursive: true });

const rafQueue: ((t: number) => void)[] = [];
let fakeNow = 0;

const elemStub = () => ({
  style: {} as Record<string, unknown>,
  setAttribute() {}, appendChild() {}, remove() {}, click() {},
  textContent: "",
});
(globalThis as never as Record<string, unknown>).document = {
  createElement: (tag: string) => (tag === "canvas" ? createCanvas(1, 1) : elemStub()),
  hidden: false,
  body: { appendChild() {} },
  addEventListener() {}, removeEventListener() {},
};
// serve /art/... like the vite public/ root would, so manifest-driven art is visible headless
import { readFileSync } from "node:fs";
const origFetch = (globalThis as never as { fetch?: typeof fetch }).fetch;
(globalThis as never as Record<string, unknown>).fetch = (input: unknown, ...rest: unknown[]) => {
  const u = String((input as { url?: string })?.url ?? input);
  if (u.startsWith("/") || u.startsWith("art/")) {
    const path = `public/${u.replace(/^\//, "").split("?")[0]}`;
    try {
      const buf = readFileSync(path);
      return Promise.resolve(new Response(buf, { status: 200, headers: { "Content-Type": path.endsWith(".json") ? "application/json" : "image/png" } }));
    } catch { return Promise.resolve(new Response(null, { status: 404 })); }
  }
  return (origFetch as (...a: unknown[]) => unknown)!(input, ...rest);
};
class FakeImage {
  onload: (() => void) | null = null;
  width = 0; height = 0;
  __canvas: unknown = null;
  private _src = "";
  set src(v: string) {
    this._src = v;
    const path = v.startsWith("/") ? `public${v}` : `public/${v}`;
    loadImage(path).then((c) => {
      this.__canvas = c; this.width = c.width; this.height = c.height;
      this.onload?.();
    }).catch((e) => console.error("image load failed", path, e));
  }
  get src() { return this._src; }
  get naturalWidth() { return this.width; }
}
(globalThis as never as Record<string, unknown>).Image = FakeImage;
// unwrap FakeImage wherever napi expects an image source
const napiCtxProto = Object.getPrototypeOf(createCanvas(2, 2).getContext("2d"));
const origDrawImage = napiCtxProto.drawImage;
napiCtxProto.drawImage = function (img: unknown, ...rest: unknown[]) {
  const real = (img as { __canvas?: unknown })?.__canvas ?? img;
  return origDrawImage.call(this, real, ...rest);
};
(globalThis as never as Record<string, unknown>).window = {
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  location: { href: "http://localhost/", origin: "http://localhost" },
};
try { Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node-shot", clipboard: { writeText: async () => {} }, addEventListener() {}, removeEventListener() {} }, configurable: true }); } catch { /* node's own navigator stays */ }
const ls = new Map<string, string>();
(globalThis as never as Record<string, unknown>).localStorage = {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, String(v)); },
  removeItem: (k: string) => { ls.delete(k); },
};
(globalThis as never as Record<string, unknown>).performance = { now: () => fakeNow };
(globalThis as never as Record<string, unknown>).requestAnimationFrame = (f: (t: number) => void) => { rafQueue.push(f); return rafQueue.length; };
(globalThis as never as Record<string, unknown>).cancelAnimationFrame = () => { rafQueue.length = 0; };

const canvas = createCanvas(640, 480);
// DOM-event + style affordances the real canvas carries but napi doesn't (editor mounts here)
(canvas as never as Record<string, unknown>).style ??= {};
(canvas as never as Record<string, unknown>).getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
(canvas as never as Record<string, unknown>).addEventListener = () => {};
(canvas as never as Record<string, unknown>).removeEventListener = () => {};

async function frames(n: number) {
  for (let i = 0; i < n; i++) {
    fakeNow += 16.7;
    const q = rafQueue.splice(0, rafQueue.length);
    for (const f of q) { try { f(fakeNow); } catch (e) { console.error("frame err", e); process.exitCode = 1; } }
    if (i % 8 === 7) await Promise.resolve();
  }
  await new Promise((r) => setTimeout(r, 30));
  await Promise.resolve(); await Promise.resolve();
}
const shot = (name: string) => {
  writeFileSync(`${SHOTS}/${name}.png`, canvas.toBuffer("image/png"));
  console.log("saved", name);
};

const { AshenGame } = await import("../src/game/view.ts");
const { ENDINGS, NPC } = await import("../src/game/script.ts");
const { useGame } = await import("../src/store/game.ts");

useGame.getState().awaken?.("TESTER", "balanced", "⚔", undefined);
const g = new (AshenGame as never as new (c: unknown) => AshenGame & Record<string, never>)(canvas);
const A = g as unknown as Record<string, () => void> & Record<string, unknown>;
g.start();
(A.flags as Record<string, unknown>).created = true; // legacy shots skip the locker-room mirror
await frames(20);
shot("01-boot");

// start → skip intro
A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2);
for (let i = 0; i < 60 && A.mode !== "world"; i++) {
  A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(3);
}
console.log("mode after intro:", A.mode);
(A.jumpToFloor as (id: string) => void).call(g, "ashenveil");
await frames(14);
console.log("legacy shots region:", A.regionId);
shot("02-town-spawn");

// walk up the plaza
A.input.press("up", true); await frames(50); A.input.press("up", false); await frames(6);
shot("03-walk-plaza");

// river + bridge view
A.px = 31.6 * 16; A.py = 21.5 * 16; A.cam.x = A.px - 320; A.cam.y = A.py - 240; await frames(4);
shot("04-bridge");

// ridge gate (closed) + hint
A.px = 31.6 * 16; A.py = 14.6 * 16; A.dir = "up"; A.cam.y = A.py - 200; await frames(4);
shot("05-gate-closed");
A.interact(); await frames(24);
shot("06-gate-hint");
A.mode = "world"; A.pages = null;

// inn front + NPC talk
A.px = 13.5 * 16 + 8; A.py = 33 * 16; A.dir = "up"; A.cam.x = A.px - 320; A.cam.y = A.py - 260; await frames(3);
A.interact(); await frames(40);
shot("07-talk-npc");
A.mode = "world"; A.pages = null;

// shop
A.px = 25.5 * 16 + 8; A.py = 35.5 * 16; A.dir = "up"; A.cam.x = A.px - 300; A.cam.y = A.py - 240; await frames(3);
A.interact();
for (let i = 0; i < 10 && A.mode !== "shop"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(3); }
shot("08-shop");
A.mode = "world"; A.pages = null;

// forest edge with pines + player occlusion
A.px = 26 * 16; A.py = 47.5 * 16; A.cam.x = A.px - 320; A.cam.y = A.py - 240; await frames(3);
shot("09-pines");

// —— random battle flow: force an encounter ——
A.steps = 99999; A.encCooldown = 0;
A.input.press("up", true); await frames(14); A.input.press("up", false);
if (A.mode !== "battle") { (A.beginBattle as (id: string, lv: number) => void).call(g, "hound", 3); await frames(4); }
console.log("battle mode:", A.mode, "enemy:", (A.battle as { enemy: { id: string } })?.enemy?.id);
shot("10-battle-intro");
for (let i = 0; i < 8 && (A.battle as { phase: string }).phase === "dialogue"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); }
shot("11-battle-menu");
// open ACT submenu
A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2);
shot("12-battle-submenu");
// pick Check → enemy turn board
A.input.press("confirm", true); await frames(2); A.input.press("confirm", false);
for (let i = 0; i < 6 && (A.battle as { phase: string }).phase !== "enemyTurn"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); }
await frames(50);
shot("13-battle-board");

// FIGHT timing bar: page through, menu → FIGHT → Z mid-swing
for (let i = 0; i < 12 && (A.battle as { phase: string }).phase !== "menu"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(3); }
const bt = A.battle as { menu: number; phase: string; bar: { pos: number } };
bt.menu = 0;
A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); // open
A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(12); // Fight → target
shot("14-target-bar");
A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(8);
shot("15-hit-flash");
// finish the fight by force for a victory frame
for (let i = 0; i < 40 && !(bt as unknown as { over: boolean }).over; i++) {
  const p = (bt as unknown as { phase: string }).phase;
  if (p === "dialogue") { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); }
  else if (p === "enemyTurn") await frames(40);
  else if (p === "menu") { (bt as unknown as { menu: number }).menu = 0; A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); A.input.press("confirm", true); await frames(3); A.input.press("confirm", false); bt.bar.pos = 0; A.input.press("confirm", true); await frames(3); A.input.press("confirm", false); await frames(6); }
  else break;
}
shot("16-battle-end");

// boss board (kesh) — jump straight in
(A.beginBattle as (id: string, lv: number) => void).call(g, "kesh", 12);
await frames(6);
for (let i = 0; i < 8 && (A.battle as { phase: string }).phase === "dialogue"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); }
{ const m = A.battle as { menu: number; phase: string }; m.menu = 1; A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); }
for (let i = 0; i < 8 && (A.battle as { phase: string }).phase !== "enemyTurn"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); }
await frames(60);
shot("17-boss-board");

// end the boss abruptly → world
A.battle = null; A.mode = "world"; A.pages = null;

// status panel
A.mode = "status"; await frames(3);
shot("18-status");
A.mode = "world";

// obelisk save flash + east portal
A.px = 31 * 16 + 8; A.py = 29.5 * 16; A.dir = "up"; A.cam.x = A.px - 320; A.cam.y = A.py - 240; await frames(3);
A.interact(); await frames(6);
shot("19-save");
A.px = 57 * 16; A.py = 28 * 16; A.dir = "up"; A.cam.x = A.px - 380; A.cam.y = A.py - 250; await frames(4);
shot("20-portal");

// pacifist ending render
A.mode = "ending"; A.pages = { lines: ENDINGS.pacifist, idx: 1, t: 999 }; await frames(4);
shot("21-ending");
A.mode = "world"; A.pages = null;

// death screen render
A.mode = "over"; A.pages = { lines: ENDINGS.gameover, idx: 0, t: 999 }; await frames(4);
shot("22-death");

// ═══════════ EXPEDITION: five-floor walkthrough ═══════════
const W = await import("../src/game/world.ts");
const jump = (id: string) => {
  A.transDir = 0; A.pendingMode = null;
  (A.jumpToFloor as (id: string) => void).call(g, id);
  A.mode = "world"; A.pages = null; A.battle = null; A.choice = null; A.encCooldown = 0.2;
};
const place = (x: number, y: number, dir?: "up" | "down" | "left" | "right") => {
  // design px from the 1024² era → world units, then spiral to the nearest
  // standable ground: placeholder geometry may move; shots must not pose in a wall
  const fl = A.floor as { w: number; h: number; mask: unknown };
  let X = Math.min(fl.w - 20, Math.max(20, x * 1.875)), Y = Math.min(fl.h - 16, Math.max(16, y * 1.9775));
  const blocked = (wx: number, wy: number) => (W.posBlocked as (f: never, a: number, b: number, c: never) => boolean)(fl as never, wx, wy, A.flags as never);
  if (blocked(X, Y)) {
    outer: for (let r = 20; r < 1200; r += 20) for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const nx = X + Math.cos(ang) * r, ny = Y + Math.sin(ang) * r;
      if (nx > 20 && nx < fl.w - 20 && ny > 16 && ny < fl.h - 16 && !blocked(nx, ny)) { X = nx; Y = ny; break outer; }
    }
  }
  (A.warpPlayer as (x: number, y: number) => void).call(g, X, Y);
  if (dir) A.dir = dir;
};
// leave the death screen from the legacy section
A.mode = "world"; A.pages = null; A.battle = null;

jump("verdant"); await frames(24);
place(504, 906); await frames(6);
shot("40-verdant-spawn");
place(31 * 16 + 8, 8.5 * 16, "up"); await frames(6);
shot("41-verdant-boss");
place(36 * 16, 45 * 16, "up"); await frames(6);
shot("42-verdant-camp");
useGame.setState({ level: 6 }); // S1: a LV1 vs the floor band's old 3 crawler is a LOSE by design — the demo fights at the honest edge
(A.beginBattle as (id: string, lv: number, b?: boolean) => void).call(g, "crawler", 1); await frames(4);
shot("43-crawler-intro");
for (let i = 0; i < 8 && (A.battle as { phase: string }).phase === "dialogue"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); }
shot("44-crawler-menu");
{ const bt = A.battle as { menu: number; phase: string; bar: { pos: number } }; bt.menu = 0; A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(2); A.input.press("confirm", true); await frames(3); A.input.press("confirm", false); await frames(10); shot("45-crawler-bar"); A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(10); }
for (let i = 0; i < 90 && !(A.battle as { over: boolean }).over; i++) { const ph = (A.battle as { phase: string }).phase; if (ph === "dialogue") { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); } else if (ph === "enemyTurn") await frames(60); else if (ph === "menu") { (A.battle as { menu: number }).menu = 0; A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); (A.battle as { bar: { pos: number } }).bar.pos = 0; A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(6); } else break; }
shot("46-crawler-end");
A.battle = null; A.mode = "world"; A.pages = null;
// resonance demo: level 9 vs a level-3 rhound at half HP (gap 6 — past the Clause 7 threshold of 5)
useGame.setState({ level: 9 });
(A.beginBattle as (id: string, lv: number, b?: boolean) => void).call(g, "rhound", 3); await frames(4);
{ const b = A.battle as { player: { hp: number; maxHp: number }; phase: string }; while ((A.battle as { phase: string }).phase === "dialogue") { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); } b.player.hp = Math.floor(b.player.maxHp * 0.4); await frames(10); }
shot("47-resonance");
A.battle = null; A.mode = "world"; A.pages = null;
useGame.setState({ level: 1 });
(A.beginBattle as (id: string, lv: number, b?: boolean) => void).call(g, "hobgoblin", 5, true); await frames(4);
for (let i = 0; i < 12 && (A.battle as { phase: string; msgs: unknown[] }).msgs.length > 0 && (A.battle as { phase: string }).phase === "dialogue"; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(1); }
shot("48-hobgoblin");
A.battle = null; A.mode = "world"; A.pages = null;

jump("marsh"); await frames(24);
place(37 * 16, 8 * 16); await frames(6);
shot("49-marsh-boardwalk");
place(44 * 16, 28 * 16, "up"); await frames(6);
shot("50-marsh-village");
place(29 * 16 + 8, 20 * 16, "up"); await frames(6);
shot("51-marsh-idol");

jump("caverns"); await frames(24);
place(7 * 16, 6 * 16); await frames(6);
shot("52-cave-entry");
place(10 * 16, 29 * 16); await frames(6);
shot("53-cave-hall");
place(45 * 16, 52 * 16); await frames(6);
shot("54-cave-bosshall");
place(28 * 16, 17 * 16, "down"); await frames(6);
shot("55-cave-kang");
// real dialogue panel: stand in front of the professor and press Z — proves wrap+paginate on live prose
{ const fl = A.floor as { objects: { npcs: { dialogue: string; x: number; y: number }[] } };
  const kang = fl.objects.npcs.find((n) => n.dialogue.includes("kang"));
  if (kang) {
    place(kang.x / 1.875, (kang.y + 26) / 1.9775, "up");
    (A.interact as () => void).call(g); await frames(8);
    shot("55b-kang-talk");
    for (let i = 0; i < 3; i++) { A.input.press("confirm", true); await frames(2); A.input.press("confirm", false); await frames(10); }
    shot("55c-kang-talk-page2");
    A.mode = "world"; A.pages = null;
  } }

jump("citadel"); await frames(24);
place(31.5 * 16, 52 * 16); await frames(6);
shot("56-citadel-hall");
place(31 * 16, 13 * 16, "up"); await frames(6);
shot("57-citadel-throne");
A.choice = { lines: [], idx: 9, t: 0, opts: [{ label: "ACCEPT THE CLASS", run: () => {} }, { label: "REFUSE IT", run: () => {} }], sel: 1 };
A.mode = "choice"; await frames(4);
shot("58-ceremony-choice");
A.mode = "world"; A.choice = null;
A.mode = "status"; await frames(4);
shot("59-status-citadel");
A.mode = "world";
{ const fl = A.flags as Record<string, unknown>; const bd = fl.bossDown as Record<string, boolean>; bd["hobgoblin"] = bd["sentinel"] = true; }
(A.beginBattle as (id: string, lv: number, b?: boolean) => void).call(g, "bat", 22, false); await frames(4);
shot("60-bat-mercy");
A.battle = null; A.mode = "world"; A.pages = null;
jump("ashenveil"); await frames(24);
place(504, 552); await frames(4);
shot("61-ash-return");
A.showColl = true; await frames(4);
shot("62-ash-f3");
A.showColl = false;

// ═══════════ WORLD V2 DELIVERABLE: every placeholder floor × F3 overlay ═══════════
for (const fid of ["verdant", "marsh", "caverns", "citadel", "ashenveil"]) {
  jump(fid); await new Promise((r) => setTimeout(r, 450)); await frames(10);
  shot(`70-floor-${fid}`);
  A.showColl = true; await frames(3);
  shot(`71-floor-${fid}-f3`);
  A.showColl = false;
}

// ═══════════ EDITOR MOUNT: dev tools attach to the live view (dev-only in game) ═══════════
{
  A.editorAllowed = true;
  const m = await import("../src/game/editor.ts");
  const ed = new m.FloorEditor(g as never);
  (A as Record<string, unknown>).editor = ed;
  ed.open = true;
  ed.reloadDraftFor(A.regionId as string);
  await frames(10);
  shot("72-editor-overlay");
  ed.tool = "propRect";
  (ed as never as Record<string, unknown>).paintStroke?.(1); // no-op when private API shifts; the overlay render is the proof
  const fl = A.floor as { objects: unknown };
  (A.applyFloorObjects as (o: never) => void).call(g, structuredClone(fl.objects)); // round-trip: export → import the same file
  await frames(4);
  shot("73-editor-after-roundtrip");
  ed.open = false; ed.destroy();
  (A as Record<string, unknown>).editor = null;
}

// sprite atlas dump: draw player frames + npc palettes big on black
A.mode = "world"; await frames(2);
const atlas = createCanvas(640, 480);
const ac = atlas.getContext("2d");
ac.fillStyle = "#101423"; ac.fillRect(0, 0, 640, 480);
const sprites = A.sprites as Record<string, { width: number; height: number }[]>;
let ix = 10, iy = 10;
for (const k of Object.keys(sprites)) {
  const arr = sprites[k];
  if (!Array.isArray(arr)) continue;
  for (const s of arr) { ac.drawImage(s as never, ix, iy, 64, 64); ix += 70; if (ix > 570) { ix = 10; iy += 74; } }
  ac.fillStyle = "#7fe7ff"; ac.font = "10px monospace";
  ac.fillText(k, ix, iy + 40);
}
writeFileSync(`${SHOTS}/30-sprite-atlas.png`, atlas.toBuffer("image/png"));
console.log("saved 30-sprite-atlas");

// ---------- V3: creation, pointer, journal, art status ----------
{
  A.flags.created = false;
  (A.openCreator as () => void).call(g);
  await frames(10);
  shot("75-creator");
  (A.commitCreator as () => void).call(g);
  await frames(4);
  (A.jumpToFloor as (id: string) => void).call(g, "verdant");
  await new Promise((r) => setTimeout(r, 500)); await frames(12);
  // objective pointer: the check-in marker + distance label
  A.pointerOn = true;
  await frames(6);
  shot("76-pointer");
  // journal
  (A as unknown as { mode: string }).mode = "journal";
  A.journalSel = 3;
  await frames(4);
  shot("77-journal");
  (A as unknown as { mode: string }).mode = "world";
  // F4 art status panel
  A.artPanel = true;
  await frames(4);
  shot("78-art-status");
  A.artPanel = false;
  console.log("v3 shots done");
}
console.log("done. mode:", A.mode);
process.exit(process.exitCode ?? 0);

