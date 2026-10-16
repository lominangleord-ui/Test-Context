// floorcheck — composite render: painted ground + F3-style mask overlay + entity
// markers, one PNG per floor, for visual verification against the art.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
// minimal DOM + public-root fetch shim so the REAL game loader runs headless
(globalThis as never as Record<string, unknown>).document = { createElement: (t: string) => (t === "canvas" ? createCanvas(1, 1) : { style: {}, setAttribute() {}, appendChild() {}, remove() {} }), addEventListener() {}, removeEventListener() {}, hidden: false, body: { appendChild() {} } };
class FakeImage {
  onload: (() => void) | null = null; onerror: (() => void) | null = null; width = 0; height = 0;
  private _src = "";
  set src(v: string) {
    this._src = v;
    const path = "public/" + v.replace(/^\//, "").split("?")[0];
    if (!existsSync(path)) { this.onerror?.(); return; }
    loadImage(path).then((c) => { (this as never as { __canvas: unknown }).__canvas = c; this.width = (c as { width: number }).width; this.height = (c as { height: number }).height; this.onload?.(); }).catch(() => this.onerror?.());
  }
  get src() { return this._src; }
  get naturalWidth() { return this.width; }
}
(globalThis as never as Record<string, unknown>).Image = FakeImage;
const proto = Object.getPrototypeOf(createCanvas(2, 2).getContext("2d"));
const origDI = proto.drawImage;
proto.drawImage = function (im: unknown, ...rest: unknown[]) { origDI.call(this, (im as { __canvas?: unknown })?.__canvas ?? im, ...(rest as never[])); };
(globalThis as never as Record<string, unknown>).fetch = (input: unknown) => {
  const u = String(input);
  if (u.startsWith("/") || u.startsWith("art/")) {
    const path = "public/" + u.replace(/^\//, "").split("?")[0];
    if (!existsSync(path)) return Promise.resolve(new Response(null, { status: 404 }));
    return Promise.resolve(new Response(readFileSync(path), { status: 200, headers: { "Content-Type": path.endsWith(".json") ? "application/json" : "image/png" } }));
  }
  return Promise.reject(new Error("no net"));
};
mkdirSync("shots", { recursive: true });
const { makeFloor } = await import("../src/game/floor.ts");
const { loadFloorArt } = await import("../src/game/floor.ts");
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["verdant", "marsh", "caverns", "citadel", "ashenveil"]) {
  const { makeFloor, T, TY } = await import("../src/game/floor.ts");
  const fl = makeFloor(id);
  const ground = await loadImage(`public/art/floors/${id}/ground.png`);
  const W = ground.width, H = ground.height;
  const col = await loadImage(`public/art/floors/${id}/collision.png`);
  const mc = createCanvas(col.width, col.height);
  const mg = mc.getContext("2d");
  mg.drawImage(col as never, 0, 0);
  const md = mg.getImageData(0, 0, col.width, col.height).data;
  const out = createCanvas(W, H);
  const g = out.getContext("2d");
  g.drawImage(ground as never, 0, 0);
  // loader classify (must mirror src/game/floor.ts): water/solid/hazard/exit/luma
  const cwpx = W / col.width, chpx = H / col.height;
  const COL: Record<number, string> = { 1: "rgba(0,0,0,0.55)", 2: "rgba(30,70,220,0.55)", 3: "rgba(228,48,48,0.5)", 4: "rgba(46,204,92,0.6)" };
  for (let cy = 0; cy < col.height; cy++) for (let cx = 0; cx < col.width; cx++) {
    const i = (cy * col.width + cx) * 4;
    const r = md[i], gg = md[i + 1], b = md[i + 2];
    if (md[i + 3] >= 128 && b > 120 && b > r + 28 && b > gg + 18) { g.fillStyle = COL[2]; g.fillRect(cx * cwpx, cy * chpx, cwpx + 1, chpx + 1); continue; }
    if (md[i + 3] >= 128 && r > 120 && r > gg + 40 && r > b + 40) { g.fillStyle = COL[3]; g.fillRect(cx * cwpx, cy * chpx, cwpx + 1, chpx + 1); continue; }
    if (md[i + 3] >= 128 && gg > 110 && gg > r + 30 && gg > b + 30) { g.fillStyle = COL[4]; g.fillRect(cx * cwpx, cy * chpx, cwpx + 1, chpx + 1); continue; }
    const luma = (r + gg + b) / 3;
    if (md[i + 3] >= 128 && luma >= 128) continue;
    g.fillStyle = md[i + 3] >= 128 ? COL[1] : "rgba(255,0,255,0.5)";
    g.fillRect(cx * cwpx, cy * chpx, cwpx + 1, chpx + 1);
  }
  const label = (x: number, y: number, text: string, color: string) => {
    g.fillStyle = color; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#000"; g.font = "bold 13px sans-serif"; g.fillText(text, x + 10, y + 4);
  };
  const S = fl.objects;
  const O = JSON.parse(readFileSync(`public/art/floors/${id}/objects.json`, "utf8"));
  for (const n of O.npcs) label(n.x, n.y, n.id, "#ffd88a");
  if (O.boss) label(O.boss.x + O.boss.w / 2, O.boss.y + O.boss.h, "BOSS " + O.boss.id, "#ff6a6a");
  for (const e of O.exits) label(e.x + e.w / 2, e.y + e.h / 2, "EXIT→" + e.to, "#7dffb0");
  for (const r of O.rests) label(r.x + r.w / 2, r.y + r.h / 2, "REST", "#7fe7ff");
  label(O.spawn[0], O.spawn[1], "SPAWN", "#ffffff");
  for (const p of O.props) if (p.interactId) label(p.x + p.w / 2, p.y + p.h / 2, p.interactId, "#c79bff");
  for (const sg of O.signs) label(sg.x, sg.y, "sign", "#9aa7b5");
  g.strokeStyle = "rgba(255,216,138,0.8)"; g.lineWidth = 3;
  for (const z of O.zones) g.strokeRect(z.x, z.y, z.w, z.h);
  g.fillStyle = "rgba(255,216,138,0.8)"; g.font = "bold 16px sans-serif";
  for (const z of O.zones) g.fillText("zone:" + z.id, z.x + 6, z.y + 20);
  const small = createCanvas(Math.round(W / 2), Math.round(H / 2));
  small.getContext("2d").drawImage(out as never, 0, 0, W, H, 0, 0, small.width, small.height);
  writeFileSync(`shots/80-fit-${id}.png`, small.toBuffer("image/png"));
  console.log("wrote", `shots/80-fit-${id}.png`, "maskcw", fl.mask.cw, "cells", fl.mask.cells.length);
}
