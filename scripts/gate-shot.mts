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
const A = g as unknown as Record<string, (...a: never[]) => unknown> & Record<string, unknown>;
g.start();
await frames(20);
const readBoss = (id: string) => JSON.parse(readFileSync(`public/art/floors/${id}/objects.json`, "utf8")).boss;

// 90 — verdant arrival: growth chip + hint panel
A.jumpToFloor("verdant"); await frames(30);
shot("90-gate-verdant-arrival");

// stand on the hobgoblin pad: prompt label first, then the BLOCK dialogue
const vb = readBoss("verdant");
A.warpPlayer(vb.x + vb.w / 2, vb.y + vb.h / 2); await frames(4);
shot("91-gate-verdant-prompt");
A.interact(); await frames(80);
shot("92-gate-verdant-block");
console.log("mode after block:", A.mode);

// hub check-in seen once -> soft warn with sign/back-out choice
(A.flags as { met: Record<string, number> }).met["seo.verdant"] = 1;
A.interact(); await frames(20);           // SYSTEM warn line, let it type
for (let i = 0; i < 6; i++) { A.input.press("confirm", true); await frames(3); A.input.press("confirm", false); await frames(4); }
shot("93-gate-verdant-warn-choice");
console.log("mode after warn:", A.mode);

// citadel: prompt shows BRICKED/BOSS FIRST + the door number under the minimap
A.jumpToFloor("citadel"); await frames(30);
const cb = readBoss("citadel");
A.warpPlayer(cb.x + cb.w / 2, cb.y + cb.h / 2 + 26); await frames(4);
shot("94-gate-citadel-door");

process.exit(0);
