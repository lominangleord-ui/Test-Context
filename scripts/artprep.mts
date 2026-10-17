// artprep — turn raw AI generations into shipped game art:
//   real transparency (flood-key background removal + magenta despill),
//   auto-crop to the subject, letterbox to the slot aspect with the correct
//   anchor, then a filtered scale to the exact pixel size from ART_SPEC.md.
// Raw files are dropped by the generator into public/art/_raw/<family>.<id>[.<pose>].png
// Run: npx tsx scripts/artprep.mts
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";

const RAW = "public/art/_raw";
const OUT = "public/art";

type Spec = {
  family: "actor" | "portrait" | "battle" | "ground";
  w: number; h: number;
  key: string;                       // manifest key template {id} {pose}
  file: string;                      // output template
  removeBg: boolean;
  anchor: "bottom" | "center";
};
const SPECS: Record<Spec["family"], Spec> = {
  actor:    { family: "actor",    w: 128,  h: 192,   key: "actor:{id}:{pose}",              file: "actors/{id}/{pose}.png",             removeBg: true,  anchor: "bottom" },
  portrait: { family: "portrait", w: 384,  h: 384,   key: "portrait:{id}:{pose}",           file: "portraits/{id}/{pose}.png",          removeBg: true,  anchor: "center" },
  battle:   { family: "battle",   w: 512,  h: 512,   key: "battle:{id}",                    file: "enemies/{id}.png",                   removeBg: true,  anchor: "center" },
  ground:   { family: "ground",   w: 1920, h: 1080,  key: "floor:{id}:ground",              file: "floors/{id}/ground.png",             removeBg: false, anchor: "center" },
};

function parse(name: string): { spec: Spec; id: string; pose: string } | null {
  const m = /^(actor|portrait|battle|ground)\.([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]+))?\.png$/.exec(name);
  if (!m) return null;
  return { spec: SPECS[m[1] as Spec["family"]], id: m[2], pose: m[3] ?? "front" };
}

/** Flood from the border over similar colors → alpha 0. Tolerant of gradients. */
function removeBackground(img: ImageDataLike) {
  const { width: w, height: h, data: d } = img;
  const px = (x: number, y: number) => (y * w + x) * 4;
  // sample border colors; key against the median-ish border color
  const samples: number[][] = [];
  for (let x = 0; x < w; x += 7) { samples.push([d[px(x, 0)], d[px(x, 0) + 1], d[px(x, 0) + 2]], [d[px(x, h - 1)], d[px(x, h - 1) + 1], d[px(x, h - 1) + 2]]); }
  for (let y = 0; y < h; y += 7) { samples.push([d[px(0, y)], d[px(0, y) + 1], d[px(0, y) + 2]], [d[px(w - 1, y)], d[px(w - 1, y) + 1], d[px(w - 1, y) + 2]]); }
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const bg = samples[Math.floor(samples.length / 2)];
  const dist = (i: number) => Math.abs(d[i] - bg[0]) * 0.8 + Math.abs(d[i + 1] - bg[1]) * 1.15 + Math.abs(d[i + 2] - bg[2]) * 0.8;
  const tol = 58;
  const seen = new Uint8Array(w * h);
  const q: number[] = [];
  const push = (x: number, y: number) => { const p = y * w + x; if (!seen[p] && dist(p * 4) < tol) { seen[p] = 1; q.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (q.length) {
    const p = q.pop()!;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  for (let p = 0; p < w * h; p++) if (seen[p]) d[p * 4 + 3] = 0;
  // despill: leftover magenta fringe on kept pixels
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 140 && b > 140 && g < (r + b) / 2 - 42) {
      const m = Math.min(r, b) - g; // magenta-ness
      const keep = Math.max(0, 1 - m / 90);
      d[i] = Math.round(g + (r - g) * keep); d[i + 2] = Math.round(g + (b - g) * keep);
      if (keep < 0.35) d[i + 3] = Math.round(d[i + 3] * (0.35 + keep));
    }
  }
}
interface ImageDataLike { width: number; height: number; data: Uint8ClampedArray }

function bbox(img: ImageDataLike, pad: number) {
  const { width: w, height: h, data: d } = img;
  let x0 = w, y0 = h, x1 = 0, y1 = 0, any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 10) { any = true; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (!any) return { x: 0, y: 0, w, h };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

let done = 0, failed = 0;
for (const name of existsSync(RAW) ? readdirSync(RAW) : []) {
  const parsed = parse(name);
  if (!parsed) continue;
  const { spec, id, pose } = parsed;
  try {
    const img = await loadImage(`${RAW}/${name}`);
    const work = createCanvas(img.width, img.height);
    const wg = work.getContext("2d");
    wg.drawImage(img as never, 0, 0);
    let frame = { x: 0, y: 0, w: img.width, h: img.height };
    if (spec.removeBg) {
      const data = wg.getImageData(0, 0, work.width, work.height);
      removeBackground(data as never);
      wg.clearRect(0, 0, work.width, work.height);
      wg.putImageData(data as never, 0, 0);
      frame = bbox(data as never, Math.max(2, Math.round(work.width * 0.015)));
    }
    // fit subject into the slot: scale to cover the content box, then anchor
    const TW = spec.w, TH = spec.h;
    const out = createCanvas(TW, TH);
    const og = out.getContext("2d");
    if (spec.family === "ground") {
      og.imageSmoothingEnabled = true; (og as never as { imageSmoothingQuality: string }).imageSmoothingQuality = "high";
      const s = Math.max(TW / frame.w, TH / frame.h); // cover-crop
      const cw = TW / s, ch = TH / s;
      const cx = frame.x + (frame.w - cw) / 2, cy = frame.y + (frame.h - ch) / 2;
      og.drawImage(work as never, cx, cy, cw, ch, 0, 0, TW, TH);
    } else {
      og.imageSmoothingEnabled = true; (og as never as { imageSmoothingQuality: string }).imageSmoothingQuality = "high";
      const inner = { x: spec.anchor === "bottom" ? TW * 0.06 : 0, y: spec.anchor === "bottom" ? TH * 0.03 : 0 };
      const iw = TW - inner.x * 2, ih = TH - inner.y - (spec.anchor === "bottom" ? TH * 0.02 : 0);
      const s = Math.min(iw / frame.w, ih / frame.h);
      const dw = frame.w * s, dh = frame.h * s;
      const dx = (TW - dw) / 2;
      const dy = spec.anchor === "bottom" ? TH - dh - TH * 0.015 : (TH - dh) / 2;
      og.drawImage(work as never, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
    }
    const dir = `${OUT}/${spec.file.split("/").slice(0, -1).join("/")}`.replace("{id}", id);
    mkdirSync(dir, { recursive: true });
    const path = `${OUT}/${spec.file}`.replace("{id}", id).replace("{pose}", pose);
    writeFileSync(path, out.toBuffer("image/png"));
    done++;
    console.log("built", path);
  } catch (e) {
    failed++;
    console.error("FAILED", name, (e as Error).message);
  }
}
console.log(`artprep: ${done} built, ${failed} failed`);
