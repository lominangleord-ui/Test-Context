import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, readdirSync } from "node:fs";
const dirs = readdirSync("public/art/actors").filter(d => !d.startsWith("."));
const cols = 7, cell = [152, 216];
const out = createCanvas(cols * cell[0], Math.ceil(dirs.length / cols) * cell[1]);
const g = out.getContext("2d");
g.fillStyle = "#1c1f26"; g.fillRect(0, 0, out.width, out.height);
for (let i = 0; i < dirs.length; i++) {
  const x = (i % cols) * cell[0], y = ((i / cols) | 0) * cell[1];
  for (let cy = 0; cy < cell[1]; cy += 16) for (let cx = 0; cx < cell[0]; cx += 16)
    { g.fillStyle = ((cx + cy) / 16) % 2 ? "#3a3f4a" : "#2a2e37"; g.fillRect(x + cx, y + cy, 16, 16); }
  try {
    const im = await loadImage(`public/art/actors/${dirs[i]}/front.png`);
    g.drawImage(im as never, x + 12, y + 8, 128, 192);
  } catch {}
  g.fillStyle = "#e8ecf2"; g.font = "bold 14px sans-serif"; g.fillText(dirs[i], x + 12, y + cell[1] - 10);
}
writeFileSync("shots/85-fronts.png", out.toBuffer("image/png"));
console.log("sheet", dirs.length, "actors");
