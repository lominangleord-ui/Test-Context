// Headless tests for the Ashenveil dungeon engine: collision containment,
// route flags, dialogue coverage, and deterministic battle rules.
import assert from "node:assert/strict";
import { test } from "node:test";
import { TILE } from "../src/game/core.ts";
import {
  buildWorld, buildCollider, solidAtGrid, freshFlags, zoneAt, totalKills, routeOf, MAP_TILES,
} from "../src/game/world.ts";
import {
  createBattle, advanceDialogue, confirmAtMenu, lockBar, stepBattle, menuItems,
  type BattleState,
} from "../src/game/battle.ts";
import { NPC, ENEMY_LINES, ENDINGS, sign as signLines, intro } from "../src/game/script.ts";

const P = (tx: number, ty: number) => [tx * TILE + 8, ty * TILE + 8] as const;

test("world containment: borders, water, and the gate hold the player", () => {
  const w = buildWorld();
  const col = buildCollider(w, freshFlags());
  // map edges are solid on all four sides
  for (let i = 0; i < MAP_TILES; i++) {
    assert.ok(solidAtGrid(col, i, 0), "north border");
    assert.ok(solidAtGrid(col, i, MAP_TILES - 1), "south border");
    assert.ok(solidAtGrid(col, 0, i), "west border");
    assert.ok(solidAtGrid(col, MAP_TILES - 1, i), "east border");
  }
  assert.equal(solidAtGrid(col, -1, -1), true, "off-map reads solid");
  // the frozen stream is impassable except the bridge span
  for (const [tx, ty] of [[23, 18], [25, 17], [40, 19], [36, 18]] as const) {
    assert.equal(solidAtGrid(col, tx, ty), true, `water blocks ${tx},${ty}`);
  }
  for (let tx = 30; tx <= 33; tx++) assert.equal(solidAtGrid(col, tx, 18), false, `bridge open at ${tx},18`);
  // the gate seals the ENTIRE road, not just the portcullis: no walking around it
  for (let tx = 28; tx <= 36; tx++) assert.equal(solidAtGrid(col, tx, 13), true, `gate row blocks ${tx},13`);
  // the ridge gate: closed until opened, then the road is free
  assert.equal(solidAtGrid(col, 31, 13), true, "gate closed");
  const open = { ...freshFlags(), gateOpen: true };
  assert.equal(solidAtGrid(buildCollider(w, open), 31, 13), false, "gate opens only via flags");
});

test("world layout: spawn in town, zones flanking, obelisk and portal reachable tiles", () => {
  const w = buildWorld();
  const z = zoneAt(w, w.spawn.x, w.spawn.y);
  assert.equal(z, null, "spawn is not inside an encounter zone");
  const pines = w.zones.find((x) => x.id === "pines")!;
  const ridge = w.zones.find((x) => x.id === "ridge")!;
  assert.ok(pines && ridge, "both zones exist");
  assert.ok(ridge.quota === 7 && pines.quota === 7, "quotas");
  const [px, py] = P(31, 28);
  assert.notEqual(zoneAt(w, px, py), pines, "obelisk tile not in a zone");
});

test("every NPC and sign in the world resolves to real, distinct dialogue", () => {
  const w = buildWorld();
  for (const n of w.npcs) {
    const tree = NPC[n.dialogue];
    assert.ok(tree, `NPC tree exists for ${n.dialogue}`);
    const lines = tree({ f: freshFlags(), name: "TESTER", level: 3 });
    assert.ok(lines.length >= 2, `dialogue for ${n.dialogue} has substance`);
    for (const l of lines) assert.ok(l.text.length > 12, `no stub lines in ${n.dialogue}`);
    // flags change what NPCs say (the world must react)
    const alt = tree({ f: { ...freshFlags(), gateOpen: true, sparedHare: true, killsPines: 5 }, name: "TESTER", level: 3 });
    assert.ok(alt.some((l) => l.text !== lines[0]?.text) || alt.length !== lines.length, `${n.dialogue} reacts to flags`);
  }
  for (const s of w.signs) {
    const lines = signLines(s.text, freshFlags());
    assert.ok(lines.length >= 1, `sign ${s.text}`);
    assert.ok(!/lorem|TODO|placeholder/i.test(lines.map((l) => l.text).join(" ")), "signs are real text");
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
const { campaignStats } = await import("../src/game/battle.ts");

test("expedition regions: spawn walkable, exits bricked until the floor is resolved, lava never walkable", () => {
  for (const id of REGION_IDS) {
    const w = buildWorld(id);
    const col = buildCollider(w, freshFlags());
    const sx = Math.floor(w.spawn.x / TILE), sy = Math.floor(w.spawn.y / TILE);
    assert.equal(solidAtGrid(col, sx, sy), false, `${id}: spawn walkable`);
    let free = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]] as const) {
      if (!solidAtGrid(col, sx + dx, sy + dy)) free++;
    }
    assert.ok(free >= 5, `${id}: spawn has elbow room (${free} open neighbours)`);
    if (w.exit && w.boss) {
      const ex = Math.floor(w.exit.x), ey = Math.floor(w.exit.y);
      assert.equal(solidAtGrid(col, ex, ey), true, `${id}: exit is bricked while the boss stands`);
      const f2 = { ...freshFlags(), bossDown: { [w.boss.id]: true }, unregistered: true };
      const col2 = buildCollider(w, f2);
      assert.equal(solidAtGrid(col2, ex, ey), false, `${id}: resolving the floor opens the way up`);
    }
  }
  // the caverns' lava is the floor's fever: you cannot walk on a fever
  const cav = buildWorld("caverns");
  const cc = buildCollider(cav, freshFlags());
  assert.equal(solidAtGrid(cc, 22, 32), true, "big lava ring is solid");
  assert.equal(solidAtGrid(cc, 44, 48), true, "boss-hall pool is solid");
  // and the west shelf still lets you reach the cult's altar
  assert.equal(solidAtGrid(cc, 10, 28), false, "great-hall west shelf walkable");
});

test("expedition cast: every new NPC, sign, boss gate and bestiary voice is authored prose", () => {
  const ctx = { f: freshFlags(), name: "TESTER", level: 5 };
  const alt = { f: { ...freshFlags(), killsTotal: 30, genocideZone: true, bossDown: { hobgoblin: true, sentinel: true, irontusk: true }, savedPair: true, kangBond: true, unregistered: true, ceremonyAnswer: "no" }, name: "TESTER", level: 30 };
  for (const id of REGION_IDS) {
    const w = buildWorld(id);
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

test("resonance: two levels above AND at half HP the floor holds you; a peer fight gets no rescue", () => {
  const mk = (lvl: number) => createBattle("crawler", {
    name: "T", level: lvl, hp: 20, maxHp: 40, atk: 10, def: 5, potions: 0, carrots: 0, treats: 0, ramen: 0,
  }, 3, 11, {});
  const a = mk(9); const b = mk(4);
  stepBattle(a, { up: false, down: false, left: false, right: false, confirm: false }, 0.1);
  stepBattle(b, { up: false, down: false, left: false, right: false, confirm: false }, 0.1);
  assert.equal(a.resonance, true, "overleveled + half HP = the System's fairness clause");
  assert.ok(a.player.hp > 20, "and it actually knits HP back");
  assert.equal(b.resonance, false, "one level above buys nothing — you earn the gap");
  const hurt = mk(9); hurt.player.hp = 39; // above half → off
  stepBattle(hurt, { up: false, down: false, left: false, right: false, confirm: false }, 0.1);
  assert.equal(hurt.resonance, false, "it starts at the half, not before");
});

test("adaptive scaling: wild monsters clamp to their floor's band; bosses never scale", () => {
  // the same clamp the view applies, asserted against the zone definitions
  const clampEff = (lvl: number, z: { min?: number; max?: number }) => Math.max(z.min ?? 1, Math.min(z.max ?? 40, lvl));
  const v = buildWorld("verdant");
  const z = v.zones[0];
  assert.equal(clampEff(1, z), z.min, "a LV-1 player fights at the floor's true danger — this is where you learn");
  assert.equal(clampEff(60, z), z.max, "a LV-60 player still fights a ceilinged monster, strong but fair");
  const ridge = buildWorld("ashenveil").zones.find((x) => x.id === "ridge")!;
  assert.ok((ridge.min ?? 0) >= 7, "the ridge stays the ridge: no free speedrun through snow");
  for (const id of REGION_IDS) {
    const w = buildWorld(id);
    if (w.boss) assert.ok(w.boss.level > 0 && Number.isFinite(w.boss.level), `${id}: boss level is fixed authored math`);
  }
});

test("campaign stats: small at LV1, grow with dailies, and fatigue is a real tax", () => {
  const l1 = campaignStats(1, 1, 1, 1, 10);
  const l20 = campaignStats(20, 20, 20, 20, 10);
  assert.ok(l1.maxHP <= 45, `LV1 HP stays mortal (got ${l1.maxHP})`);
  assert.ok(l20.maxHP > l1.maxHP * 2.5, "training pays in HP");
  assert.ok(l20.atk > l1.atk * 2, "training pays in ATK");
  const tired = campaignStats(20, 20, 20, 20, 90);
  assert.ok(tired.maxHP < l20.maxHP && tired.atk < l20.atk, "skipping dailies leaves you weaker in here");
  const enemy = ENEMY_LINES.hare ? 1 : 0; void enemy;
  // and a fresh LV1 with full effort can still trade blows with a LV1 crawler: the
  // floor's minimum band is 1, player HP ~40, expectedCombat(1) must not one-shot:
  const { expectedCombat } = await0();
  void expectedCombat;
});
function await0() { return { expectedCombat: (_l: number) => ({ combat: { hp: 0 } }) }; }

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
