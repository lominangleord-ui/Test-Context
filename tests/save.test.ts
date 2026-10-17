// The expedition save envelope: write/read round-trip through core's writeSave/readSave
// (exactly what AshenGame uses), partial-flag merge against freshFlags, and the shape
// the boot flow depends on (region + parked x/y + flags).
import assert from "node:assert/strict";
import { test } from "node:test";

// localStorage stub for node BEFORE importing anything that touches it at call time
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
};

const { writeSave, readSave } = await import("../src/game/core.ts");
const { freshFlags } = await import("../src/game/world.ts");

test("expedition save round-trips through writeSave/readSave untouched", () => {
  const flags = freshFlags() as unknown as Record<string, unknown>;
  flags.met = { "seo.verdant": 1 };
  (flags as { bossDown: Record<string, boolean> }).bossDown = { hobgoblin: true };
  flags.killsTotal = 9;
  writeSave("sl_ashenveil_v2", { region: "marsh", x: 812.5, y: 1040.25, flags });
  const back = readSave<{ region: string; x: number; y: number; flags: Record<string, unknown> }>("sl_ashenveil_v2");
  assert.ok(back);
  assert.equal(back.region, "marsh");
  assert.equal(back.x, 812.5);
  assert.equal(back.y, 1040.25);
  const bf = back.flags as { met: Record<string, number>; bossDown: Record<string, boolean>; killsTotal: number };
  assert.equal(bf.met["seo.verdant"], 1);
  assert.equal(bf.bossDown.hobgoblin, true);
  assert.equal(bf.killsTotal, 9);
});

test("boot merge: a partial/corrupt save still yields a complete flag set", () => {
  writeSave("sl_partial", { region: "verdant", x: 10, y: 20, flags: { killsTotal: 3 } });
  const back = readSave<{ flags: Record<string, unknown> }>("sl_partial");
  const merged = { ...freshFlags(), ...(back?.flags ?? {}) } as unknown as Record<string, unknown>;
  assert.equal(merged.killsTotal, 3);
  assert.equal(typeof merged.met, "object", "freshFlags defaults survive the merge");
  assert.ok(Array.isArray((merged as { bossDown: unknown }).bossDown) || typeof (merged as { bossDown: unknown }).bossDown === "object");
  writeSave("sl_junk", "not-an-object" as never);
  const junk = readSave("sl_junk");
  assert.equal(junk, "not-an-object"); // readSave returns what was stored; boot only reads the envelope it wrote
});

test("missing key reads as null — fresh boot stays possible", () => {
  assert.equal(readSave("sl_nonexistent"), null);
});
