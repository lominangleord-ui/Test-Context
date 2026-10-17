// artlink — scan public/art/ and regenerate public/art/manifest.json from the
// files that actually exist (per ART_SPEC.md layout). Idempotent; preserves a
// "music" section if the manifest had one. Run after dropping art files.
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = "public/art";
const assets: Record<string, string> = {};
const walk = (d: string): string[] =>
  existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])) : [];

for (const f of walk(ROOT)) {
  if (f.includes("/_raw/") || !f.endsWith(".png")) continue;
  const rel = f.slice(`${ROOT}/`.length);
  let m = /^actors\/([^/]+)\/(front|back|side)\.png$/.exec(rel);
  if (m) { assets[`actor:${m[1]}:${m[2]}`] = rel; continue; }
  m = /^portraits\/([^/]+)\/(talk|neutral|hurt|special)\.png$/.exec(rel);
  if (m) { assets[`portrait:${m[1]}:${m[2]}`] = rel; continue; }
  m = /^enemies\/([^/]+)\.png$/.exec(rel);
  if (m) { assets[`battle:${m[1]}`] = rel; continue; }
  m = /^props\/([^/]+)\.png$/.exec(rel);
  if (m) { assets[`prop:${m[1]}`] = rel; continue; }
  m = /^parts\/([^/]+)\/([a-z]+)[._]?(v\d+)?[._-]?(front|back|side)?\.png$/.exec(rel);
  if (m) { assets[`playerpart:${m[1]}:${m[2]}:${m[4] ?? "front"}`] = rel; continue; }
  m = /^floors\/([^/]+)\/(ground|overlay|collision|ground_cx_cy)\.png$/.exec(rel);
  if (m) { assets[`floor:${m[1]}:${m[2]}`] = rel; continue; }
  m = /^floors\/([^/]+)\/objects\.json$/.exec(rel);
  if (m) { assets[`floor:${m[1]}:objects`] = rel; continue; }
}
// every actor gets the standard trio of keys pointed at whatever facing exists
for (const id of new Set(Object.keys(assets).filter((k) => k.startsWith("actor:")).map((k) => k.split(":")[1]))) {
  const pick = ["front", "back", "side"].find((f) => assets[`actor:${id}:${f}`]) ?? "front";
  for (const f of ["front", "back", "side"]) if (!assets[`actor:${id}:${f}`]) assets[`actor:${id}:${f}`] = assets[`actor:${id}:${pick}`];
  // talk/neutral portraits alias to each other so pages never flash a placeholder between moods
  const p = assets[`portrait:${id}:talk`] ?? assets[`portrait:${id}:neutral`];
  if (p) { assets[`portrait:${id}:talk`] ??= p; assets[`portrait:${id}:neutral`] ??= p; }
}

let music: unknown = undefined;
try {
  const prev = JSON.parse(readFileSync(`${ROOT}/manifest.json`, "utf8"));
  if (prev?.music) music = prev.music;
} catch { /* first run */ }

const manifest = {
  $generated: "public/art/manifest.json is rewritten from disk by scripts/artlink.mts — drop files per ART_SPEC.md, run npx tsx scripts/artlink.mts, done.",
  assets,
  ...(music ? { music } : {}),
};
writeFileSync(`${ROOT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`artlink: ${Object.keys(assets).length} keys wired into manifest`);
