// Boss-gate contract: every floor boss shows its number, refuses the unready
// before the hub is seen once, and drops to a signable warning after that.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bossGateDecision, bossGateLines } from "../src/game/gate.ts";
import { FLOOR_IDS } from "../src/game/world.ts";

test("boss gate: open at or above the recommended level, block then warn below it", () => {
  assert.equal(bossGateDecision({ playerLevel: 5, recLevel: 5, hubSeen: false }), "open");
  assert.equal(bossGateDecision({ playerLevel: 9, recLevel: 5, hubSeen: true }), "open");
  assert.equal(bossGateDecision({ playerLevel: 1, recLevel: 5, hubSeen: false }), "block");
  assert.equal(bossGateDecision({ playerLevel: 4, recLevel: 5, hubSeen: true }), "warn");
  assert.equal(bossGateDecision({ playerLevel: 1, recLevel: 5, hubSeen: true }), "warn", "seen hub = soft gate, never a wall");
  assert.equal(bossGateDecision({ playerLevel: 3, recLevel: 30, hubSeen: false }), "block");
  assert.equal(bossGateDecision({ playerLevel: 30, recLevel: Number.NaN, hubSeen: false }), "open", "no recommendation = no friction");
});

test("boss gate lines name BOTH numbers and the lever (training) they move", () => {
  const block = bossGateLines("THE WARDEN", 38, 2, "block");
  const all = block.map((l) => l.text).join(" ");
  assert.ok(all.includes("38") && all.includes("2"), "both levels spelled out");
  assert.ok(/TRAIN/i.test(all) && /SP/i.test(all), "says training raises level, kills pay SP");
  assert.ok(block[0].who === "SYSTEM", "the System speaks the first line");
  const warn = bossGateLines("THE WARDEN", 38, 36, "warn");
  assert.equal(warn.length, 1, "the soft gate is one honest warning, not a sermon");
  assert.ok(warn[0].text.includes("36") && warn[0].text.includes("38"));
});

test("every art floor boss carries a recommended level on its ledger", () => {
  for (const id of FLOOR_IDS) {
    let j: { boss?: { level?: number } };
    try { j = JSON.parse(readFileSync(join(import.meta.dirname, "..", "public", "art", "floors", id, "objects.json"), "utf8")); }
    catch { continue; }
    if (!j.boss) continue;
    assert.ok(typeof j.boss.level === "number" && j.boss.level >= 1, `${id}: boss needs a numeric level for the gate math`);
  }
});
