import { createCanvas, loadImage, Image } from "@napi-rs/canvas";
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
const { makeFloor, loadFloorArt, posBlocked, MASK } = await import("../src/game/floor.ts");
const { Art } = await import("../src/game/artset.ts");
const id = process.argv[2] ?? "verdant";
const fl = makeFloor(id);
await loadFloorArt(fl);
const g = Art.status(`floor:${id}:collision`);
const probes: [string, number, number, number][] = [
  ["spawn (walkable)", fl.objects.spawn[0], fl.objects.spawn[1], MASK.WALK],
];
console.log(id, "collision status:", g, "mask", fl.mask.cw + "x" + fl.mask.ch, "solid cells:", fl.mask.cells.filter((v: number) => v >= 1).length);
for (const [what, x, y, want] of probes) console.log(`  ${what}: blocked=${posBlocked(fl, x, y)} wantWalk=${want === MASK.WALK}`);
