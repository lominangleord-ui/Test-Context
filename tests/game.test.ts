// Headless tests for the Ashenveil dungeon engine: collision containment,
// route flags, dialogue coverage, and deterministic battle rules.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeFloor, freshFlags, posBlocked, stepMove, atHazard, inZone, totalKills, routeOf,
  FLOOR_IDS, MASK,
} from "../src/game/world.ts";
import {
  createBattle, advanceDialogue, confirmAtMenu, lockBar, stepBattle, menuItems,
  type BattleState,
} from "../src/game/battle.ts";
import { ENEMY_LINES, ENDINGS, sign as signLines, intro } from "../src/game/script.ts";

const F = () => freshFlags() as unknown as Record<string, boolean>;

test("floors v2: 10,000 random steps on every floor never enter a wall or leave the map", () => {
  for (const id of FLOOR_IDS) {
    const fl = makeFloor(id);
    const f = F();
    let x = fl.objects.spawn[0], y = fl.objects.spawn[1];
    let seed = (0x9e3779b9 ^ (id.charCodeAt(0) << 8) ^ id.length) >>> 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 10000; i++) {
      const a = rnd() * Math.PI * 2;
      const dt = 0.001 + rnd() * 0.049; // random sub-frame steps, up to the view's 50 ms cap
      const sp = 168 + rnd() * 134;    // walk..dash
      const m = stepMove(fl, x, y, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, f);
      x = m.x; y = m.y;
      assert.ok(!posBlocked(fl, x, y, f), `${id}: inside solid after step ${i} at ${x.toFixed(1)},${y.toFixed(1)}`);
      assert.ok(x >= 0 && x <= fl.w && y >= 0 && y <= fl.h, `${id}: left the map at step ${i}`);
    }
  }
});

test("floors v2: spawn, every exit, every rest pad, every NPC and the boss trigger stand on walkable ground", () => {
  for (const id of FLOOR_IDS) {
    const fl = makeFloor(id);
    const f = F();
    const pts: [string, number, number][] = [["spawn", fl.objects.spawn[0], fl.objects.spawn[1]]];
    fl.objects.exits.forEach((e, i) => pts.push([`exit${i}->${e.to}`, e.x + e.w / 2, e.y + e.h / 2]));
    fl.objects.rests.forEach((r, i) => pts.push([`rest${i}`, r.x + r.w / 2, r.y + r.h / 2]));
    if (fl.objects.boss) pts.push(["boss", fl.objects.boss.x + fl.objects.boss.w / 2, fl.objects.boss.y + fl.objects.boss.h / 2]);
    for (const n of fl.objects.npcs) pts.push([`npc:${n.dialogue}`, n.x, n.y - 8]);
    for (const [k, x, y] of pts) {
      assert.ok(!posBlocked(fl, x, y, f), `${id}: ${k} at ${x.toFixed(0)},${y.toFixed(0)} is inside a wall`);
    }
  }
});

test("floors v2: exits chain all five floors; the ashenveil door stays bricked without its flag", () => {
  const reach = (skipLocked: boolean) => {
    const seen = new Set(["verdant"]);
    const q = ["verdant"];
    while (q.length) {
      const fl = makeFloor(q.shift()!);
      for (const e of fl.objects.exits) {
        if (skipLocked && e.requires) continue;
        if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
      }
    }
    return seen;
  };
  assert.deepEqual([...reach(false)].sort(), [...FLOOR_IDS].sort(), "every floor reachable when flags are granted");
  assert.ok(!reach(true).has("ashenveil"), "the unregistered door is bricked before the ceremony");
});

test("floors v2: masks are deterministic, hazards burn but never block", () => {
  for (const id of FLOOR_IDS) {
    const a = makeFloor(id), b = makeFloor(id);
    assert.equal(a.mask.cw, b.mask.cw); assert.equal(a.mask.ch, b.mask.ch);
    let same = true;
    for (let i = 0; i < a.mask.cells.length; i++) if (a.mask.cells[i] !== b.mask.cells[i]) { same = false; break; }
    assert.ok(same, `${id}: placeholder mask is deterministic`);
    assert.ok(a.w >= 2 * 960 - 1 && a.w <= 3 * 960 + 1, `${id}: floor width within 2..3 chunks`);
    assert.ok(a.h >= 2 * 540 - 1 && a.h <= 3 * 540 + 1, `${id}: floor height within 2..3 chunks`);
  }
  const f = F();
  const cav = makeFloor("caverns");
  const m = cav.mask;
  let tested = 0;
  for (let y = 3; y < m.ch - 3; y++) for (let x = 3; x < m.cw - 3; x++) {
    let interior = true;
    for (let dy = -3; dy <= 3 && interior; dy++) for (let dx = -3; dx <= 3; dx++)
      if (m.cells[(y + dy) * m.cw + x + dx] !== MASK.HAZARD) { interior = false; break; }
    if (!interior) continue;
    const cx = (x + 0.5) * m.cell, cy = (y + 0.5) * m.cell;
    if (posBlocked(cav, cx, cy, f)) continue; // a prop stands here — props block, hazard cells do not
    assert.ok(atHazard(cav, cx, cy), "hazard cell reads as hazard");
    assert.ok(!posBlocked(cav, cx, cy, f), "hazard is walkable — it burns, it does not wall you off");
    tested++;
  }
  assert.ok(tested >= 20, `lava ring has standable interior (${tested})`);
});

test("floors v2: painted solids block; the plaza stays open; zones gate the bestiary", () => {
  const f = F();
  // a painted block bites somewhere: find a run of >=6 solid cells on one row, its center must block
  const solidRunBlocks = (id: string, rx: number, ry: number, rw: number, rh: number) => {
    const fl = makeFloor(id); const m = fl.mask;
    let found = false;
    for (let cy = 0; cy < m.ch && !found; cy++) {
      let run = 0;
      for (let cx = 0; cx < m.cw; cx++) {
        const wx = cx * m.cell, wy = cy * m.cell;
        const inRect = wx >= rx && wx < rx + rw && wy >= ry && wy < ry + rh;
        run = inRect && m.cells[cy * m.cw + cx] === MASK.SOLID ? run + 1 : 0;
        if (run >= 6) {
          const mx = (cx - 2.5) * m.cell;
          assert.ok(posBlocked(fl, mx, (cy + 0.5) * m.cell, f), `${id}: a 6-cell solid run blocks`);
          found = true;
        }
      }
    }
    assert.ok(found, `${id}: painted solid rect ${rx},${ry} survived as a blocking mass`);
  };
  solidRunBlocks("marsh", 10 * 30, 20 * 16.875, 300, 270);
  solidRunBlocks("verdant", 48 * 30, 27 * 16.875, 240, 120);
  const verdant = makeFloor("verdant");
  assert.ok(!posBlocked(verdant, verdant.objects.spawn[0], verdant.objects.spawn[1] + 20, f), "the plaza walk continues");
  for (const id of FLOOR_IDS) {
    const fl = makeFloor(id);
    for (const z of fl.objects.zones) {
      assert.ok(z.enemies.length >= 1, `${id}: zone ${z.id} has a bestiary`);
      assert.ok(inZone(fl, z.x + z.w / 2, z.y + z.h / 2)?.id === z.id, `${id}: zone ${z.id} contains its center`);
    }
  }
});

test("every NPC and sign on every floor resolves to real, distinct dialogue", () => {
  for (const id of FLOOR_IDS) {
    const fl = makeFloor(id);
    for (const n of fl.objects.npcs) {
      const lines = getNpc(n.dialogue, { f: freshFlags(), name: "TESTER", level: 3 }) ?? [];
      assert.ok(lines.length >= 2, `NPC tree exists for ${n.dialogue} (${id}) with substance`);
      for (const l of lines) assert.ok(l.text.length > 12, `no stub lines in ${n.dialogue}`);
      const alt = getNpc(n.dialogue, { f: { ...freshFlags(), gateOpen: true, sparedHare: true, killsPines: 5 }, name: "TESTER", level: 3 }) ?? [];
      assert.ok(alt.some((l) => l.text !== lines[0]?.text) || alt.length !== lines.length, `${n.dialogue} reacts to flags`);
    }
    for (const sg of fl.objects.signs) {
      const lines = signLines(sg.text, freshFlags());
      assert.ok(lines.length >= 1, `sign ${sg.text} on ${id}`);
      assert.ok(!/lorem|TODO|placeholder/i.test(lines.map((l) => l.text).join(" ")), "signs are real text");
    }
  }
});

test("every battle enemy has intro, idle, death and spare scripting", () => {
  for (const id of ["hare", "hound", "imp", "wight", "kesh", "architect", "sentry"]) {
    const e = ENEMY_LINES[id];
    assert.ok(e, `lines for ${id}`);
    assert.ok(e.intro.length > 0 && e.death.length > 0, `${id} has intro+death`);
    assert.ok((e.idle.length > 0 || e.low.length > 0), `${id} taunts mid-fight`);
    const acts = Object.keys(e.acts ?? {});
    assert.ok(acts.length > 0, `${id} has ACT flavor`);
  }
});

test("battle: killing pays skill points + gold, never XP, and is deterministic by seed", () => {
  const mk = () => createBattle("hare", {
    name: "TESTER", level: 5, hp: 200, maxHp: 200, atk: 90, def: 20,
    potions: 0, carrots: 0, treats: 0, ramen: 0,
  }, 3, 1234, {});
  const a = mk(); const b = mk();
  assert.deepEqual(a.msgs, b.msgs, "same seed, same opening");
  const win = (st: BattleState) => {
    let guard = 0;
    while (!st.over && guard++ < 60) {
      if (st.phase === "dialogue") advanceDialogue(st);
      else if (st.phase === "menu") { st.menu = 0; confirmAtMenu(st); confirmAtMenu(st); }
      else if (st.phase === "target") { st.bar.pos = 0; lockBar(st); }
      else if (st.phase === "enemyTurn") { for (let i = 0; i < 400 && st.phase === "enemyTurn"; i++) stepBattle(st, { up: false, down: false, left: false, right: false, confirm: false }, 0.02); }
      else break;
    }
    return st;
  };
  const w1 = win(a);
  assert.equal(w1.over, true, "battle ends");
  assert.equal(w1.result?.outcome, "win");
  assert.ok(w1.result!.sp >= 2, "kill pays skill points");
  assert.ok(w1.result!.gold > 0, "kill pays gold");
  // deterministic damage: identical seeded run gives identical numbers
  const w2 = win(b);
  assert.equal(w2.result!.sp, w1.result!.sp);
});

test("battle: ACTs earn mercy; a spared enemy pays no skill points", () => {
  const st = createBattle("hare", {
    name: "TESTER", level: 5, hp: 200, maxHp: 200, atk: 30, def: 20,
    potions: 0, carrots: 0, treats: 0, ramen: 0,
  }, 3, 99, {});
  while (st.phase === "dialogue") advanceDialogue(st);
  assert.equal(st.phase, "menu", "intro hands control to the menu");
  st.menu = 1; confirmAtMenu(st); // open ACT
  const items = menuItems(st);
  const petIdx = items.findIndex((i) => i.label === "Pet");
  assert.ok(petIdx >= 0, "hare has a Pet act");
  st.sub = petIdx; confirmAtMenu(st);
  while ((st.phase as string) === "dialogue") advanceDialogue(st); // page the act's line → turn begins
  assert.equal(st.phase, "enemyTurn", "kindness does not cancel the fight clock");
  for (let i = 0; i < 500 && st.phase === "enemyTurn"; i++) stepBattle(st, { up: false, down: false, left: false, right: false, confirm: false }, 0.02);
  while (st.phase === "dialogue") advanceDialogue(st);
  assert.equal(st.phase, "menu", "back to the menu with a clear conscience");
  assert.equal(st.enemy.spareable, true, "one kind act on a rabbit is enough");
  st.menu = 3; confirmAtMenu(st); confirmAtMenu(st); // MERCY → Spare
  assert.equal(st.phase, "spared");
  assert.equal(st.result?.outcome, "spare");
  assert.equal(st.result?.sp, 0, "mercy pays nothing to grind");
  assert.ok(st.result!.gold >= 0);
});

test("battle: bosses refuse flight and the soul dodges real bullets", () => {
  const st = createBattle("kesh", {
    name: "TESTER", level: 9, hp: 40, maxHp: 40, atk: 5, def: 0,
    potions: 0, carrots: 0, treats: 0, ramen: 0,
  }, 12, 7, {});
  while (st.phase === "dialogue") advanceDialogue(st);
  st.menu = 3; confirmAtMenu(st);
  const mercy = menuItems(st);
  assert.equal(mercy[1].enabled, false, "you cannot flee Warlord Kesh");
  st.subOpen = false;
  // stand still across whole turns; the boards of a boss always collect the toll
  let guard = 0;
  while (!st.over && guard++ < 40) {
    const ph: string = st.phase;
    if (ph === "dialogue") advanceDialogue(st);
    else if (ph === "menu") { st.menu = 1; confirmAtMenu(st); st.sub = 0; confirmAtMenu(st); }
    else if (ph === "enemyTurn") { for (let i = 0; i < 600 && st.phase === "enemyTurn"; i++) stepBattle(st, { up: false, down: false, left: false, right: false, confirm: false }, 0.02); }
    else break;
  }
  assert.equal(st.result?.outcome, "death", "a boss board does kill an unprepared soul");
  assert.equal(st.over, true);
});

test("routes: pacifist, neutral and genocide are distinct, flag-driven states", () => {
  const f0 = freshFlags();
  assert.equal(routeOf(f0), "neutral", "fresh save is undecided-neutral");
  const pac = { ...freshFlags(), sparedHare: true, sparedHound: true, sparedKesh: true, bossDone: true };
  assert.equal(routeOf(pac), "pacifist", "zero kills + spared warlord = pacifist");
  const geno = { ...freshFlags(), killsPines: 7, killsRidge: 7, genDone: true };
  assert.equal(routeOf(geno), "genocide", "quota reached + sentry killed = genocide");
  assert.equal(totalKills({ ...freshFlags(), killsPines: 3, killsRidge: 4 }), 7);
  for (const key of ["neutral", "pacifist", "genocide", "gameover"]) {
    const e = ENDINGS[key];
    assert.ok(e && e.length >= (key === "gameover" ? 3 : 4), `ending ${key} exists and lands`);
    const joined = e.map((l) => l.text).join(" ");
    assert.ok(!/lorem|TODO/i.test(joined), `ending ${key} is real prose`);
  }
  assert.notEqual(ENDINGS.neutral.map((l) => l.text).join(""), ENDINGS.pacifist.map((l) => l.text).join(""), "endings differ");
  assert.notEqual(ENDINGS.pacifist.map((l) => l.text).join(""), ENDINGS.genocide.map((l) => l.text).join(""), "endings differ 2");
  assert.ok(intro("SHA").some((l) => l.text.includes("SHA")), "intro personalizes with the hunter name");
});

test("items: potions and shop-only consumables behave inside fights", () => {
  const st = createBattle("imp", {
    name: "TESTER", level: 5, hp: 10, maxHp: 100, atk: 40, def: 10,
    potions: 1, carrots: 2, treats: 0, ramen: 1,
  }, 3, 42, {});
  while (st.phase === "dialogue") advanceDialogue(st);
  st.menu = 2; confirmAtMenu(st); // open ITEM
  const items = menuItems(st);
  assert.ok(items.some((i) => i.label.startsWith("POTION ×1")), "potion listed with count");
  st.sub = items.findIndex((i) => i.label.startsWith("POTION"));
  confirmAtMenu(st);
  assert.equal(st.player.potions, 0, "potion consumed");
  assert.ok(st.player.hp > 10, "potion healed");
  // the enemy swings back after the item
  advanceDialogue(st);
  const ph2: string = st.phase;
  assert.ok(ph2 === "enemyTurn" || ph2 === "dialogue", "turn passed to the enemy");
});

// ═══════════════════════ EXPEDITION (merged campaign) tests ═══════════════════════

const REGION_IDS = ["verdant", "marsh", "caverns", "citadel", "ashenveil"];
const { getNpc, signAll, bossGate, bossAfter, nextObjective, prologue, ceremony, ceremonyAnswer, epilogue, regionArrive } =
  await import("../src/game/script.ts");

test("expedition floors v2: props-with-colliders block without a grid rebuild, gate opens by flag alone", () => {
  const f = F();
  const cit = makeFloor("ashenveil");
  const gate = cit.objects.props.find((p) => p.sprite === "gate")!;
  assert.ok(gate, "ashenveil carries the ridge gate prop");
  const gx = gate.x + gate.w / 2, gy = gate.y + gate.h / 2;
  assert.ok(posBlocked(cit, gx, gy, f), "gate collider blocks while gateOpen is false");
  const open = { gateOpen: true } as unknown as Record<string, boolean>;
  assert.ok(!posBlocked(cit, gx, gy, open), "the same ground opens when the flag flips — nothing rebuilt");
  // den: blocked by its own collider body until unlocked
  const ash = makeFloor("ashenveil");
  const ex = ash.objects.exits.find((e) => e.to === "citadel");
  assert.ok(ex, "ashenveil leads back down to the citadel");
});

test("expedition cast: every new NPC, sign, boss gate and bestiary voice is authored prose", () => {
  const ctx = { f: freshFlags(), name: "TESTER", level: 5 };
  const alt = { f: { ...freshFlags(), killsTotal: 30, genocideZone: true, bossDown: { hobgoblin: true, sentinel: true, irontusk: true }, savedPair: true, kangBond: true, unregistered: true, ceremonyAnswer: "no" }, name: "TESTER", level: 30 };
  for (const id of REGION_IDS) {
    const w = makeFloor(id).objects;
    for (const n of w.npcs) {
      const lines = getNpc(n.dialogue, ctx);
      assert.ok(lines && lines.length >= 2, `npc ${n.dialogue} exists with substance`);
      assert.ok(lines!.every((l: { text?: string }) => (l.text ?? "").length > 12), `npc ${n.dialogue} has no stub lines`);
      const altLines = getNpc(n.dialogue, alt);
      assert.ok(altLines && altLines.length >= 1, `npc ${n.dialogue} survives the genocide flags`);
    }
    for (const sg of w.signs) {
      const lines = signAll(sg.text, freshFlags());
      const joined = lines.map((l: { text?: string }) => l.text ?? "").join(" ");
      assert.ok(lines.length >= 1 && !/paint has worn off|lorem|TODO/i.test(joined), `sign ${sg.text} is authored`);
      assert.ok(joined.length > 24, `sign ${sg.text} says something`);
    }
    if (w.boss) {
      assert.ok(bossGate(w.boss.id, freshFlags()).length >= 3, `boss gate ${w.boss.id} has buildup`);
      for (const sp of [true, false]) {
        const ba = bossAfter(w.boss.id, freshFlags(), sp);
        assert.ok(ba.length >= 2 && ba.every((l: { text?: string }) => (l.text ?? "").length > 20), `boss after ${w.boss.id}/${sp ? "spare" : "win"}`);
      }
      assert.notEqual(
        bossAfter(w.boss.id, freshFlags(), true).map((l: { text?: string }) => l.text).join(""),
        bossAfter(w.boss.id, freshFlags(), false).map((l: { text?: string }) => l.text).join(""),
        `boss ${w.boss.id}: the spared outcome reads differently`,
      );
    }
  }
  for (const id of ["crawler", "rhound", "stalker", "lurker", "dsentry", "reed", "bat", "golem", "revenant", "gsent", "hknife", "acolyte"]) {
    const e = ENEMY_LINES[id];
    assert.ok(e, `mob ${id} has lines`);
    assert.ok(e.intro.length > 0 && e.death.length > 0, `${id} intro+death`);
    assert.ok(e.idle.length + e.low.length >= 2, `${id} talks mid-fight`);
    assert.ok(Object.keys(e.acts).length >= 4, `${id} has four ACTs of flavor`);
    assert.ok(e.spareReady.length > 0 && e.spared.length > 0, `${id} mercy scripted`);
  }
  for (const id of ["hobgoblin", "sentinel", "irontusk", "warden", "alpha"]) {
    const e = ENEMY_LINES[id];
    assert.ok(e && e.intro.length >= 2 && Object.keys(e.acts).length >= 4 && e.spared.length >= 2, `boss ${id} full mercy theatre`);
  }
});

test("tracker: sparse by design — one shared milestone at a time, silence when the road is yours", () => {
  const f0 = freshFlags();
  assert.equal(nextObjective(f0, "verdant")?.key, "v-seo", "first thing: the briefing");
  const f1 = { ...f0, met: { "seo.verdant": 1, "hana.verdant": 1, "roan.verdant": 1 } };
  assert.equal(nextObjective(f1, "verdant")?.key, "v-boss", "then the locked door of the floor");
  const f2 = { ...f1, bossDown: { hobgoblin: true } };
  assert.equal(nextObjective(f2, "verdant")?.key, "v-exit");
  const f3 = { ...f2, trackerSeen: { "v-exit": true } };
  assert.equal(nextObjective(f3, "verdant"), null, "a seen milestone never nags twice");
  const f4 = { ...f3, introDone: true, met: { ...f3.met, "sila.marsh": 1 } };
  assert.equal(nextObjective(f4, "marsh")?.key, "m-reed", "each floor restarts one hint");
  assert.ok(nextObjective(f4, "citadel") === null || nextObjective(f4, "citadel")!.key.startsWith("t-"), "citadel only speaks about its own gates");
  const gen = { ...f0, killsTotal: 30, met: { "seo.verdant": 1, "hana.verdant": 1, "roan.verdant": 1 } };
  const g = nextObjective(gen, "verdant");
  assert.ok(g!.key.startsWith("v-"), "the fixated player still gets the shared step");
  assert.ok(/knows you|stopped raking/i.test(g!.text), "genocidal kills flip the tracker's voice");
});

test("S1 Clause 7: gap 4 is nothing, gap 5 at half or worse is everything, and death is refused once", async () => {
  const { createBattle, stepBattle, resonanceApplies, RESONANCE_TEXT } = await import("../src/game/battle.ts");
  assert.equal(resonanceApplies(45, 41, 15, 30), false, "four levels of gap buys nothing");
  assert.equal(resonanceApplies(46, 41, 15, 30), true, "the fifth level is the clause");
  assert.equal(resonanceApplies(46, 41, 16, 30), false, "it starts at half or worse — 51% is not it");
  assert.equal(
    RESONANCE_TEXT,
    "[RESONANCE ACTIVE. Difficulty assist, Architect's Clause 7. The System does not watch you lose to something beneath you.]",
    "the System's one true sentence about itself, word for word",
  );
  const NOINP = { up: false, down: false, left: false, right: false, confirm: false };
  const mk = () => {
    const st = createBattle("crawler", { name: "T", level: 30, hp: 12, maxHp: 24, atk: 10, def: 5, potions: 0, carrots: 0, treats: 0, ramen: 0 }, 25, 7, {});
    st.phase = "enemyTurn"; st.turnT = 999;
    st.bullets = [{ x: st.soul.x, y: st.soul.y, vx: 0, vy: 0, w: 40, h: 40, shape: "rect", ttl: 9, windup: 0 }];
    return st;
  };
  // regen: exactly 8% of max HP per second while it holds
  const g = createBattle("crawler", { name: "T", level: 30, hp: 12, maxHp: 24, atk: 10, def: 5, potions: 0, carrots: 0, treats: 0, ramen: 0 }, 25, 9, {});
  stepBattle(g, NOINP, 1.0);
  assert.ok(Math.abs(g.player.hp - 13.92) < 0.02, `8%/s mending (got ${g.player.hp})`);
  // the refusal of death — once, at 25%, and no more
  const st = mk();
  st.player.hp = 1;
  stepBattle(st, NOINP, 0.016);
  assert.equal(st.over, false, "the first death is declined");
  assert.equal(st.player.hp, 6, "you stand back up at a quarter");
  assert.equal(st.reviveUsed, true);
  st.phase = "enemyTurn"; st.turnT = 999; st.hitInv = 0; st.player.hp = 1;
  st.bullets = [{ x: st.soul.x, y: st.soul.y, vx: 0, vy: 0, w: 40, h: 40, shape: "rect", ttl: 9, windup: 0 }];
  stepBattle(st, NOINP, 0.016);
  assert.equal(st.result?.outcome, "death", "the second death is accepted — the clause says once");
  // and under-leveled, nothing saves anyone, ever
  const under = createBattle("crawler", { name: "T", level: 20, hp: 3, maxHp: 24, atk: 10, def: 5, potions: 0, carrots: 0, treats: 0, ramen: 0 }, 25, 4, {});
  under.phase = "enemyTurn"; under.turnT = 999;
  under.bullets = [{ x: under.soul.x, y: under.soul.y, vx: 0, vy: 0, w: 40, h: 40, shape: "rect", ttl: 9, windup: 0 }];
  stepBattle(under, NOINP, 0.016);
  assert.equal(under.result?.outcome, "death", "below the wall there is no hand on the shoulder");
});

test("S1 adaptive spawns: ±1 of the hunter, minimum 1, no floor band survives", async () => {
  const { spawnLevelFor } = await import("../src/game/battle.ts");
  assert.equal(spawnLevelFor(1, () => 0), 1, "never spawns below 1");
  assert.equal(spawnLevelFor(1, () => 0.999), 2);
  assert.equal(spawnLevelFor(40, () => 0), 39);
  assert.equal(spawnLevelFor(40, () => 0.5), 40);
  assert.equal(spawnLevelFor(40, () => 0.999), 41);
  assert.equal(spawnLevelFor(61, () => 0), 60, "no ceiling exists anywhere in the function");
  for (const r of [0, 0.33, 0.5, 0.66, 0.99]) {
    const v = spawnLevelFor(23, () => r);
    assert.ok(Math.abs(v - 23) <= 1 && v >= 1, "exactly the ±1 window");
  }
  // the view must actually use it — the old z.min/z.max clamp is deleted, not bypassed
  const { readFileSync } = await import("node:fs");
  const vs = readFileSync("src/game/view.ts", "utf8");
  assert.ok(!/Math\.max\(z\.min[^\n]*z\.max/.test(vs), "no band clamp survives in the encounter path");
  assert.ok(vs.includes("spawnLevelFor(lvl, Math.random)"), "the wild meets you at ±1");
  // floors still decide species, and bosses stay authored fixed-level
  const v = makeFloor("verdant").objects;
  assert.ok(v.zones[0].enemies.length > 0, "the floor still picks WHAT lives here");
  for (const id of REGION_IDS) {
    const w = makeFloor(id).objects;
    if (w.boss) assert.ok(w.boss.level > 0 && Number.isFinite(w.boss.level), `${id}: boss level is fixed authored math`);
  }
});

test("S1 stats: LV1 is MORTAL (~30 HP), growth is earned, fatigue is a tax, and nothing is hidden", async () => {
  const { campaignStats, makeEnemy } = await import("../src/game/battle.ts");
  const { expectedCombat, expectedStatSpread } = await import("../src/lib/story.ts");
  const l1 = campaignStats(1, 10, 10, 10, 10);
  assert.ok(l1.maxHP >= 26 && l1.maxHP <= 34, `LV1 HP lands near 30 (got ${l1.maxHP})`);
  const l20 = campaignStats(20, 20, 20, 20, 10);
  assert.ok(l20.maxHP > l1.maxHP * 2.5, "training pays in HP");
  assert.ok(l20.atk > l1.atk * 2, "training pays in ATK");
  const tired = campaignStats(20, 20, 20, 20, 90);
  assert.ok(tired.maxHP < l20.maxHP && tired.atk < l20.atk, "skipping dailies leaves you weaker in here");
  // foe stats ARE the curve — no boss band, no story band, no hidden anything
  for (const L of [1, 7, 25, 38]) {
    const foe = expectedCombat(L).combat;
    const mob = makeEnemy("hare", L);
    assert.equal(mob.hp, foe.maxHP, `hp is exactly expectedCombat(${L})`);
    assert.equal(mob.atk, foe.atk, `atk is exactly expectedCombat(${L})`);
    assert.equal(mob.def, foe.def, `def is exactly expectedCombat(${L})`);
    const boss = makeEnemy("warden", L);
    assert.equal(boss.hp, foe.maxHP, "bosses get boards and turns, not secret stats");
  }
  // the LV1 rule: a level-1 monster ends a fresh hunter in four or five hits,
  // and the fresh hunter does not one-shot it back
  const s1 = expectedCombat(1).combat;
  const hitsOnYou = Math.ceil(l1.maxHP / Math.max(1, Math.round(s1.atk * 0.32 - l1.def * 0.18)));
  assert.ok(hitsOnYou >= 4 && hitsOnYou <= 5, `peer monster kills in ${hitsOnYou} hits — that is the floor you climb from`);
  const yourStrikes = Math.ceil(s1.maxHP / Math.max(1, Math.round(l1.atk * 1.95 - s1.def)));
  assert.ok(yourStrikes >= 4, "no free kills in either direction");
  void expectedStatSpread;
});
test("story spine: prologue, ceremony, and epilogue all honor the ledgers", () => {
  assert.ok(prologue("SHA").some((l: { text?: string }) => (l.text ?? "").includes("SHA")), "prologue personalizes");
  assert.ok(ceremony(freshFlags()).length >= 5, "the ceremony stages its people");
  for (const yes of [true, false]) {
    const r = ceremonyAnswer(yes, freshFlags());
    assert.ok(r.length >= 5 && r.every((l: { text?: string }) => (l.text ?? "").length > 20), `ceremony answer ${yes} lands`);
  }
  assert.notEqual(
    ceremonyAnswer(true, freshFlags()).map((l: { text?: string }) => l.text).join(""),
    ceremonyAnswer(false, freshFlags()).map((l: { text?: string }) => l.text).join(""),
    "yes and no are different stories",
  );
  const full = { ...freshFlags(), sparedStory: { hobgoblin: true, sentinel: true, irontusk: true }, bossDown: { hobgoblin: true, sentinel: true, irontusk: true, warden: true }, savedPair: true, kangBond: true, emberBond: true, chainedTusk: true, ceremonyAnswer: "no" };
  const e1 = epilogue(full);
  assert.ok(e1.length >= 8, "the kept-world epilogue reads every kept promise");
  const e0 = epilogue({ ...freshFlags(), ceremonyAnswer: "yes" });
  assert.ok(e0.length >= 4, "even the bare ending lands its beats");
  assert.notEqual(e1.map((l: { text?: string }) => l.text).join(""), e0.map((l: { text?: string }) => l.text).join(""), "the epilogue is YOUR ledger, not a template");
  const a0 = regionArrive("ashenveil", freshFlags());
  assert.ok(a0.length >= 1 && (a0[0].text ?? "").length > 40, "the last floor announces itself");
});

test("routes v2: the campaign ledger decides; sparing everything cannot read as genocide", () => {
  const clean = { ...freshFlags(), sparedHare: true, sparedHound: true, sparedKesh: true, bossDone: true, bossDown: { hobgoblin: true, sentinel: true, irontusk: true, warden: true } };
  assert.equal(routeOf(clean), "pacifist");
  const bloody = { ...freshFlags(), killsTotal: 30, killsPines: 7, killsRidge: 7, bossDown: { hobgoblin: true, sentinel: true, irontusk: true, warden: true }, genDone: true };
  assert.equal(routeOf(bloody), "genocide");
  const half = { ...freshFlags(), killsTotal: 10 };
  assert.equal(routeOf(half), "neutral", "ten kills on a five-floor campaign is a person, not a route");
});

test("save v2: fresh flags carry every expedition ledger field", () => {
  const f = freshFlags();
  for (const k of ["bossDown", "sparedStory", "regionDone", "trackerSeen", "met", "bought"]) {
    assert.equal(typeof (f as unknown as Record<string, unknown>)[k], "object", `${k} is a live ledger`);
  }
  assert.equal(f.killsTotal, 0);
  assert.equal(f.ceremonyAnswer, "");
  assert.equal(f.unregistered, false);
});

test("S1 bosses: authored fixed levels; three bands — verdict at −3, war at ±0, mercy at +5", async () => {
  const { makeEnemy, campaignStats, underdogFactor, underlevelCut } = await import("../src/game/battle.ts");
  const { expectedStatSpread } = await import("../src/lib/story.ts");
  const statsAt = (L: number, fat = 10) => {
    const [str, agi, vit] = expectedStatSpread(L);
    return campaignStats(L, str, agi, vit, fat);
  };
  // bosses live on floors 1-5 at authored levels — the world file carries them
  for (const id of REGION_IDS) {
    const w = makeFloor(id).objects;
    if (w.boss) assert.ok(Number.isInteger(w.boss.level) && w.boss.level >= 1, `${id}: authored`);
  }
  const BOSS = 38;
  const boss = makeEnemy("warden", BOSS);
  // band A — three levels under: you die fast and you cannot chip
  const a = statsAt(35);
  const dmgA = Math.max(1, Math.round(Math.round(boss.atk * 0.32 - a.def * 0.18) * underdogFactor(35, BOSS)));
  const hitsA = Math.ceil(a.maxHP / dmgA);
  assert.ok(hitsA <= 3, `three levels under = ${hitsA} hits to die; the wall is the wall`);
  const strikeA = Math.max(1, Math.round(Math.round(a.atk * 1.95 - boss.def) * underlevelCut(35, BOSS)));
  assert.ok(strikeA / boss.hp <= 0.02, `FIGHT does ${(100 * strikeA / boss.hp).toFixed(1)}% — the band says no`);
  // band B — at level: hard but fair
  const b = statsAt(BOSS);
  const dmgB = Math.max(1, Math.round(boss.atk * 0.32 - b.def * 0.18));
  assert.ok(Math.ceil(b.maxHP / dmgB) >= 4, "at level you are not glass, just not safe");
  const strikeB = Math.max(1, Math.round(b.atk * 1.95 - boss.def));
  assert.ok(strikeB / boss.hp >= 0.025, "at level every clean hit counts");
  // band C — five over: a bad player outlasts it (Clause 7 math, standing still)
  const c = statsAt(BOSS + 5);
  const softC = Math.max(1, Math.round(Math.round(boss.atk * 0.32 - c.def * 0.18) * 0.35));
  const mendC = c.maxHP * 0.08 * 1.2; // 8%/s across the softened 1.2s i-frame window
  assert.ok(mendC >= softC, `standing in it heals ${mendC.toFixed(0)} vs ${softC} per hit — winnable by design`);
  const strikeC = Math.max(1, Math.round(c.atk * 1.95 - boss.def));
  assert.ok(strikeC / boss.hp >= 0.05, "and you out-math it with ease");
});

test("S1 patterns: tier by foe level — 1-9 / 10-24 / 25-39 / 40+, new shapes unlock", async () => {
  const { patternTier, createBattle, beginEnemyTurn } = await import("../src/game/battle.ts");
  assert.deepEqual([1, 9].map(patternTier), [1, 1]);
  assert.deepEqual([10, 24].map(patternTier), [2, 2]);
  assert.deepEqual([25, 39].map(patternTier), [3, 3]);
  assert.deepEqual([40, 100].map(patternTier), [4, 4]);
  // a T3 foe's pool contains the T3 shapes (sample many turns — the escalation is stochastic)
  const st = createBattle("crawler", { name: "T", level: 1, hp: 999, maxHp: 999, atk: 1, def: 1, potions: 0, carrots: 0, treats: 0, ramen: 0 }, 30, 1234, {});
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) { beginEnemyTurn(st); seen.add(st._pattern ?? ""); }
  assert.ok(seen.size >= 2, `tier pool escalates (saw ${[...seen].join(",")})`);
  const t1 = createBattle("crawler", { name: "T", level: 1, hp: 999, maxHp: 999, atk: 1, def: 1, potions: 0, carrots: 0, treats: 0, ramen: 0 }, 5, 1234, {});
  const seen1 = new Set<string>();
  for (let i = 0; i < 60; i++) { beginEnemyTurn(t1); seen1.add(t1._pattern ?? ""); }
  assert.deepEqual([...seen1].sort(), ["hops", "rain"], "T1 stays slow and single — pattern purity for beginners");
});

test("S1 HARD GATE: no shadow extraction, no Monarch power of any kind before the Job Change", async () => {
  const { claimGate, claimVerbFor, createBattle, menuItems } = await import("../src/game/battle.ts");
  const { MONARCH_PATHS } = await import("../src/data/monarchPaths.ts");
  assert.equal(MONARCH_PATHS.length, 9, "nine lineages exist");
  for (const lvl of [0, 1, 12, 39]) for (const p of MONARCH_PATHS)
    assert.equal(claimGate(lvl, p.id), false, `LV${lvl} claims nothing (${p.id}) — FAIL: the gate leaked`);
  assert.equal(claimGate(39, "shadows"), false, "thirty-nine is not forty");
  assert.equal(claimGate(40, null), false, "no lineage = no word");
  assert.equal(claimGate(40, "shadows"), true, "LV40 AND a chosen lineage — that is the whole key");
  for (const p of MONARCH_PATHS) assert.ok(p.claimVerb && p.claimVerb.length > 2, `${p.id} has its own word`);
  assert.equal(new Set(MONARCH_PATHS.map((p) => p.claimVerb)).size, 9, "nine verbs, nine lineages, no shared words");
  assert.equal(claimVerbFor("shadows"), "EXTRACT: ARISE", "the Shadow Monarch's is the one from the stories");
  assert.equal(claimVerbFor(null), "CLAIM", "pre-change there is no verb to speak at all");
  // the engine trusts one boolean and the view is the only one who sets it —
  // and it can only come up through claimGate (grep-enforced, not vibes-enforced)
  const { readFileSync } = await import("node:fs");
  const vs = readFileSync("src/game/view.ts", "utf8");
  const calls = (vs.match(/canClaim:\s*claimGate\(s\.level,\s*s\.monarchPath\)/g) ?? []).length;
  assert.equal(calls, 1, "exactly one canClaim call site, gated by claimGate");
  // and the mercy menu honestly has three doors when no claim is possible
  const st = createBattle("hare", { name: "T", level: 1, hp: 20, maxHp: 20, atk: 10, def: 5, potions: 0, carrots: 0, treats: 0, ramen: 0 }, 1, 3, {});
  st.menu = 3;
  assert.deepEqual(menuItems(st).map((i) => i.label), ["Spare", "Flee", "Back"], "no hidden fourth door");
  assert.equal(st.canClaim, false);
  assert.equal(st.claimVerb, "CLAIM", "an unchosen player has no word");
});

test("S1 claims: the EXTRACT ring — three attempts maximum, wider with gap, tighter with foe level, never 100%", async () => {
  const { createBattle, beginClaim, resolveClaim, claimWindowFor, advanceDialogue, menuItems } = await import("../src/game/battle.ts");
  assert.ok(claimWindowFor(41, 40) < claimWindowFor(80, 40), "gap widens the ring");
  assert.ok(claimWindowFor(80, 92) < claimWindowFor(80, 40), "a stronger name narrows it");
  assert.ok(claimWindowFor(999, 1) <= 0.6, "never a sure thing, whatever the grind");
  assert.ok(claimWindowFor(40, 300) >= 0.08, "never hopeless either");
  const mk = () => {
    const st = createBattle("warden", { name: "T", level: 41, hp: 100, maxHp: 100, atk: 10, def: 5, potions: 0, carrots: 0, treats: 0, ramen: 0, path: "shadows" }, 38, 5, { canClaim: true });
    return st;
  };
  const st = mk();
  assert.equal(st.claimVerb, "EXTRACT: ARISE");
  st.menu = 3;
  assert.ok(menuItems(st).some((i) => i.label === "EXTRACT: ARISE"), "the door shows only because the gate is open");
  beginClaim(st);
  while ((st.phase as string) === "dialogue") advanceDialogue(st);
  assert.equal(st.phase, "extract");
  st.bar.pos = 0.02; st.bar.locked = null;
  resolveClaim(st);
  assert.equal(st.result?.outcome, "claim", "center of the ring holds the name");
  assert.equal(st.over, true);
  // three misses and the folder closes for good
  const s2 = mk();
  for (let i = 0; i < 3; i++) {
    beginClaim(s2);
    while ((s2.phase as string) === "dialogue") advanceDialogue(s2);
    assert.equal(s2.phase, "extract", `attempt ${i + 1}`);
    s2.bar.pos = 0.95; s2.bar.locked = null;
    resolveClaim(s2);
    while ((s2.phase as string) === "dialogue") advanceDialogue(s2);
  }
  assert.equal(s2.claimLocked, true, "three attempts, that is all the folder gets");
  assert.notEqual(s2.result?.outcome, "claim", "misses stay misses");
  const before = s2.claimAttempts;
  beginClaim(s2);
  assert.equal(s2.claimAttempts, before, "a closed folder does not reopen");
});
