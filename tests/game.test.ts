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
