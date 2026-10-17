// portwire — one-off: center-crop shipped V2 portraits/boss plates into
// public/art/portraits/<id>/talk.png (384×384, no bg removal — these are full
// framing paintings), so dialogue boxes show real faces instead of placeholders.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
const MAP: [string, string][] = [
  ["seo", "public/art/npc-handler.jpg"],
  ["kang", "public/art/npc-mentor.jpg"],
  ["hobgoblin", "public/art/boss-hobgoblin.jpg"],
  ["sentinel", "public/art/boss-sentinel.jpg"],
  ["irontusk", "public/art/boss-irontusk.jpg"],
  ["warden", "public/art/boss-warden.jpg"],
];
for (const [id, src] of MAP) {
  const im = await loadImage(src);
  const S = Math.min(im.width, im.height);
  const sx = (im.width - S) / 2, sy = Math.max(0, (im.height - S) / 2 - S * 0.06); // bias up: headroom
  const out = createCanvas(384, 384);
  out.getContext("2d").drawImage(im as never, sx, sy, S, S, 0, 0, 384, 384);
  mkdirSync(`public/art/portraits/${id}`, { recursive: true });
  writeFileSync(`public/art/portraits/${id}/talk.png`, out.toBuffer("image/png"));
  console.log("portrait wired:", id);
}
