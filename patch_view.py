import re
p = 'src/game/view.ts'
s = open(p).read()

def rep(old, new, cnt=1):
    global s
    assert old in s, "MISSING: " + old[:90]
    s = s.replace(old, new, cnt)

# ---- imports ----
rep('''import {
  buildWorld, buildCollider, solidAtGrid, MAP_PX, zoneAt, routeOf, totalKills,
  freshFlags, type WorldDef, type WorldFlags, type WorldSaveData,
} from "./world";''','''import {
  buildWorld, buildCollider, solidAtGrid, MAP_PX, zoneAt, routeOf, totalKills,
  freshFlags, type WorldDef, type WorldFlags, type WorldSaveData,
} from "./world";''')
rep('''import {
  NPC, sign as signLines, intro as introLines, ENDINGS, SHOP_INTRO, SHOP_ITEMS,
  shopThanks, shopNoGold, gateHint, bossGateHint, WELCOME_BACK, levelUpToast, type Line,
} from "./script";''','''import {
  getNpc, signAll, ENDINGS, SHOP_INTRO, SHOP_ITEMS,
  shopThanks, shopNoGold, gateHint, bossGateHint, WELCOME_BACK, levelUpToast,
  prologue, regionArrive, bossGate as bossGateScript, bossAfter, ceremony as ceremonyLines, ceremonyAnswer, epilogue, nextObjective, type Line,
} from "./script";''')
rep('import { deriveBattleStats } from "../lib/battle";','''import { deriveBattleStats, readinessFromFatigue } from "../lib/battle";

/** Campaign stats: HP is SMALL at low level — the dungeon respects the grind. */
export function campaignStats(level: number, str: number, agi: number, vit: number, fatigue: number) {
  const rdy = readinessFromFatigue(fatigue);
  const mult = rdy.mult ?? 1;
  return {
    maxHP: Math.max(8, Math.round((24 + 7 * level + 1.5 * vit) * mult)),
    atk: Math.max(3, Math.round((6 + 2 * level + 1.2 * str) * (0.72 + 0.28 * mult))),
    def: Math.round(2 + 0.75 * level + 0.4 * vit),
  };
}''')
rep('const SAVE_KEY = "sl_ashenveil_v1";','const SAVE_KEY = "sl_ashenveil_v2";\nconst OLD_SAVE_KEY = "sl_ashenveil_v1";')

# ---- mode + fields ----
rep('type Mode = "boot" | "intro" | "world" | "talk" | "shop" | "status" | "battle" | "over" | "ending";','type Mode = "boot" | "intro" | "world" | "talk" | "shop" | "status" | "battle" | "over" | "ending" | "choice";')
rep('''  private world: WorldDef;
  private collider: Uint8Array;''','''  private world: WorldDef;
  private regionId = "verdant";
  private zoom = 2;
  private hasSave = false;
  private choice: { lines: Line[]; idx: number; opts: { label: string; run: () => void }[]; sel: number } | null = null;
  private shopName = "MISOL'S EVERYTHING";
  private canvasEl: HTMLCanvasElement;
  private keyHud: (e: KeyboardEvent) => void;
  private collider: Uint8Array;''')

# ---- constructor ----
rep('''  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W; canvas.height = VIEW_H;
    this.g = canvas.getContext("2d")!;
    this.g.imageSmoothingEnabled = false;
    this.world = buildWorld();
    const save = readSave<WorldSaveData>(SAVE_KEY);
    this.flags = save ? { ...freshFlags(), ...save.flags } : freshFlags();
    this.collider = buildCollider(this.world, this.flags);
    this.px = save?.x ?? this.world.spawn.x;
    this.py = save?.y ?? this.world.spawn.y;
    if (save) this.toast = { text: WELCOME_BACK[0].text, t: 4.5 };
    this.buildSprites();
    const img = new Image();
    img.onload = () => { this.bg = img; this.bgReady = true; };
    img.src = "art/ashenveil-ground.png";
    this.input.attach();
    this.lastLevel = useGame.getState().level;
  }''','''  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W; canvas.height = VIEW_H;
    this.canvasEl = canvas;
    this.g = canvas.getContext("2d")!;
    this.g.imageSmoothingEnabled = false;
    let save = readSave<WorldSaveData>(SAVE_KEY);
    if (!save) {
      // migrate the v1 Ashenveil-only save: the old town keeps its ledger
      const v1 = readSave<{ x: number; y: number; flags: WorldFlags }>(OLD_SAVE_KEY);
      if (v1) save = { region: "ashenveil", x: v1.x, y: v1.y, flags: v1.flags };
    }
    this.hasSave = !!save;
    this.regionId = save?.region ?? "verdant";
    this.world = buildWorld(this.regionId);
    this.flags = save ? { ...freshFlags(), ...save.flags } : freshFlags();
    this.collider = buildCollider(this.world, this.flags);
    this.px = save?.x ?? this.world.spawn.x;
    this.py = save?.y ?? this.world.spawn.y;
    if (save) this.toast = { text: WELCOME_BACK[0].text, t: 4.5 };
    this.buildSprites();
    this.loadBg(this.world.region.ground);
    // hotkeys that don't live in the game Input: fullscreen, zoom, tracker peek
    this.keyHud = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void this.canvasEl.parentElement?.requestFullscreen?.().catch(() => {});
      }
      if (e.key === "+" || e.key === "=") this.zoom = Math.min(4, this.zoom + 1);
      if (e.key === "-" || e.key === "_") this.zoom = Math.max(1, this.zoom - 1);
      if (e.key === "0") this.zoom = 2;
      if (e.key === "t" || e.key === "T") {
        const obj = nextObjective(this.flags, this.regionId);
        if (obj) this.flags.trackerSeen[obj.key] = true;
      }
    };
    window.addEventListener("keydown", this.keyHud);
    this.input.attach();
    this.lastLevel = useGame.getState().level;
  }''')
rep('''  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    Sfx.stopMusic();
    this.started = false;
  }''','''  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.keyHud);
    this.input.detach();
    Sfx.stopMusic();
    this.started = false;
  }
  private loadBg(src: string) {
    this.bgReady = false;
    const img = new Image();
    img.onload = () => { this.bg = img; this.bgReady = true; };
    img.src = src;
  }
  /** Cross-region travel with a fade; returns at the destination's spawn. */
  private travelTo(id: string, arrive = true) {
    this.transDir = 1;
    this.pendingMode = () => {
      this.regionId = id;
      this.world = buildWorld(id);
      this.collider = buildCollider(this.world, this.flags);
      this.px = this.world.spawn.x; this.py = this.world.spawn.y;
      this.loadBg(this.world.region.ground);
      this.mode = "world";
      Sfx.playMusic(this.world.region.music);
      if (arrive) {
        const lines = regionArrive(id, this.flags);
        if (lines.length) { this.pages = { lines, idx: 0, t: 0 }; this.mode = "talk"; }
      }
    };
  }''')

# ---- boot/intro ----
rep('''      case "boot":
        if (this.input.pressed("confirm")) {
          Sfx.select();
          this.pages = { lines: introLines(useGame.getState().name || "HUNTER"), idx: 0, t: 0 };
          this.mode = "intro";
        }
        break;
      case "intro": this.updatePages(dt, () => { this.mode = "world"; Sfx.playMusic("town"); }); break;''','''      case "boot":
        if (this.input.pressed("confirm")) {
          Sfx.select();
          if (this.hasSave) { this.mode = "world"; Sfx.playMusic(this.world.region.music); break; }
          this.pages = { lines: prologue(useGame.getState().name || "HUNTER"), idx: 0, t: 0 };
          this.mode = "intro";
        }
        break;
      case "intro": this.updatePages(dt, () => {
        this.mode = "world"; this.flags.introDone = true;
        Sfx.playMusic(this.world.region.music);
      }); break;
      case "choice": this.updateChoice(); break;''')

# ---- updateWorld extras ----
rep('''    if (this.input.pressed("cancel")) { this.mode = "status"; Sfx.open(); return; }
    if (this.input.pressed("confirm")) this.interact();
  }''','''    if (this.input.pressed("cancel")) { this.mode = "status"; Sfx.open(); return; }
    if (this.input.pressed("confirm")) this.interact();
  }

  private updateChoice() {
    const c = this.choice;
    if (!c) { this.mode = "world"; return; }
    if (c.idx < c.lines.length) {
      this.pages = { lines: c.lines, idx: c.idx, t: 0 };
      // reuse the page typer: confirm advances
      const cur = c.lines[c.idx];
      c_sel_loop: {
        if (this.input.pressed("confirm")) { c.idx++; Sfx.select(); }
      }
      void cur; void c_sel_loop;
      this.pages = null;
      if (c.idx >= c.lines.length) { /* fall through to options */ }
      else return;
    }
    if (this.input.pressed("down") || this.input.pressed("up")) { c.sel = c.sel === 0 ? 1 : 0; Sfx.move(); }
    if (this.input.pressed("confirm")) {
      Sfx.select();
      const run = c.opts[c.sel].run;
      this.choice = null;
      run();
    }
  }''')

# ---- encounters: adaptive level, region clear rules ----
rep('''  private encounterTick() {
    if (this.encCooldown > 0) return;
    const z = zoneAt(this.world, this.px, this.py);
    if (!z) return;
    const cleared = (z.id === "pines" && this.flags.killsPines >= z.quota) || (z.id === "ridge" && this.flags.killsRidge >= z.quota);
    if (cleared) return;
    if (this.steps > 190 + Math.random() * 320) {
      this.steps = 0;
      const id = z.enemies[Math.floor(Math.random() * z.enemies.length)];
      Sfx.encounter();
      this.beginBattle(id, z.level);
    }
  }''','''  private encounterTick() {
    if (this.encCooldown > 0) return;
    const z = zoneAt(this.world, this.px, this.py);
    if (!z) return;
    const cleared = this.regionId === "ashenveil"
      ? (z.id === "pines" && this.flags.killsPines >= z.quota) || (z.id === "ridge" && this.flags.killsRidge >= z.quota)
      : !!(this.world.boss && this.flags.bossDown[this.world.boss.id]);
    if (cleared) return;
    if (this.steps > 190 + Math.random() * 320) {
      this.steps = 0;
      const id = z.enemies[Math.floor(Math.random() * z.enemies.length)];
      Sfx.encounter();
      // ADAPTIVE: the wild scales to YOU, clamped to the floor's band. Too low
      // and it fights at the floor's minimum (it will still hurt you). Too high
      // and it caps at the band's max — strong, but beatable by skill.
      const lvl = useGame.getState().level;
      const eff = Math.max(z.min ?? 1, Math.min(z.max ?? 40, lvl));
      this.beginBattle(id, eff, false);
    }
  }''')

# ---- nearestInteract: exits, bosses, hideAfter prefixes ----
rep('''    for (const n of this.world.npcs) {
      if (n.hideAfter && this.flags[n.hideAfter as keyof WorldFlags]) continue;
      consider(n.x * TILE + 8, n.y * TILE, "npc", n.dialogue);
    }''','''    for (const n of this.world.npcs) {
      if (n.hideAfter && this.hideFlag(n.hideAfter)) continue;
      consider(n.x * TILE + 8, n.y * TILE, "npc", n.dialogue);
    }
    if (this.world.boss && !this.flags.bossDown[this.world.boss.id]) {
      const bo = this.world.boss;
      consider(bo.x * TILE + 8, (bo.y + 1) * TILE, "prop", "boss");
    }
    if (this.world.exit) {
      const ex = this.world.exit;
      consider(ex.x * TILE + 8, ex.y * TILE + 8, "prop", "exit");
    }''')
rep('''  private interact() {
    const hit = this.nearestInteract();
    if (!hit) return;
    if (hit.kind === "prop" && hit.key === "save") { this.saveGame(); return; }
    if (hit.kind === "prop" && hit.key === "bossGate") { this.startBoss(); return; }
    if (hit.kind === "prop" && hit.key === "gate") { this.tryGate(); return; }
    const ctx = { f: this.flags, name: useGame.getState().name || "HUNTER", level: useGame.getState().level };
    if (hit.key === "shop.miso") {
      this.pages = { lines: SHOP_INTRO, idx: 0, t: 0, after: () => { this.mode = "shop"; this.shopSel = 0; } };
      this.mode = "talk"; Sfx.open(); return;
    }
    const tree = NPC[hit.key];
    if (tree) {
      this.pages = { lines: tree(ctx), idx: 0, t: 0 };
      this.pageAfter = () => this.afterTalk(hit.key);
      this.mode = "talk"; Sfx.open();
    } else {
      this.pages = { lines: signLines(hit.key, this.flags), idx: 0, t: 0 };
      this.mode = "talk"; Sfx.open();
    }
  }''','''  private hideFlag(key: string): boolean {
    if (key.startsWith("genocide")) return this.flags.genocideZone;
    return !!this.flags[key as keyof WorldFlags];
  }

  private interact() {
    const hit = this.nearestInteract();
    if (!hit) return;
    if (hit.kind === "prop" && hit.key === "save") { this.saveGame(); return; }
    if (hit.kind === "prop" && hit.key === "bossGate") { this.startBoss(); return; }
    if (hit.kind === "prop" && hit.key === "gate") { this.tryGate(); return; }
    if (hit.kind === "prop" && hit.key === "boss") { this.startRegionBoss(); return; }
    if (hit.kind === "prop" && hit.key === "exit") { this.tryExit(); return; }
    if (hit.kind === "prop" && hit.key === "goBack") { this.travelTo("citadel", false); this.px = 31 * TILE; this.py = 52 * TILE; return; }
    if (hit.kind === "prop" && hit.key === "plaza.shrine") {
      this.pages = { lines: this.flags.bossDown["hobgoblin"]
        ? [{ text: "The shrine is quiet. The bowl by the door is still full; somebody feeds the ruin, and the ruin feeds back. The moss pile grows one rake-width a day." }]
        : [{ text: "An altar kept by a monster: moss raked into a pile, steps swept, a bowl by the door. The System marks the site: TENANT. DO NOT DISTURB. Below it, smaller: he is at home. The question is which of you is visiting." }], idx: 0, t: 0 };
      this.mode = "talk"; Sfx.open(); return;
    }
    const ctx = { f: this.flags, name: useGame.getState().name || "HUNTER", level: useGame.getState().level };
    if (hit.key === "shop.miso" || hit.key === "shop.sila") {
      this.shopName = hit.key === "shop.sila" ? "SILA'S CONTRABAND" : "MISOL'S EVERYTHING";
      this.pages = { lines: SHOP_INTRO, idx: 0, t: 0, after: () => { this.mode = "shop"; this.shopSel = 0; } };
      this.mode = "talk"; Sfx.open(); return;
    }
    const tree = getNpc(hit.key, ctx);
    if (tree) {
      this.pages = { lines: tree, idx: 0, t: 0 };
      this.pageAfter = () => this.afterTalk(hit.key);
      this.mode = "talk"; Sfx.open();
    } else {
      this.pages = { lines: signAll(hit.key, this.flags), idx: 0, t: 0 };
      this.mode = "talk"; Sfx.open();
    }
  }
  private tryExit() {
    const ex = this.world.exit!;
    const locked = this.world.boss && !this.flags.bossDown[this.world.boss.id];
    if (locked) {
      this.pages = { lines: [{ text: `The way to the ${ex.label} is bricked up. The dungeon files it as 'for your safety.' The floor above ${this.world.boss ? `has a resident, and residents get consulted before construction` : "?"}` }], idx: 0, t: 0 };
      this.mode = "talk"; return;
    }
    this.travelTo(ex.to);
  }
  private startRegionBoss() {
    const bo = this.world.boss!;
    Sfx.bossIntro();
    this.pages = { lines: bossGateScript(bo.id, this.flags), idx: 0, t: 0, after: () => this.beginBattle(bo.id, bo.level, true) };
    this.mode = "talk";
  }''')
rep('''  private afterTalk(key: string) {
    const f = this.flags;
    f.met[key] = (f.met[key] ?? 0) + 1;
    if (key === "dog.rock") f.dogFound = true;
    if (key === "kid.lost" && f.dogFound) f.dogReturned = true;
    if (key === "inn.baek" && f.dogReturned && !f.hasKey) f.hasKey = true;
  }''','''  private afterTalk(key: string) {
    const f = this.flags;
    f.met[key] = (f.met[key] ?? 0) + 1;
    if (key === "dog.rock") f.dogFound = true;
    if (key === "kid.lost" && f.dogFound) f.dogReturned = true;
    if (key === "inn.baek" && f.dogReturned && !f.hasKey) f.hasKey = true;
    if (key === "kang.caverns" && f.met[key] >= 2) f.kangBond = true;   // the second lesson is the trust
    if (key === "verity.caverns" && f.met[key] >= 1) f.met["verity.keys"] = 1;
    if (key === "ivy.citadel" && f.met[key] >= 1 && f.kangBond) f.met["ivy.lesson"] = 1;
  }''')

# ---- beginBattle: campaign stats + full flags ----
rep('''  private beginBattle(id: string, zoneLevel: number) {
    const s = useGame.getState();
    const combat = deriveBattleStats({ str: s.str, agi: s.agi, vit: s.vit, fatigueLevel: s.fatigueLevel });
    const bought = this.flags.bought;
    this.battle = createBattle(id, {
      name: (s.name || "HUNTER").toUpperCase(), level: s.level,
      hp: combat.maxHP, maxHp: combat.maxHP, atk: combat.atk, def: combat.def,
      potions: s.potions,
      carrots: bought.carrot ?? 0, treats: bought.treat ?? 0, ramen: bought.ramen ?? 0,
    }, zoneLevel, (Date.now() ^ 0x5f3759df) >>> 0, {
      sparedHare: this.flags.sparedHare, sparedHound: this.flags.sparedHound,
    });
    this.mode = "battle";
    Sfx.stopMusic();
    Sfx.playMusic(id === "kesh" || id === "architect" ? "boss" : id === "sentry" ? "final" : "battle");
  }''','''  private beginBattle(id: string, zoneLevel: number, isBoss = false) {
    const s = useGame.getState();
    const combat = campaignStats(s.level, s.str, s.agi, s.vit, s.fatigueLevel);
    const bought = this.flags.bought;
    const f = this.flags;
    this.battle = createBattle(id, {
      name: (s.name || "HUNTER").toUpperCase(), level: s.level,
      hp: combat.maxHP, maxHp: combat.maxHP, atk: combat.atk, def: combat.def,
      potions: s.potions,
      carrots: bought.carrot ?? 0, treats: bought.treat ?? 0, ramen: bought.ramen ?? 0,
    }, zoneLevel, (Date.now() ^ 0x5f3759df) >>> 0, {
      sparedHare: f.sparedHare, sparedHound: f.sparedHound,
      sparedHob: f.sparedStory["hobgoblin"], savedPair: f.savedPair,
      emberBond: f.emberBond, kangTaught: f.kangBond, chainedTusk: f.chainedTusk,
    });
    this.mode = "battle";
    Sfx.stopMusic();
    const bossIds = ["kesh", "architect", "hobgoblin", "sentinel", "irontusk", "warden", "alpha"];
    Sfx.playMusic(id === "sentry" ? "final" : isBoss || bossIds.includes(id) ? "boss" : "battle");
  }''')

# ---- endBattle: region bosses, killsTotal, epilogue ----
rep('''    if (r.outcome === "win") {
      store.awardBattle(r.sp, r.gold);
      const z = zoneAt(this.world, this.px, this.py);
      if (eid === "hare" || eid === "hound" || eid === "imp" || eid === "wight") {
        if (z?.id === "ridge") this.flags.killsRidge++; else this.flags.killsPines++;
      }
      if (eid === "kesh") { this.flags.keshKilled = true; this.flags.bossDone = true; }''','''    if (r.outcome === "win") {
      store.awardBattle(r.sp, r.gold);
      const z = zoneAt(this.world, this.px, this.py);
      if (eid === "hare" || eid === "hound" || eid === "imp" || eid === "wight") {
        if (z?.id === "ridge") this.flags.killsRidge++; else this.flags.killsPines++;
      }
      if (this.regionId === "ashenveil") this.flags.killsTotal++;
      else if (!b.enemy.boss) this.flags.killsTotal++;
      if (b.enemy.boss && this.regionId !== "ashenveil") {
        // a regional boss falls: the floor's ledger closes, the exit unblocks
        this.flags.bossDown[eid] = true;
        this.flags.regionDone[this.regionId] = true;
        this.flags.genocideZone = this.flags.killsTotal >= 14;
        this.collider = buildCollider(this.world, this.flags);
        this.battle = null;
        this.pages = { lines: bossAfter(eid, this.flags, false), idx: 0, t: 0, after: () => this.afterBossResolve(eid, false) };
        this.mode = "talk"; Sfx.save();
        return;
      }
      if (eid === "kesh") { this.flags.keshKilled = true; this.flags.bossDone = true; }''')
rep('''    if (r.outcome === "spare") {
      Sfx.spare();
      store.awardBattle(0, r.gold);
      if (eid === "hare") this.flags.sparedHare = true;
      if (eid === "hound") this.flags.sparedHound = true;
      if (eid === "kesh") { this.flags.sparedKesh = true; this.flags.bossDone = true; }
      if (eid === "architect") { this.flags.architectSpared = true; this.flags.bossDone = true; this.flags.tpDone = true; }
    }''','''    if (r.outcome === "spare") {
      Sfx.spare();
      store.awardBattle(0, r.gold);
      if (eid === "hare") this.flags.sparedHare = true;
      if (eid === "hound") this.flags.sparedHound = true;
      if (eid === "bat") this.flags.emberBond = true;
      if (eid === "hknife") {
        this.flags.savedPair = true;
        this.pages = { lines: [{ text: "The roll call ends. Down the hall, forty years of standing armor sits down at once, and a light walks out of a visor and UP, into the crack in the east wall, and the wall forgives someone. Somewhere above, in a marsh filing office that does not exist, two names move from PENDING to WALKED HOME." }, { who: "SYSTEM", text: "[SURVEY TEAM: HANA, JINO — STATUS UPDATED. THE UPDATE CAME FROM NO DEPARTMENT. WE HAVE DECIDED NOT TO INVESTIGATE WHICH ONE, BECAUSE FOR ONCE THE PAPERWORK IS KIND.]" }], idx: 0, t: 0 };
        this.mode = "talk";
      }
      if (b.enemy.boss && this.regionId !== "ashenveil") {
        this.flags.bossDown[eid] = true;
        this.flags.sparedStory[eid] = true;
        this.flags.regionDone[this.regionId] = true;
        this.collider = buildCollider(this.world, this.flags);
        this.battle = null;
        this.pages = { lines: bossAfter(eid, this.flags, true), idx: 0, t: 0, after: () => this.afterBossResolve(eid, true) };
        this.mode = "talk";
        return;
      }
      if (eid === "kesh") { this.flags.sparedKesh = true; this.flags.bossDone = true; }
      if (eid === "architect") { this.flags.architectSpared = true; this.flags.bossDone = true; this.flags.tpDone = true; }
    }''')
rep('''    // Boss resolved → route ending pages
    if ((eid === "kesh" || eid === "architect") && this.flags.bossDone) {
      const route = this.flags.architectSpared ? "pacifist" : routeOf(this.flags);
      this.mode = "ending";
      this.pages = { lines: ENDINGS[route], idx: 0, t: 0 };
      this.endAfter = () => this.saveGame();
      return;
    }
    this.mode = "world";
    this.encCooldown = 1.8;
    Sfx.playMusic("town");
  }''','''    // Boss resolved → route ending pages (with the campaign epilogue appended)
    if ((eid === "kesh" || eid === "architect") && this.flags.bossDone) {
      const route = this.flags.architectSpared ? "pacifist" : routeOf(this.flags);
      this.mode = "ending";
      this.pages = { lines: [...ENDINGS[route], ...epilogue(this.flags)], idx: 0, t: 0 };
      this.endAfter = () => this.saveGame();
      return;
    }
    this.mode = "world";
    this.encCooldown = 1.8;
    Sfx.playMusic(this.world.region.music);
  }

  /** After a regional boss resolves (win OR spare): the Warden's floor ends
   *  with the ceremony — the only dialogue choice in the campaign. */
  private afterBossResolve(eid: string, spared: boolean) {
    this.mode = "world";
    this.saveGame();
    if (eid === "warden" && !this.flags.unregistered) {
      this.choice = {
        lines: ceremonyLines(this.flags),
        idx: 0,
        sel: 1,
        opts: [
          { label: "ACCEPT THE CLASS", run: () => this.answerCeremony(true) },
          { label: "REFUSE IT", run: () => this.answerCeremony(false) },
        ],
      };
      this.mode = "choice";
      Sfx.open();
      return;
    }
    void spared;
  }
  private answerCeremony(yes: boolean) {
    const f = this.flags;
    f.ceremonyAnswer = yes ? "yes" : "no";
    f.unregistered = true; // the answer itself — any answer — opens the door
    this.collider = buildCollider(this.world, f);
    this.pages = { lines: ceremonyAnswer(yes, f), idx: 0, t: 0 };
    this.mode = "talk";
    Sfx.levelup();
  }''')

# ---- death/respawn ----
rep('''  private respawn() {
    const save = readSave<WorldSaveData>(SAVE_KEY);
    if (save) {
      this.px = save.x; this.py = save.y;
      this.flags = { ...freshFlags(), ...save.flags };
      this.flags.deaths = this.flags.deaths + 1; // the death you just had isn't in the save yet
    } else {
      this.px = this.world.spawn.x; this.py = this.world.spawn.y;
    }
    this.collider = buildCollider(this.world, this.flags);
    this.battle = null; this.pages = null;
    this.mode = "world";
    this.encCooldown = 1.5;
    Sfx.playMusic("town");
  }''','''  private respawn() {
    // the campaign softens death: you lose the floor's moment, not the floor's
    // progress. The debt ledger, the mercy ledger, and the map all stay.
    this.px = this.world.spawn.x; this.py = this.world.spawn.y;
    this.collider = buildCollider(this.world, this.flags);
    this.battle = null; this.pages = null;
    this.mode = "world";
    this.encCooldown = 1.5;
    Sfx.playMusic(this.world.region.music);
    this.pages = { lines: [{ text: "You wake at the way in. The floor carries people back the way a river carries leaves — without ceremony, and without ever quite meaning to." }], idx: 0, t: 0 };
    this.mode = "talk";
  }''')
rep('''  private saveGame() {
    writeSave<WorldSaveData>(SAVE_KEY, { x: this.px, y: this.py, flags: this.flags });''','''  private saveGame() {
    writeSave<WorldSaveData>(SAVE_KEY, { region: this.regionId, x: this.px, y: this.py, flags: this.flags });''')

# ---- render dispatch + choice render ----
rep('''      case "battle": this.renderBattle(g); break;
    }''','''      case "battle": this.renderBattle(g); break;
      case "choice": this.renderWorld(g); this.renderChoice(g); break;
    }
    if (this.mode === "world" || this.mode === "talk") this.renderTracker(g);''')

# ---- renderWorld: zoom transform + region-driven decor ----
rep('''  private renderWorld(g: CanvasRenderingContext2D) {
    const ox = Math.round(-this.cam.x), oy = Math.round(-this.cam.y);
    if (this.bgReady && this.bg) {
      if (this.flags.genDone) g.filter = "grayscale(0.92) brightness(0.72)";
      g.drawImage(this.bg, ox, oy, MAP_PX, MAP_PX);
      g.filter = "none";
    }''','''  private renderWorld(g: CanvasRenderingContext2D) {
    const z = this.zoom;
    g.save();
    g.setTransform(z, 0, 0, z, 0, 0);
    const ox = Math.round(-this.cam.x), oy = Math.round(-this.cam.y);
    if (this.bgReady && this.bg) {
      if (this.flags.genDone && this.regionId === "ashenveil") g.filter = "grayscale(0.92) brightness(0.72)";
      g.drawImage(this.bg, ox, oy, MAP_PX, MAP_PX);
      g.filter = "none";
    } else {
      g.fillStyle = "#0a0e18"; g.fillRect(ox, oy, MAP_PX, MAP_PX);
    }
    // region decor, drawn from data (world.ts) — floors are authored, not coded
    for (const d of this.world.decor) {
      if (d.kind === "ice" && d.rect) {
        const [x, y, w, h] = d.rect;
        for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) g.drawImage(A.getProp("ice"), ox + (x + tx) * TILE, oy + (y + ty) * TILE);
      }
      if (d.kind === "slab" && d.rect) {
        const [x, y, w, h] = d.rect;
        for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) g.drawImage(A.getProp("slab"), ox + (x + tx) * TILE, oy + (y + ty) * TILE);
        g.strokeStyle = "rgba(10,14,22,0.5)"; g.lineWidth = 1;
        g.strokeRect(ox + x * TILE + 0.5, oy + y * TILE + 0.5, w * TILE - 1, h * TILE - 1);
      }
      if (d.kind === "bridge" && d.rect) {
        const [x, y, w, h] = d.rect;
        for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) g.drawImage(A.getProp("bridge"), ox + (x + tx) * TILE, oy + (y + ty) * TILE);
      }
      if (d.kind === "bridgeRow" && d.tiles) {
        for (const [tx2, ty2] of d.tiles) g.drawImage(A.getProp("bridgeRail"), ox + tx2 * TILE, oy + ty2 * TILE);
      }
      if (d.kind === "walls" && d.tiles) {
        const gateBlocked = this.regionId === "ashenveil" ? !this.flags.gateOpen : true;
        if (gateBlocked) for (const [tx2, ty2] of d.tiles) {
          g.fillStyle = "#dfe8f4"; g.fillRect(ox + tx2 * TILE, oy + ty2 * TILE - 6, TILE, TILE + 6);
          g.fillStyle = "#b9c9de"; g.fillRect(ox + tx2 * TILE, oy + ty2 * TILE - 6, TILE, 4);
          g.fillStyle = "#7d8fa8"; g.fillRect(ox + tx2 * TILE, oy + (ty2 + 1) * TILE - 2, TILE, 2);
          g.fillStyle = "#5b6a80"; g.fillRect(ox + tx2 * TILE, oy + ty2 * TILE - 6, 1, TILE + 6); g.fillRect(ox + (tx2 + 1) * TILE - 1, oy + ty2 * TILE - 6, 1, TILE + 6);
        }
      }
      if (d.kind === "glow" && d.x !== undefined && d.y !== undefined) {
        const t = performance.now() / 900;
        const pulse = 0.45 + Math.sin(t + (d.x % 7)) * 0.22;
        g.globalAlpha = pulse; g.fillStyle = d.c ?? "#3fd2ff";
        g.beginPath(); g.ellipse(ox + d.x, oy + d.y, d.r ?? 24, (d.r ?? 24) * 0.42, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
    }''')
# replace the hardcoded ash bridge/river/walls/obelisk block with nothing (decor covers it)
rep('''    // the bridge deck across the gap
    for (let ty = 17; ty <= 19; ty++) for (let tx = 30; tx <= 33; tx++) g.drawImage(A.getProp("bridge"), ox + tx * TILE, oy + ty * TILE);
    // frozen-river shoreline so the ice reads as carved into the snow
    g.strokeStyle = "rgba(24,34,58,0.55)"; g.lineWidth = 2;
    g.strokeRect(ox + 22 * TILE, oy + 17 * TILE - 1, 21 * TILE, 3 * TILE + 2);
    // snow walls flanking the ridge gate while it is shut (no walking around it)
    if (!this.flags.gateOpen) {
      for (const tx of [28, 29, 35, 36]) {
        g.fillStyle = "#dfe8f4"; g.fillRect(ox + tx * TILE, oy + 13 * TILE - 6, TILE, TILE + 6);
        g.fillStyle = "#b9c9de"; g.fillRect(ox + tx * TILE, oy + 13 * TILE - 6, TILE, 4);
        g.fillStyle = "#7d8fa8"; g.fillRect(ox + tx * TILE, oy + 14 * TILE - 2, TILE, 2);
        g.fillStyle = "#5b6a80"; g.fillRect(ox + tx * TILE, oy + 13 * TILE - 6, 1, TILE + 6); g.fillRect(ox + (tx + 1) * TILE - 1, oy + 13 * TILE - 6, 1, TILE + 6);
      }
    }
    // the save obelisk pulses a glow so a dark square is never a mystery
    {
      const t = performance.now() / 900;
      const pulse = 0.5 + Math.sin(t) * 0.22;
      const gx = ox + 31 * TILE - 4 + 6, gy = oy + 28 * TILE - 4 + 24;
      g.globalAlpha = pulse; g.fillStyle = "#3fd2ff";
      g.beginPath(); g.ellipse(gx, gy + 12, 26, 10, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // ash where NPCs used to stand''','''    // ash where NPCs used to stand''')
rep('''        if (this.flags.genDone && (key === "inn" || key === "house" || key === "stall" || key === "stall2")) g.globalAlpha = 0.8;
        g.drawImage(A.getProp(key), ox + p.x, oy + p.y, p.w, p.h);
        g.globalAlpha = 1;''','''        if (this.flags.genDone && (key === "inn" || key === "house" || key === "stall" || key === "stall2")) g.globalAlpha = 0.8;
        try { g.drawImage(A.getProp(key), ox + p.x, oy + p.y, p.w, p.h); } catch { /* unknown key */ }
        g.globalAlpha = 1;''')
rep('''      if (p.sprite === "water") {
        const cols = Math.ceil(p.w / TILE), rows = Math.ceil(p.h / TILE);
        for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
          g.drawImage(A.getProp("ice"), ox + p.x + tx * TILE, oy + p.y + ty * TILE);
        }
        continue;
      }
      if (p.sprite === "bridgeRail") {
        const cols = Math.ceil(p.w / TILE);
        for (let tx = 0; tx < cols; tx++) g.drawImage(A.getProp("bridgeRail"), ox + p.x + tx * TILE, oy + p.y);
        continue;
      }''','''      if (p.sprite === "water") {
        const cols = Math.ceil(p.w / TILE), rows = Math.ceil(p.h / TILE);
        const tileKey = this.regionId === "ashenveil" ? "ice" : "pool";
        for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
          g.drawImage(A.getProp(tileKey), ox + p.x + tx * TILE, oy + p.y + ty * TILE);
        }
        continue;
      }
      if (p.sprite === "bridgeRail") {
        const cols = Math.ceil(p.w / TILE);
        for (let tx = 0; tx < cols; tx++) g.drawImage(A.getProp("bridgeRail"), ox + p.x + tx * TILE, oy + p.y);
        continue;
      }
      if (p.sprite === "lava") {
        const cols = Math.ceil(p.w / TILE), rows = Math.ceil(p.h / TILE);
        for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) g.drawImage(A.getProp("lava"), ox + p.x + tx * TILE, oy + p.y + ty * TILE);
        continue;
      }''')
rep('''    for (const s of this.world.signs) g.drawImage(A.getProp("sign"), ox + s.x * TILE - 6, oy + s.y * TILE - 10);
    // cold night tint
    g.fillStyle = "rgba(8,12,24,0.16)"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    this.renderMinimap(g);
  }''','''    for (const s of this.world.signs) g.drawImage(A.getProp("sign"), ox + s.x * TILE - 6, oy + s.y * TILE - 10);
    // region exit arch: bricked while the floor's boss stands, open after
    if (this.world.exit) {
      const ex = this.world.exit;
      const locked = this.world.boss && !this.flags.bossDown[this.world.boss.id]
        || (this.regionId === "citadel" && !this.flags.unregistered);
      if (!locked) {
        const t = performance.now() / 800;
        g.globalAlpha = 0.4 + Math.sin(t) * 0.2; g.fillStyle = "#8fffd8";
        g.beginPath(); g.ellipse(ox + ex.x * TILE + 8, oy + ex.y * TILE + 8, 15, 9, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      try { g.drawImage(A.getProp("arch"), ox + ex.x * TILE - 8, oy + ex.y * TILE - 14, 32, 28); } catch { /* missing */ }
      if (locked) { g.fillStyle = "rgba(40,46,60,0.92)"; g.fillRect(ox + ex.x * TILE - 4, oy + ex.y * TILE - 8, 24, 20); g.fillStyle = "#5b6a80"; g.fillRect(ox + ex.x * TILE - 4, oy + ex.y * TILE - 8, 24, 3); }
    }
    // the region's boss: a red pulse at its post until it is resolved
    if (this.world.boss && !this.flags.bossDown[this.world.boss.id]) {
      const bo = this.world.boss;
      const t = performance.now() / 620;
      g.globalAlpha = 0.30 + Math.sin(t) * 0.16; g.fillStyle = "#ff5566";
      g.beginPath(); g.ellipse(ox + bo.x * TILE + 8, oy + (bo.y + 1) * TILE + 2, 13, 7, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      if (Math.floor(t * 2) % 2 === 0) drawText(g, bo.name, ox + bo.x * TILE + 8, oy + (bo.y - 1) * TILE, 9, "#ff9aa6", "center");
    }
    // per-region tint: caves are dark, the citadel is cold gold
    const VW = VIEW_W / this.zoom, VH = VIEW_H / this.zoom;
    if (this.world.region.mode === "cave") {
      const gr = g.createRadialGradient(this.px, this.py, 60, this.px, this.py, 190);
      gr.addColorStop(0, "rgba(4,3,8,0)"); gr.addColorStop(1, "rgba(4,3,8,0.82)");
      g.fillStyle = gr; g.fillRect(this.cam.x, this.cam.y, VW, VH);
    } else if (this.world.region.mode === "hall") {
      g.fillStyle = "rgba(30,24,8,0.16)"; g.fillRect(this.cam.x, this.cam.y, VW, VH);
    } else {
      g.fillStyle = this.regionId === "ashenveil" ? "rgba(8,12,24,0.16)" : "rgba(10,14,26,0.10)";
      g.fillRect(this.cam.x, this.cam.y, VW, VH);
    }
    g.restore();
    this.renderMinimap(g);
    // zoom/fullscreen hint, tiny, under the minimap
    drawText(g, `ZOOM ${this.zoom}× [-/+] · F fullscreen`, VIEW_W - 10, 78, 9, "#41546f", "right");
  }''')

# ---- camera clamp with zoom (update) ----
rep('''    this.cam.x = clamp(lerp(this.cam.x, this.px - VIEW_W / 2, dt * 6), 0, Math.max(0, MAP_PX - VIEW_W));
    this.cam.y = clamp(lerp(this.cam.y, this.py - VIEW_H / 2, dt * 6), 0, Math.max(0, MAP_PX - VIEW_H));''','''    const VW = VIEW_W / this.zoom, VH = VIEW_H / this.zoom;
    this.cam.x = clamp(lerp(this.cam.x, this.px - VW / 2, dt * 6), 0, Math.max(0, MAP_PX - VW));
    this.cam.y = clamp(lerp(this.cam.y, this.py - VH / 2, dt * 6), 0, Math.max(0, MAP_PX - VH));''')

# ---- minimap: per-region zone boxes + boss dot ----
rep('''  private renderMinimap(g: CanvasRenderingContext2D) {
    const S = 60;
    const x = VIEW_W - S - 10, y = 10;
    g.fillStyle = "rgba(5,8,16,0.75)"; g.fillRect(x, y, S, S);
    g.strokeStyle = "#2c4a66"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, S, S);
    g.fillStyle = "#233047";
    g.fillRect(x + (8 / 64) * S, y + (46 / 64) * S, (47 / 64) * S, (16 / 64) * S);
    g.fillRect(x + (20 / 64) * S, y + (3 / 64) * S, (26 / 64) * S, (9 / 64) * S);
    g.fillStyle = "#ffd88a"; g.fillRect(x + (58 / 64) * S - 1, y + (26 / 64) * S - 1, 3, 3);
    g.fillStyle = "#7fe7ff"; g.fillRect(x + (this.px / MAP_PX) * S - 1, y + (this.py / MAP_PX) * S - 1, 2, 2);
  }''','''  private renderMinimap(g: CanvasRenderingContext2D) {
    const S = 60;
    const x = VIEW_W - S - 10, y = 10;
    g.fillStyle = "rgba(5,8,16,0.75)"; g.fillRect(x, y, S, S);
    g.strokeStyle = "#2c4a66"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, S, S);
    g.fillStyle = "#233047";
    for (const zn of this.world.zones) {
      const [zx, zy, zw, zh] = zn.rect;
      g.fillRect(x + (zx / 64) * S, y + (zy / 64) * S, (zw / 64) * S, (zh / 64) * S);
    }
    if (this.world.boss) {
      g.fillStyle = "#ff5566"; g.fillRect(x + (this.world.boss.x / 64) * S - 1, y + (this.world.boss.y / 64) * S - 1, 3, 3);
    }
    if (this.world.exit) {
      g.fillStyle = "#ffd88a"; g.fillRect(x + (this.world.exit.x / 64) * S - 1, y + (this.world.exit.y / 64) * S - 1, 3, 3);
    }
    g.fillStyle = "#7fe7ff"; g.fillRect(x + (this.px / MAP_PX) * S - 1, y + (this.py / MAP_PX) * S - 1, 2, 2);
    drawText(g, this.world.region.name, VIEW_W - 10, y + S + 12, 10, "#7fa0c8", "right");
  }
  private renderTracker(g: CanvasRenderingContext2D) {
    const obj = nextObjective(this.flags, this.regionId);
    if (!obj || this.flags.trackerSeen[obj.key]) return;
    const w = Math.min(VIEW_W - 150, 10 + obj.text.length * 6.4 + 40);
    g.fillStyle = "rgba(6,10,18,0.82)"; g.fillRect(8, 8, w, 26);
    g.strokeStyle = "#3f6a8f"; g.lineWidth = 1; g.strokeRect(8.5, 8.5, w - 1, 25);
    drawText(g, `◈ ${obj.text}`, 14, 15, 11, "#9fd8ff");
    drawText(g, "[T] hide", 8 + w - 4, 15, 9, "#41546f", "right");
  }
  private renderChoice(g: CanvasRenderingContext2D) {
    const c = this.choice;
    if (!c) return;
    this.box(g, 120, 350, VIEW_W - 240, 96);
    drawText(g, "THE SYSTEM WAITS FOR YOUR ANSWER", VIEW_W / 2, 364, 12, "#ffd88a", "center");
    c.opts.forEach((o, i) => {
      const sel = i === c.sel;
      drawText(g, `${sel ? "♥" : " "} ${o.label}`, 150, 396 + i * 22, 15, sel ? "#ffffff" : "#6d80a8");
    });
    drawText(g, "↑/↓ choose · Z answer", VIEW_W - 140, 434, 10, "#59708f", "right");
  }''')

# ---- prompt labels for new interactables ----
rep('''    let label = "TALK";
    if (hit.kind === "sign") label = "READ";
    if (hit.key === "save") label = "SAVE";
    if (hit.key === "bossGate") label = "ENTER";''','''    let label = "TALK";
    if (hit.kind === "sign") label = "READ";
    if (hit.key === "save") label = "SAVE";
    if (hit.key === "bossGate") label = "ENTER";
    if (hit.key === "shop.sila") label = "TRADE";
    if (hit.key === "boss") label = "CHALLENGE";
    if (hit.key === "exit") label = this.world.boss && !this.flags.bossDown[this.world.boss.id] ? "BRICKED UP" : `TRAVEL: ${this.world.exit?.label ?? ""}`;
    if (hit.key === "goBack") label = "RETURN TO THE CITADEL";''')

# ---- shop title + status rows + battle music naming ----
rep('''    drawText(g, "MISOL'S EVERYTHING", 140, 212, 16, "#ffd88a");''','''    drawText(g, this.shopName, 140, 212, 16, "#ffd88a");''')
rep('''    const s = useGame.getState();
    const combat = deriveBattleStats({ str: s.str, agi: s.agi, vit: s.vit, fatigueLevel: s.fatigueLevel });
    this.box(g, 110, 54, 420, 376);
    drawText(g, "STATUS — REAL-WORLD LINK", 130, 70, 16, "#ffd88a");''','''    const s = useGame.getState();
    const combat = campaignStats(s.level, s.str, s.agi, s.vit, s.fatigueLevel);
    this.box(g, 110, 54, 420, 376);
    drawText(g, "STATUS — REAL-WORLD LINK", 130, 70, 16, "#ffd88a");''')
rep('''      ["kills — pines / ridge", `${this.flags.killsPines} / ${this.flags.killsRidge}`],''','''      ["floor", `${this.world.region.name} — band LV ${this.world.region.from}–${this.world.region.to}`],
      ["kills — pines / ridge / total", `${this.flags.killsPines} / ${this.flags.killsRidge} / ${this.flags.killsTotal}`],
      ["floor bosses resolved", Object.keys(this.flags.bossDown).filter((k) => this.flags.bossDown[k]).length + " / 5"],''')

# ---- battle HUD: resonance chip + aura ----
rep('''    // enemy state tag
    if (b.enemy.spareable) drawText(g, `${b.enemy.name} is willING to be spared`, VIEW_W / 2, 232, 11, "#9fe8ff", "center");''','''    // enemy state tag
    if (b.enemy.spareable) drawText(g, `${b.enemy.name} is willING to be spared`, VIEW_W / 2, 232, 11, "#9fe8ff", "center");
    // RESONANCE: the overlevel rescue — the floor refuses to let a debt stand unpaid
    if (b.resonance) {
      const t = performance.now() / 380;
      const a = 0.35 + Math.sin(t) * 0.18;
      g.globalAlpha = a;
      g.strokeStyle = "#3fd2ff"; g.lineWidth = 2; g.strokeRect(b.soul.x - 9, b.soul.y - 9, 18, 18);
      g.globalAlpha = 1;
      drawText(g, "◈ RESONANCE — the floor holds you up (+5.5 HP/s)", VIEW_W / 2, 396, 10, "#7fe7ff", "center");
    }''')

# ---- toggleMute music follows region ----
rep('''    if (!isMuted()) Sfx.playMusic(this.mode === "battle" ? (this.battle && (this.battle.enemy.id === "kesh" || this.battle.enemy.id === "architect")) ? "boss" : "battle" : "town");''','''    if (!isMuted()) Sfx.playMusic(this.mode === "battle" ? (this.battle && this.battle.enemy.boss ? "boss" : "battle") : this.world.region.music);''')

# ---- boot screen copy: expedition framing ----
rep('''    drawText(g, "A S H E N V E I L", VIEW_W / 2, 108, 42, "#e8f0ff", "center");
    drawText(g, "an unregistered dungeon with a small town in it", VIEW_W / 2, 158, 13, "#9fb4d8", "center");
    drawText(g, "— a training quest for people who train at 5 AM —", VIEW_W / 2, 176, 13, "#6d80a8", "center");''','''    drawText(g, "A S H E N V E I L", VIEW_W / 2, 96, 40, "#e8f0ff", "center");
    drawText(g, "an expedition: five floors, one swallowed city block, forty-one debts", VIEW_W / 2, 146, 13, "#9fb4d8", "center");
    drawText(g, "— a training quest for people who train at 5 AM —", VIEW_W / 2, 164, 13, "#6d80a8", "center");''')
rep('''    drawText(g, "ARROWS/WASD move · Z confirm · X cancel & status · hold SHIFT: dash (LV 5+)", VIEW_W / 2, 402, 10, "#59708f", "center");
    drawText(g, "levels are earned in the real world; the dungeon pays in skill points", VIEW_W / 2, 418, 10, "#59708f", "center");''','''    drawText(g, "ARROWS/WASD move · Z confirm · X status · SHIFT dash (LV 5+) · T hide tracker hint", VIEW_W / 2, 396, 10, "#59708f", "center");
    drawText(g, "F fullscreen · - / + zoom · levels earned IRL by dailies; the dungeon pays skill points", VIEW_W / 2, 412, 10, "#59708f", "center");''')

open(p, 'w').write(s)
print("view patched,", len(s), "bytes")
