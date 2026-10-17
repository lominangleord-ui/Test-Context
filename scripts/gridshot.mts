// gridshot — ground.png with a labelled coordinate grid every 80 world units,
// for polygon tracing. Run: npx tsx scripts/gridshot.mts [floorIds...]
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("shots", { recursive: true });
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["verdant", "marsh", "caverns", "citadel", "ashenveil"]) {
  const ground = await loadImage(`public/art/floors/${id}/ground.png`);
  const c = createCanvas(1920, 1080); const g = c.getContext("2d");
  g.drawImage(ground as never, 0, 0, 1920, 1080);
  g.lineWidth = 1; g.font = "bold 13px monospace";
  for (let x = 0; x <= 1920; x += 80) {
    g.strokeStyle = x % 320 === 0 ? "rgba(255,255,120,0.85)" : "rgba(255,255,120,0.4)";
    g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 1080); g.stroke();
    if (x % 160 === 0) { g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(x + 2, 2, 34, 15); g.fillStyle = "#ffe98a"; g.fillText(String(x), x + 4, 14); }
  }
  for (let y = 0; y <= 1080; y += 80) {
    g.strokeStyle = y % 320 === 0 ? "rgba(255,255,120,0.85)" : "rgba(255,255,120,0.4)";
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(1920, y + 0.5); g.stroke();
    if (y % 160 === 0 && y > 0) { g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(2, y + 2, 34, 15); g.fillStyle = "#ffe98a"; g.fillText(String(y), 4, y + 14); }
  }
  const small = createCanvas(1280, 720);
  small.getContext("2d").drawImage(c as never, 0, 0, 1920, 1080, 0, 0, 1280, 720);
  writeFileSync(`shots/86-grid-${id}.png`, small.toBuffer("image/png"));
  console.log("grid:", id);
}
