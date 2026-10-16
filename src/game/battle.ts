// Ashenveil — headless Undertale-style battle engine.
// Pure-ish state machine so the full app, the renderer, and the test suite
// run the same fight logic. Enemy lines scale off the same expected-stat
// curve as the story tiles: the trained edge through, the idle get flattened.
import { mkRng, clamp, rectsOverlap } from "./core";
import { expectedCombat } from "../lib/story";
import { readinessFromFatigue } from "../lib/battle";
import { ENEMY_LINES } from "./script";
import type { Line } from "./script";

export interface Bullet {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number;
  shape: "rect" | "circle" | "ring";
  ttl: number; windup: number; grow?: number;
  color?: string;
  homeX?: number; homeY?: number; phase?: number;
}

export interface EnemyDef {
  id: string; name: string; zoneLevel: number;
  hp: number; atk: number; def: number;
  patterns: string[]; turnTime: number;
  spareNeeds: string[][]; // act-groups: each group needs one act used
  gold: number; sp: number;
  boss?: boolean; noFlee?: boolean;
}

export type Phase =
  | "dialogue" | "menu" | "submenu" | "target" | "enemyTurn"
  | "won" | "spared" | "fled" | "dead";

export interface BattleState {
  enemy: EnemyDef & { hp: number; maxHp: number; spareable: boolean; actsUsed: string[] };
  player: { name: string; level: number; hp: number; maxHp: number; atk: number; def: number; potions: number; carrots: number; treats: number; ramen: number };
  phase: Phase;
  menu: 0 | 1 | 2 | 3; sub: number; subOpen: boolean;
  msgs: (Line | string)[]; msgIndex: number;
  bullets: Bullet[];
  soul: { x: number; y: number };
  box: { x: number; y: number; w: number; h: number };
  bar: { pos: number; dir: number; locked: number | null };
  turn: number; turnT: number;
  rng: () => number;
  shake: number; flash: number;
  hitInv: number;
  result: null | { outcome: "win" | "spare" | "flee" | "death"; sp: number; gold: number; text: string };
  flagsIn: { sparedHare?: boolean; sparedHound?: boolean; befriended?: string[]; sparedHob?: boolean; savedPair?: boolean; emberBond?: boolean; kangTaught?: boolean; chainedTusk?: boolean; }
  enemyMood: number; // -1 hostile .. 1 warm — nudges lines & spare timing
  over: boolean;
  fightMsg?: string;
  resonance: boolean; // the System props up an over-leveled Player at half HP
  resonanceShown: boolean;
  // internal sequencing
  _after?: string;
  _pattern?: string;
  _spawnT?: number;
  _waveT?: number;
}

const BOX = { x: 120, y: 250, w: 400, h: 120 };

/** Build an enemy from the zone level, mirroring the story-tile difficulty curve. */
export function makeEnemy(id: string, zoneLevel: number): EnemyDef {
  const { combat } = expectedCombat(zoneLevel);
  const u = combat.baseATK, hpP = combat.maxHP, defP = combat.baseDEF;
  const boss = id === "kesh" || id === "architect" || id === "sentry";
  const story = id === "wight";
  const mult = boss ? 1.5 : story ? 1.12 : 1;
  const div = boss ? 4.6 : 5.4;
  const base: EnemyDef = {
    id, name: "", zoneLevel,
    hp: Math.round(u * 3.4 * mult),
    atk: defP + Math.round(hpP / div),
    def: Math.round(u * (boss ? 0.18 : 0.15)),
    patterns: PATTERNS[id]?.list ?? ["rain"],
    turnTime: boss ? 6.4 : 5.0,
    spareNeeds: SPARE[id] ?? [],
    gold: boss ? 60 : 2 + Math.floor(zoneLevel / 4),
    sp: boss ? (id === "sentry" ? 12 : 8) : 2,
    boss, noFlee: boss,
  };
  base.name = NAME[id];
  return base;
}

const NAME: Record<string, string> = {
  hare: "Rimehare", hound: "Stone Hound", imp: "Frost Imp", wight: "Ice Wight",
  kesh: "Warlord Kesh", architect: "THE ARCHITECT", sentry: "THE SYSTEM",
  crawler: "Moss Crawler", rhound: "Ruined Hound", stalker: "Thorn Stalker",
  lurker: "Bog Lurker", dsentry: "Drowned Sentry", reed: "Reed Stalker",
  bat: "Cinder Bat", golem: "Slag Golem", revenant: "Ash Revenant",
  gsent: "Gate Sentinel", hknife: "Hollow Knight", acolyte: "Crimson Acolyte",
  hobgoblin: "Blood-Red Hobgoblin", sentinel: "Stone Sentinel", irontusk: "Iron Tusk",
  alpha: "Black Fang Alpha", warden: "The Gate Warden",
};
const SPARE: Record<string, string[][]> = {
  hare: [["Pet", "Feed", "Dance"]],
  hound: [["Heel", "Treat"]],
  imp: [["Threaten", "Trade", "Mirror"]],
  wight: [["Listen"]],
  crawler: [["Coil", "Sun", "Sing"]],
  rhound: [["Call", "Heel"]],
  stalker: [["Freeze", "Taunt"]],
  lurker: [["Surface", "Blow Bubbles"]],
  dsentry: [["At Ease", "Salute"]],
  reed: [["Sway", "Braid", "Weave"]],
  bat: [["Pet", "Feed", "Warm"]],
  golem: [["Outmaneuver", "Polish"]],
  revenant: [["Listen", "Kang's Name"]],
  gsent: [["Salute", "Report"]],
  hknife: [["Names", "Remove Helm"]],
  acolyte: [["Snuff", "Confess"]],
  hobgoblin: [["Name", "Cross Armor"]],
  sentinel: [["Polish", "Lullaby"]],
  irontusk: [["Unchain"]],
  alpha: [["Howl", "Bow"]],
  warden: [["Yield"]],
  kesh: [["Pledge"]],
  architect: [["Speak", "Refuse", "Plead"]],
  sentry: [["Bow"]],
};

export function createBattle(
  id: string,
  player: { name: string; level: number; hp: number; maxHp: number; atk: number; def: number; potions: number; carrots: number; treats: number; ramen: number },
  zoneLevel: number,
  seed: number,
  flagsIn: BattleState["flagsIn"] = {},
): BattleState {
  const def = makeEnemy(id, zoneLevel);
  const st: BattleState = {
    enemy: { ...def, hp: def.hp, maxHp: def.hp, spareable: false, actsUsed: [] },
    player: { ...player, hp: Math.min(player.hp, player.maxHp) },
    phase: "dialogue",
    menu: 1, sub: 0, subOpen: false,
    msgs: [...(ENEMY_LINES[id]?.intro ?? [{ text: `A ${def.name} blocks the path.` }])],
    msgIndex: 0,
    bullets: [],
    soul: { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 },
    box: { ...BOX },
    bar: { pos: 0, dir: 1, locked: null },
    turn: 0, turnT: 0,
    rng: mkRng(seed),
    shake: 0, flash: 0, hitInv: 0,
    result: null,
    flagsIn,
    enemyMood: 0,
    over: false,
    resonance: false, resonanceShown: false,
  };
  st._after = "menu"; // the intro monologue hands you the menu, not an ambush
  // a town that already made peace recognizes you
  if (id === "hare" && flagsIn.sparedHare) { st.enemy.actsUsed.push("Pet"); st.enemyMood = 1; }
  if (id === "hound" && flagsIn.sparedHound) { st.enemy.actsUsed.push("Heel"); st.enemyMood = 1; }
  // story debts follow you into every board
  if (id === "hobgoblin" && flagsIn.sparedHob) { st.enemy.actsUsed.push("Name"); st.enemyMood = 2; }
  if (id === "hknife" && flagsIn.savedPair) { st.enemy.actsUsed.push("Names"); st.enemyMood = 1; }
  if (id === "bat" && flagsIn.emberBond) { st.enemy.actsUsed.push("Pet"); st.enemyMood = 2; }
  if (id === "revenant" && flagsIn.kangTaught) { st.enemy.actsUsed.push("Listen"); }
  if (id === "irontusk" && flagsIn.chainedTusk) { st.enemy.hp = Math.round(st.enemy.hp * 0.82); st.enemy.maxHp = st.enemy.hp; }
  refreshSparable(st);
  return st;
}

// ---------------- menus ----------------

export function menuItems(st: BattleState): { label: string; enabled: boolean }[] {
  switch (st.menu) {
    case 0: return [{ label: "Fight — close the bar on its face", enabled: true }];
    case 1: {
      const acts = ACT_LIST[st.enemy.id] ?? ["Check"];
      return acts.map((a) => ({ label: a, enabled: true })).concat([{ label: "Back", enabled: true }]);
    }
    case 2: return [
      { label: `POTION ×${st.player.potions} — heal 45%`, enabled: st.player.potions > 0 },
      { label: `RAMEN ×${st.player.ramen} — heal 25 + stop the hum`, enabled: st.player.ramen > 0 },
      { label: `CARROT ×${st.player.carrots} — throw a carrot`, enabled: st.player.carrots > 0 },
      { label: `DOG TREAT ×${st.player.treats} — throw a treat`, enabled: st.player.treats > 0 },
      { label: "Back", enabled: true },
    ];
    case 3: return [
      { label: "Spare", enabled: st.enemy.spareable },
      { label: "Flee", enabled: !st.enemy.noFlee },
      { label: "Back", enabled: true },
    ];
  }
  return [];
}

const ACT_LIST: Record<string, string[]> = {
  crawler: ["Check", "Coil", "Sun", "Sing"],
  rhound: ["Check", "Call", "Heel", "Throw"],
  stalker: ["Check", "Freeze", "Taunt", "Sit Down"],
  lurker: ["Check", "Surface", "Blow Bubbles", "Clap"],
  dsentry: ["Check", "At Ease", "Salute", "Countermand"],
  reed: ["Check", "Sway", "Braid", "Weave"],
  bat: ["Check", "Pet", "Feed", "Warm"],
  golem: ["Check", "Outmaneuver", "Polish", "Challenge"],
  revenant: ["Check", "Listen", "Kang's Name", "Pity"],
  gsent: ["Check", "Salute", "Report", "Dismiss"],
  hknife: ["Check", "Names", "Remove Helm", "Jino", "Hana"],
  acolyte: ["Check", "Snuff", "Confess", "Extinguish"],
  hobgoblin: ["Check", "Name", "Cross Armor", "Roar"],
  sentinel: ["Check", "Polish", "Lullaby", "Order"],
  irontusk: ["Check", "Unchain", "Taunt", "Chain"],
  alpha: ["Check", "Howl", "Bow", "Challenge"],
  warden: ["Check", "Yield", "Ask", "Refuse"],
  hare: ["Check", "Pet", "Feed", "Dance"],
  hound: ["Check", "Heel", "Treat", "Throw"],
  imp: ["Check", "Threaten", "Trade", "Mirror"],
  wight: ["Check", "Listen", "Pity", "Challenge"],
  kesh: ["Check", "Appraise", "Bow", "Pledge", "Threaten"],
  architect: ["Check", "Speak", "Refuse", "Plead"],
  sentry: ["Check", "Taunt", "Bow", "Pray"],
};

// ---------------- state transitions ----------------

export function confirmAtMenu(st: BattleState) {
  if (st.subOpen) {
    const items = menuItems(st);
    const it = items[st.sub];
    if (!it) return;
    if (it.label === "Back") { st.subOpen = false; return; }
    if (!it.enabled) { st.shake = 6; return; }
    st.subOpen = false;
    if (st.menu === 0) { st.phase = "target"; st.bar.pos = 0; st.bar.dir = 1; st.bar.locked = null; return; }
    if (st.menu === 1) doAct(st, it.label);
    if (st.menu === 2) doItem(st, it.label);
    if (st.menu === 3) {
      if (it.label === "Spare") return doSpare(st);
      return doFlee(st);
    }
  } else if (st.phase === "menu") {
    st.subOpen = true; st.sub = 0;
  }
}

export function navMenu(st: BattleState, dx: number, dy: number) {
  if (st.subOpen) {
    const n = menuItems(st).length;
    st.sub = (st.sub + dy + n) % n;
  } else {
    st.menu = ((st.menu + dx + 4) % 4) as 0 | 1 | 2 | 3;
  }
}

function pushMsg(st: BattleState, lines: (Line | string)[], then: BattleState["phase"] | "enemy" = "enemy") {
  st.msgs = lines; st.msgIndex = 0; st.phase = "dialogue";
  (st as BattleState & { _after?: string })._after = then === "enemy" ? "enemy" : then;
}

function doAct(st: BattleState, label: string) {
  st.enemy.actsUsed.push(label);
  const table = ENEMY_LINES[st.enemy.id]?.acts?.[label];
  let lines: (Line | string)[] = table ? [table[Math.floor(st.rng() * table.length) % table.length]] : [`You use ${label}. Nothing changes. The System rates it 6/10.`];
  if (label === "Check" && table) lines = [table[0]];
  if (label === "Feed" && st.player.carrots > 0) { st.player.carrots--; st.enemyMood += 1; }
  if (label === "Treat" && st.player.treats > 0) { st.player.treats--; st.enemyMood += 1; }
  if (label === "Trade" && st.player.potions >= 0) { st.player.carrots += 0; st.enemyMood += 1; }
  refreshSparable(st);
  if (st.enemy.spareable) {
    const ready = ENEMY_LINES[st.enemy.id]?.spareReady;
    if (ready) lines = lines.concat([pick(st, ready)]);
  }
  pushMsg(st, lines);
}

function doItem(st: BattleState, label: string) {
  if (label.startsWith("POTION")) { st.player.potions--; const h = Math.round(st.player.maxHp * 0.45); st.player.hp = Math.min(st.player.maxHp, st.player.hp + h); pushMsg(st, [{ text: `You drink the System potion. +${h}. It tastes like a participation trophy made of water.` }]); }
  else if (label.startsWith("RAMEN")) { st.player.ramen--; const h = 25 + Math.round(st.player.maxHp * 0.12); st.player.hp = Math.min(st.player.maxHp, st.player.hp + h); pushMsg(st, [{ text: `Baek's ramen. +${h}. It is aggressive broth and you accept the terms.` }]); }
  else if (label.startsWith("CARROT")) { st.player.carrots--; if (st.enemy.id === "hare") { st.enemyMood += 2; refreshSparable(st); pushMsg(st, [{ text: "The carrot arcs. The Rimehare catches it mid-thought. The axe is now an accessory." }]); return; } pushMsg(st, [{ text: "You throw a carrot at a non-rabbit. The System declines to comment." }]); }
  else if (label.startsWith("DOG TREAT")) { st.player.treats--; if (st.enemy.id === "hound") { st.enemyMood += 2; refreshSparable(st); pushMsg(st, [{ text: "Treat deployed. Stone Hound has reclassified you from 'prey' to 'staff'." }]); return; } pushMsg(st, [{ text: "You throw a treat. Something in the ridge hears it land and files noise complaint paperwork." }]); }
  // items still consume the turn (the enemy swings)
  (st as BattleState & { _after?: string })._after = "enemy";
}

function doSpare(st: BattleState) {
  if (!st.enemy.spareable) {
    pushMsg(st, [{ text: `You reach out an open hand. ${st.enemy.name} is NOT ready. (Use ACTs — earn it.)` }], "enemy");
    (st as BattleState & { _after?: string })._after = "enemy";
    return;
  }
  st.phase = "spared";
  st.msgs = ENEMY_LINES[st.enemy.id]?.spared ?? [{ text: "You spare them." }];
  st.msgIndex = 0;
  st.result = { outcome: "spare", sp: 0, gold: Math.round(st.enemy.gold * 0.4), text: "spared" };
  st.over = true;
}

function doFlee(st: BattleState) {
  const chance = clamp(0.35 + st.player.level * 0.03 + st.enemyMood * 0.1, 0.2, 0.9);
  if (st.rng() < chance) {
    st.phase = "fled";
    st.result = { outcome: "flee", sp: 0, gold: 0, text: "escaped" };
    st.over = true;
  } else {
    pushMsg(st, [{ text: "You attempt to flee. The dungeon's exit is spiritually locked and it knows where you sleep." }], "enemy");
    (st as BattleState & { _after?: string })._after = "enemy";
  }
}

function refreshSparable(st: BattleState) {
  const needs = st.enemy.spareNeeds;
  st.enemy.spareable = needs.length > 0 && needs.every((group) => group.some((a) => st.enemy.actsUsed.includes(a)));
  // wounded-and-warm enemies soften regardless
  if (st.enemyMood >= 2 && st.enemy.hp / st.enemy.maxHp < 0.55) st.enemy.spareable = true;
}

// ---------------- player attack ----------------

export function lockBar(st: BattleState) {
  if (st.bar.locked !== null) return;
  st.bar.locked = st.bar.pos;
  const center = Math.abs(st.bar.pos); // 0 = dead center
  const mult = clamp(1.95 - center * 2.55, 0.55, 1.95);
  const perfect = center < 0.048;
  let dmg = Math.max(1, Math.round(st.player.atk * mult) - st.enemy.def);
  if (perfect) dmg = Math.round(dmg * 1.25);
  if (st.enemyMood >= 2) dmg = Math.round(dmg * 0.85); // it flinches, you feel it
  st.enemy.hp = Math.max(0, st.enemy.hp - dmg);
  st.fightMsg = perfect ? `PERFECT — ${dmg}!` : `You strike for ${dmg}.`;
  st.shake = 8;
  if (st.enemy.hp <= 0) return killEnemy(st);
  const band = st.enemy.hp / st.enemy.maxHp < 0.35 ? "low" : "idle";
  const lines: string[] = ENEMY_LINES[st.enemy.id]?.[band] ?? [];
  pushMsg(st, [st.fightMsg ?? "You strike."].concat(lines));
  refreshSparable(st);
}

function killEnemy(st: BattleState) {
  const death = ENEMY_LINES[st.enemy.id]?.death ?? [];
  st.phase = "won";
  st.msgs = death.length ? death : [{ text: `${st.enemy.name} falls.` }];
  st.msgIndex = 0;
  st.result = { outcome: "win", sp: st.enemy.sp, gold: st.enemy.gold + Math.floor(st.rng() * 6), text: "killed" };
  st.over = true;
}

// ---------------- enemy turn / bullets ----------------

const PATTERNS: Record<string, { list: string[] }> = {
  crawler: { list: ["hops", "rain"] },
  rhound: { list: ["charges", "rain"] },
  stalker: { list: ["wall", "hops"] },
  lurker: { list: ["ring", "hops"] },
  dsentry: { list: ["wall", "rain"] },
  reed: { list: ["wave", "rain"] },
  bat: { list: ["homing", "rain"] },
  golem: { list: ["quake", "wall"] },
  revenant: { list: ["homing", "wave"] },
  gsent: { list: ["wall", "ring"] },
  hknife: { list: ["charges", "rain", "wall"] },
  acolyte: { list: ["ring", "homing"] },
  hobgoblin: { list: ["charges", "rain", "wave"] },
  sentinel: { list: ["quake", "ring", "wall"] },
  irontusk: { list: ["charges", "quake", "rain"] },
  alpha: { list: ["rain", "charges", "ring", "wave"] },
  warden: { list: ["wall", "ring", "homing", "quake"] },
  hare: { list: ["rain", "hops"] },
  hound: { list: ["charges", "wave"] },
  imp: { list: ["rain", "ring", "charges"] },
  wight: { list: ["homing", "wall"] },
  kesh: { list: ["charges", "rain", "ring", "quake"] },
  architect: { list: ["ring", "wall", "homing", "quake"] },
  sentry: { list: ["wall", "charges", "rain", "ring", "homing"] },
};

export function beginEnemyTurn(st: BattleState) {
  st.phase = "enemyTurn";
  st.turn++;
  st.turnT = st.enemy.turnTime + Math.min(2.5, st.turn * 0.35);
  st.bullets = [];
  st.soul = { x: st.box.x + st.box.w / 2, y: st.box.y + st.box.h / 2 };
  // boxes shrink slightly on late turns of hard fights (wights, the Architect)
  if ((st.enemy.id === "wight" || st.enemy.id === "architect") && st.turn >= 2) {
    st.box = { x: BOX.x + 130, y: BOX.y, w: BOX.w - 260, h: BOX.h };
  } else st.box = { ...BOX };
  st._pattern = PATTERNS[st.enemy.id]?.list[(st.turn - 1) % (PATTERNS[st.enemy.id]?.list.length ?? 1)] ?? "rain";
}

export function advanceDialogue(st: BattleState) {
  st.msgIndex++;
  if (st.msgIndex >= st.msgs.length) {
    const after = (st as BattleState & { _after?: string })._after;
    (st as BattleState & { _after?: string })._after = undefined;
    if (after === "menu") { st.phase = "menu"; st.subOpen = false; }
    else beginEnemyTurn(st);
  }
}

export function menuReady(st: BattleState) {
  st.phase = "menu";
  st.bullets = [];
  st.subOpen = false;
}

export interface StepInput { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; }

/** Campaign stats: HP is SMALL at low level — the dungeon respects the grind.
 *  Readied by the real-world daily streak: fatigue scales everything down. */
export function campaignStats(level: number, str: number, _agi: number, vit: number, fatigue: number) {
  const rdy = readinessFromFatigue(fatigue);
  return {
    maxHP: Math.max(8, Math.round((24 + 7 * level + 1.5 * vit) * rdy.hpMultiplier)),
    atk: Math.max(3, Math.round((6 + 2 * level + 1.2 * str) * rdy.atkMultiplier)),
    def: Math.max(0, Math.round((2 + 0.75 * level + 0.4 * vit) * rdy.defMultiplier)),
  };
}

/** advance the battle by dt seconds. Mutates and returns st. */
export function stepBattle(st: BattleState, input: StepInput, dt: number): BattleState {
  st.shake = Math.max(0, st.shake - dt * 30);
  st.flash = Math.max(0, st.flash - dt * 2.2);
  st.hitInv = Math.max(0, st.hitInv - dt);
  if (st.over) return st;

  // RESONANCE — the System's fairness clause: if you out-train this monster by
  // two real-world levels, being bad at the game is allowed to hurt but not to
  // kill. It knits you back at half health. If you are UNDER-leveled, nothing
  // saves you, because the point was never the dungeon.
  st.resonance = st.player.level - st.enemy.zoneLevel >= 2 && st.player.hp > 0 && st.player.hp <= st.player.maxHp * 0.5;
  if (st.resonance) st.player.hp = Math.min(st.player.maxHp, st.player.hp + st.player.maxHp * 0.055 * dt);

  if (st.phase === "target") {
    if (st.bar.locked === null) {
      st.bar.pos += st.bar.dir * dt * 1.85;
      if (st.bar.pos > 1) { st.bar.pos = 1; st.bar.dir = -1; }
      if (st.bar.pos < -1) { st.bar.pos = -1; st.bar.dir = 1; }
    }
    return st;
  }

  if (st.phase !== "enemyTurn") return st;

  // soul
  const sp = 96 + st.player.level * 0.35;
  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
  const SW = 8, SH = 8;
  st.soul.x = clamp(st.soul.x + vx * sp * dt, st.box.x + SW / 2, st.box.x + st.box.w - SW / 2);
  st.soul.y = clamp(st.soul.y + vy * sp * dt, st.box.y + SH / 2, st.box.y + st.box.h - SH / 2);

  st.turnT -= dt;

  // spawn & move bullets
  const b = st.box;
  spawnFor(st, dt);
  for (const p of st.bullets) {
    p.windup = Math.max(0, p.windup - dt);
    if (p.windup === 0) { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (p.grow) { p.w = Math.min(p.grow, p.w + 60 * dt); p.h = p.w; }
    p.ttl -= dt;
    if (p.homeX !== undefined && p.homeY !== undefined) {
      p.x = p.homeX + Math.cos((p.phase ?? 0) + st.turn * 2) * 26;
      p.y = p.homeY + Math.sin((p.phase ?? 0) + st.turn * 2) * 26;
    }
  }
  st.bullets = st.bullets.filter((p) =>
    p.ttl > 0 && p.x > b.x - 40 && p.x < b.x + b.w + 40 && p.y > b.y - 50 && p.y < b.y + b.h + 40);

  // collisions
  if (st.hitInv === 0) {
    for (const p of st.bullets) {
      if (p.windup > 0) continue;
      if (rectsOverlap(st.soul.x - SW / 2, st.soul.y - SH / 2, SW, SH, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
        const dmg = Math.max(1, Math.round(st.enemy.atk * 0.32 - st.player.def * 0.18));
        st.player.hp = Math.max(0, st.player.hp - dmg);
        st.hitInv = 0.7;
        st.flash = 1;
        if (st.player.hp <= 0) {
          st.phase = "dead"; st.over = true;
          st.result = { outcome: "death", sp: 0, gold: 0, text: "died" };
          return st;
        }
        break;
      }
    }
  }

  if (st.turnT <= 0) {
    st.bullets = [];
    const lines = ENEMY_LINES[st.enemy.id]?.idle ?? [];
    pushMsg(st, lines.length ? [pick(st, lines)] : [{ text: "..." }], "menu");
  }
  return st;
}

function pick(st: BattleState, arr: string[]): Line {
  return { text: arr[Math.floor(st.rng() * arr.length) % arr.length] };
}

function spawnFor(st: BattleState, dt: number) {
  st._spawnT = (st._spawnT ?? 0) + dt;
  const b = st.box;
  const r = st.rng;
  const p = st._pattern;
  const speed = 70 + st.enemy.zoneLevel * 3 + st.turn * 6;
  const S = (o: Partial<Bullet>) => st.bullets.push({ x: 0, y: 0, vx: 0, vy: 0, w: 8, h: 8, shape: "rect", ttl: 9, windup: 0, ...o } as Bullet);

  if (p === "rain") { // icicles from the top with safe pockets
    if (st._spawnT > 0.22) {
      st._spawnT = 0;
      const x = b.x + 10 + r() * (b.w - 20);
      S({ x, y: b.y - 10, w: 6, h: 14, vy: speed * 1.15, windup: 0.18, color: "#bfe8ff" });
    }
  } else if (p === "hops") { // carrots bouncing along the floor
    if (st._spawnT > 0.85) {
      st._spawnT = 0;
      const fromLeft = r() < 0.5;
      S({ x: fromLeft ? b.x - 10 : b.x + b.w + 10, y: b.y + b.h - 14, vx: (fromLeft ? 1 : -1) * (speed * 0.8), w: 10, h: 10, color: "#f09a48", ttl: 7 });
    }
  } else if (p === "charges") { // horizontal runs, gaps to stand in
    if (st._spawnT > 0.6) {
      st._spawnT = 0;
      const y = b.y + 12 + r() * (b.h - 24);
      const fromLeft = r() < 0.5;
      S({ x: fromLeft ? b.x - 14 : b.x + b.w + 14, y, w: 22, h: 8, vx: (fromLeft ? 1 : -1) * speed * 1.4, color: "#ffd0d8" });
    }
  } else if (p === "ring") { // radial spokes from a wandering center
    if (st._spawnT > 1.1) {
      st._spawnT = 0;
      const cx = b.x + b.w * (0.3 + r() * 0.4), cy = b.y + b.h * (0.3 + r() * 0.4);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r();
        S({ x: cx, y: cy, vx: Math.cos(a) * speed * 0.75, vy: Math.sin(a) * speed * 0.75, w: 7, h: 7, shape: "circle", color: "#cfd8ff", windup: 0.25 });
      }
    }
  } else if (p === "homing") { // slow lanterns that lean toward the soul
    if (st._spawnT > 1.4) {
      st._spawnT = 0;
      const edge = r() * 4;
      const x = edge < 2 ? (edge === 0 ? b.x - 12 : b.x + b.w + 12) : b.x + r() * b.w;
      const y = edge < 2 ? b.y + r() * b.h : (edge === 2 ? b.y - 12 : b.y + b.h + 12);
      const a = Math.atan2(st.soul.y - y, st.soul.x - x);
      S({ x, y, vx: Math.cos(a) * speed * 0.45, vy: Math.sin(a) * speed * 0.45, w: 9, h: 9, shape: "circle", color: "#9ff3d0", ttl: 6 });
    }
  } else if (p === "wall") { // sliding walls with a gap to thread
    if (st._spawnT > 1.5) {
      st._spawnT = 0;
      const gap = b.y + 14 + r() * (b.h - 40);
      const fromLeft = r() < 0.5;
      S({ x: fromLeft ? b.x - 8 : b.x + b.w + 8, y: b.y - 4, w: 6, h: gap - b.y + 4, vx: (fromLeft ? 1 : -1) * speed * 0.55, color: "#8fa0c8" });
      S({ x: fromLeft ? b.x - 8 : b.x + b.w + 8, y: gap + 22, w: 6, h: b.y + b.h - gap - 18, vx: (fromLeft ? 1 : -1) * speed * 0.55, color: "#8fa0c8" });
    }
  } else if (p === "wave") { // sine train across mid-box
    if (st._spawnT > 0.34) {
      st._spawnT = 0;
      st._waveT = (st._waveT ?? 0) + 1;
      S({ x: b.x + b.w + 12, y: b.y + b.h / 2 + Math.sin(st._waveT * 0.7) * (b.h / 3), vx: -speed * 1.05, w: 10, h: 10, shape: "circle", color: "#b9c9de" });
    }
  } else if (p === "quake") { // rising shock columns from the floor
    if (st._spawnT > 0.95) {
      st._spawnT = 0;
      const n = 3 + (st.turn % 2);
      for (let i = 0; i < n; i++) {
        const x = b.x + 16 + ((b.w - 32) / (n - 1 || 1)) * i + (r() - 0.5) * 10;
        S({ x, y: b.y + b.h + 8, vy: -speed * 0.9, w: 12, h: 12, windup: 0.35, color: "#d8a06a", grow: 12, ttl: 3.2 });
      }
    }
  }
}

