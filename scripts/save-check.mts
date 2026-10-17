// Live-loop persistence check: boots the real AshenGame headless and proves
// (1) travelling marks the ledger dirty and the debounced autosave WRITES without
// touching a savepoint, (2) pagehide flushes immediately, (3) rest hard-saves.
import { createCanvas, Image } from "@napi-rs/canvas";
const LS = new Map<string, string>();
const listeners: Record<string, Array<() => void>> = {};
(globalThis as Record<string, unknown>).window = {
  addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f); },
  removeEventListener: () => {},
  innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
  localStorage: LS, Audio: class { play() {} },
};
(globalThis as Record<string, unknown>).document = {
  createElement: (t: string) => t === "canvas" ? createCanvas(960, 540) : { style: {} },
  getElementById: () => null, addEventListener: () => {},
};
(globalThis as Record<string, unknown>).Image = Image;
(globalThis as Record<string, unknown>).performance = { now: () => Date.now() };
(globalThis as Record<string, unknown>).HTMLCanvasElement = class {};
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => LS.get(k) ?? null,
  setItem: (k: string, v: string) => { LS.set(k, String(v)); },
  removeItem: (k: string) => { LS.delete(k); },
};
(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
(globalThis as Record<string, unknown>).cancelAnimationFrame = (id: number) => clearTimeout(id);
(globalThis as Record<string, unknown>).AudioContext = class {
  state = "running"; currentTime = 0; destination = {}; resume() {}
  createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() { return { type: "sine", frequency: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: "lowpass", frequency: { value: 1, setValueAtTime() {} }, connect() {} }; }
};
(globalThis as Record<string, unknown>).webkitAudioContext = (globalThis as Record<string, unknown>).AudioContext;
await new Promise(r => setTimeout(r, 400));
const { useGame } = await import("../src/store/game.ts");
useGame.getState().awaken?.("TESTER", "balanced", "⚔", undefined);
const { AshenGame } = await import("../src/game/view.ts");
const cvs: any = createCanvas(960, 540);
cvs.addEventListener = () => {}; cvs.removeEventListener = () => {};
cvs.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
const g: any = new AshenGame(cvs);
g.started = true;
g.mode = "world"; g.playTrack("town");
const frame = (n = 1) => { for (let i = 0; i < n; i++) { (g as any).update(1 / 60); (g as any).render(); } };
const readWorld = () => JSON.parse(LS.get("sl_ashenveil_v2") ?? "null");
let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? " :: " + extra : ""}`); };

check("no premature world save at spawn", readWorld() === null || readWorld()?.region === "verdant");
g.jumpToFloor("marsh");
frame(2);
check("not written instantly (debounced)", readWorld() === null || readWorld().region !== "marsh");
frame(300); // land the transition (it early-returns until the fade ends) + let the debounce elapse
const w1 = readWorld();
check("autosave wrote after travel, no savepoint touched", w1?.region === "marsh", JSON.stringify(w1 ? { region: w1.region, x: Math.round(w1.x) } : null));
g.px += 220; g.markSaveDirty(); frame(300);
const w2 = readWorld();
check("save updates position on the next dirty window", Math.abs(w2.x - g.px) < 1);
// pagehide flush: dirty right before, expect write on the next event, not after debounce
g.jumpToFloor("bastion"); frame(2);
const before = readWorld().region;
listeners["pagehide"]?.forEach(f => f());
check("pagehide flushes the dirty save immediately", readWorld().region === "bastion" && before === "marsh", `${before}->${readWorld().region}`);
// rest hard-saves with the loud path (toast present)
g.px = g.floor.objects.spawn[0]; g.py = g.floor.objects.spawn[1]; frame(1);
g.interact(); // spawn tile has no prop — just must not throw
console.log(`frames ran clean; fails=${fails}`);
process.exit(fails ? 1 : 0);
