// Ashenveil — the game view: camera-follow overworld with depth sorting,
// Undertale-style battle presentation, dialogue, shop, save, endings.
// 640×480 internal canvas; CSS scales it up nearest-neighbor. No React inside.
import {
  TILE, VIEW_W, VIEW_H, Input, clamp, lerp, readSave, writeSave,
  Sfx, isMuted, setMuted, drawText, outlineSprite,
} from "./core";
import {
  buildWorld, buildCollider, solidAtGrid, MAP_PX, zoneAt, routeOf, totalKills,
  freshFlags, type WorldDef, type WorldFlags, type WorldSaveData,
} from "./world";
import {
  createBattle, stepBattle, confirmAtMenu, navMenu, advanceDialogue, lockBar,
  menuItems, type BattleState,
} from "./battle";
import {
  NPC, sign as signLines, intro as introLines, ENDINGS, SHOP_INTRO, SHOP_ITEMS,
  shopThanks, shopNoGold, gateHint, bossGateHint, WELCOME_BACK, levelUpToast, type Line,
} from "./script";
import * as A from "./art";
import { useGame } from "../store/game";
import { deriveBattleStats } from "../lib/battle";

const SAVE_KEY = "sl_ashenveil_v1";
const TYPE_RATE = 36; // chars per second

type Mode = "boot" | "intro" | "world" | "talk" | "shop" | "status" | "battle" | "over" | "ending";

interface Pages { lines: Line[]; idx: number; t: number; after?: () => void }

export class AshenGame {
  private g: CanvasRenderingContext2D;
  input = new Input();
  private raf = 0;
  private last = 0;
  private started = false;

  private world: WorldDef;
  private collider: Uint8Array;
  private flags: WorldFlags;
  private px = 0; private py = 0;
  private dir: "down" | "up" | "left" | "right" = "down";
  private walkT = 0; private moving = false;
  private cam = { x: 0, y: 0 };

  private mode: Mode = "boot";
  private pages: Pages | null = null;
  private pageAfter: (() => void) | null = null;
  private battle: BattleState | null = null;
  private bg: HTMLImageElement | null = null;
  private battleSprites: Record<string, HTMLCanvasElement> = {};
  private bgReady = false;
  private sprites: Record<string, HTMLCanvasElement[]> = {};
  private steps = 0;
  private encCooldown = 0;
  private toast: { text: string; t: number } | null = null;
  private lastLevel = 0;
  private transT = 0; private transDir: 0 | 1 | -1 = 0;
  private endAfter: (() => void) | null = null;
  private shopSel = 0;

  constructor(canvas: HTMLCanvasElement) {
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
  }

  start() {
    if (this.started) return;
    this.started = true;
    const loop = (t: number) => {
      const dt = clamp((t - this.last) / 1000, 0.001, 0.05);
      this.last = t;
      try { this.update(dt); this.render(); } finally { this.input.endFrame(); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame((t) => { this.last = t; loop(t); });
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    Sfx.stopMusic();
    this.started = false;
  }
  /** for touch buttons in the React shell */
  virtual(k: Parameters<Input["press"]>[0], down: boolean) { this.input.press(k, down); }
  toggleMute() {
    setMuted(!isMuted());
    if (!isMuted()) Sfx.playMusic(this.mode === "battle" ? (this.battle && (this.battle.enemy.id === "kesh" || this.battle.enemy.id === "architect")) ? "boss" : "battle" : "town");
  }

  // ---------------- sprites ----------------
  private buildSprites() {
    const S = this.sprites;
    S.pDown = [outlineSprite(A.hunterDown(0)), outlineSprite(A.hunterDown(1)), outlineSprite(A.hunterDown2())];
    S.pUp = [outlineSprite(A.hunterUp(0)), outlineSprite(A.hunterUp(1)), outlineSprite(A.hunterUp(0))];
    S.pLeft = [outlineSprite(A.hunterSide(0)), outlineSprite(A.hunterSide(1)), outlineSprite(A.hunterSide(0))];
    S.pRight = [outlineSprite(A.hunterSide(0, true)), outlineSprite(A.hunterSide(1, true)), outlineSprite(A.hunterSide(0, true))];
    const mk = (p: Partial<A.NpcStyle> & { hair: string; coat: string; coatDk: string; coatLt: string }): HTMLCanvasElement => {
      const style: A.NpcStyle = { hairLt: "#4a3d33", accent: undefined, small: false, hat: "none", beard: false, ...p };
      return outlineSprite(A.npcSprite(style));
    };
    S.n_shopgirl = [mk({ hair: "#1d1a20", hairLt: "#3b3441", coat: "#8a5a5a", coatDk: "#66403f", coatLt: "#b87a72", hat: "beanie" })];
    S.n_innkeep = [mk({ hair: "#8f8f8f", hairLt: "#b5b5b5", beard: true, coat: "#cfd6e0", coatDk: "#9aa5b5", coatLt: "#eef2f8" })];
    S.n_kid = [mk({ small: true, hair: "#4a3020", hairLt: "#6b4a2b", coat: "#c97f3a", coatDk: "#9c5f28", coatLt: "#e8a45c" })];
    S.n_prof = [mk({ hair: "#cfcfcf", hairLt: "#eeeeee", beard: true, coat: "#51406b", coatDk: "#3a2e4e", coatLt: "#6f5a92" })];
    S.n_skater = [mk({ hair: "#16161c", hairLt: "#2c2c38", coat: "#3fa0a0", coatDk: "#2b7677", coatLt: "#63c4c2", hat: "helmet" })];
    S.n_hermit = [mk({ hair: "#0e0e14", hairLt: "#1e1e2a", coat: "#23222e", coatDk: "#171620", coatLt: "#3a3850" })];
  }

  // ---------------- update ----------------
  private update(dt: number) {
    const st = useGame.getState();
    if (st.level !== this.lastLevel) {
      this.lastLevel = st.level;
      this.toast = { text: levelUpToast(st.level).text, t: 5 };
      Sfx.levelup();
    }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.transDir !== 0) {
      this.transT = clamp(this.transT + this.transDir * dt * 2.4, 0, 1);
      if (this.transT >= 1 && this.transDir === 1) this.transDir = -1;
      else if (this.transT >= 1) this.transDir = -1;
      if (this.transT <= 0 && this.transDir === -1) { this.transDir = 0; if (this.pendingMode) { const f = this.pendingMode; this.pendingMode = null; f(); } }
      return;
    }
    switch (this.mode) {
      case "boot":
        if (this.input.pressed("confirm")) {
          Sfx.select();
          this.pages = { lines: introLines(useGame.getState().name || "HUNTER"), idx: 0, t: 0 };
          this.mode = "intro";
        }
        break;
      case "intro": this.updatePages(dt, () => { this.mode = "world"; Sfx.playMusic("town"); }); break;
      case "talk": this.updatePages(dt, () => { this.mode = "world"; this.runPageAfter(); }); break;
      case "over": this.updatePages(dt, () => this.respawn()); break;
      case "ending": this.updatePages(dt, () => { this.mode = "world"; Sfx.playMusic("town"); this.runEndAfter(); }); break;
      case "status":
        if (this.input.pressed("cancel") || this.input.pressed("menu")) { this.mode = "world"; Sfx.cancel(); }
        break;
      case "shop": this.updateShop(dt); break;
      case "world": this.updateWorld(dt); break;
      case "battle": this.updateBattle(dt); break;
    }
  }
  private pendingMode: (() => void) | null = null;
  private runPageAfter() { const f = this.pageAfter; this.pageAfter = null; f?.(); }
  private runEndAfter() { const f = this.endAfter; this.endAfter = null; f?.(); }

  private updatePages(dt: number, onDone: () => void) {
    const p = this.pages;
    if (!p) { onDone(); return; }
    const cur = p.lines[p.idx];
    const len = (cur?.text ?? "").length;
    const wasChars = Math.floor(p.t * TYPE_RATE);
    if (p.t * TYPE_RATE < len) {
      p.t += dt;
      const nowChars = Math.floor(p.t * TYPE_RATE);
      if (nowChars > wasChars && nowChars % 4 === 0) Sfx.text();
    } else p.t += dt;
    if (this.input.pressed("confirm")) {
      if (p.t * TYPE_RATE < len) { p.t = len / TYPE_RATE + 0.001; } // reveal the page at once
      else {
        p.idx++; p.t = 0;
        if (p.idx >= p.lines.length) { this.pages = null; Sfx.select(); onDone(); }
      }
    }
  }

  private updateWorld(dt: number) {
    const inp = this.input;
    const lvl = useGame.getState().level;
    const dash = lvl >= 5 && inp.down("menu");
    let vx = (inp.down("right") ? 1 : 0) - (inp.down("left") ? 1 : 0);
    let vy = (inp.down("down") ? 1 : 0) - (inp.down("up") ? 1 : 0);
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
    this.moving = !!(vx || vy);
    if (this.moving) {
      if (vy > 0.01) this.dir = "down"; else if (vy < -0.01) this.dir = "up";
      else if (vx > 0.01) this.dir = "right"; else if (vx < -0.01) this.dir = "left";
      const prevStep = this.walkT;
      const sp = dash ? 100 : 56;
      this.tryMove(this.px + vx * sp * dt, this.py + vy * sp * dt);
      this.walkT += dt * (dash ? 11 : 7.2);
      this.steps += sp * dt * (dash ? 0.35 : 1); // dashing hides you from the grass
      if (Math.floor(prevStep) !== Math.floor(this.walkT)) Sfx.move();
      this.encounterTick();
    } else this.walkT = 0;
    this.encCooldown = Math.max(0, this.encCooldown - dt);

    this.cam.x = clamp(lerp(this.cam.x, this.px - VIEW_W / 2, dt * 6), 0, Math.max(0, MAP_PX - VIEW_W));
    this.cam.y = clamp(lerp(this.cam.y, this.py - VIEW_H / 2, dt * 6), 0, Math.max(0, MAP_PX - VIEW_H));

    if (this.input.pressed("cancel")) { this.mode = "status"; Sfx.open(); return; }
    if (this.input.pressed("confirm")) this.interact();
  }

  private encounterTick() {
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
  }

  private tryMove(nx: number, ny: number) {
    const R = 5;
    const free = (x: number, y: number) => {
      const offs = [[-R, 2], [R, 2], [-R, -4], [R, -4], [0, 2]] as const;
      for (const [ox, oy] of offs) {
        if (solidAtGrid(this.collider, Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false;
      }
      return true;
    };
    if (free(nx, this.py)) this.px = nx;
    if (free(this.px, ny)) this.py = ny;
    this.px = clamp(this.px, TILE, MAP_PX - TILE);
    this.py = clamp(this.py, TILE, MAP_PX - TILE);
  }

  private nearestInteract(): { kind: "npc" | "sign" | "prop"; key: string } | null {
    const fx = this.px + (this.dir === "left" ? -13 : this.dir === "right" ? 13 : 0);
    const fy = this.py + (this.dir === "up" ? -10 : this.dir === "down" ? 11 : 0);
    let best: { d: number; r: { kind: "npc" | "sign" | "prop"; key: string } } | null = null;
    const consider = (x: number, y: number, kind: "npc" | "sign" | "prop", key: string) => {
      const d = Math.hypot(fx - x, fy - y);
      if (d < 17 && (!best || d < best.d)) best = { d, r: { kind, key } };
    };
    for (const n of this.world.npcs) {
      if (n.hideAfter && this.flags[n.hideAfter as keyof WorldFlags]) continue;
      consider(n.x * TILE + 8, n.y * TILE, "npc", n.dialogue);
    }
    for (const s of this.world.signs) consider(s.x * TILE + 4, s.y * TILE + 4, "sign", s.text);
    for (const p of this.world.props) {
      if (p.gate) consider(p.x + p.w / 2, p.y + p.h - 6, "prop", "gate");
      if (p.interact) consider(p.x + p.w / 2, p.y + p.h - 6, "prop", p.interact.id);
    }
    return best ? (best as unknown as { r: { kind: "npc" | "sign" | "prop"; key: string } }).r : null;
  }

  private interact() {
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
  }
  private afterTalk(key: string) {
    const f = this.flags;
    f.met[key] = (f.met[key] ?? 0) + 1;
    if (key === "dog.rock") f.dogFound = true;
    if (key === "kid.lost" && f.dogFound) f.dogReturned = true;
    if (key === "inn.baek" && f.dogReturned && !f.hasKey) f.hasKey = true;
  }
  private tryGate() {
    if (this.flags.gateOpen) {
      this.pages = { lines: [{ text: "The gate stands open. Beyond it: the ridge, the dead trees, and the smell of old snow that never got swept." }], idx: 0, t: 0 };
    } else if (this.flags.hasKey) {
      this.flags.gateOpen = true;
      this.collider = buildCollider(this.world, this.flags);
      Sfx.gate();
      this.pages = { lines: [{ text: "The Ridge Key turns like it was oiled yesterday. The portcullis climbs — and the ridge beyond does NOT approve." }], idx: 0, t: 0 };
    } else {
      this.pages = { lines: gateHint(), idx: 0, t: 0 };
    }
    this.mode = "talk"; Sfx.open();
  }
  private startBoss() {
    if (this.flags.tpDone || this.flags.genDone) {
      this.pages = { lines: [{ text: "The arch is quiet now. Whatever lived behind the door has filed you under: solved case." }], idx: 0, t: 0 };
      this.mode = "talk"; return;
    }
    if (this.flags.bossDone) {
      this.pages = { lines: [{ text: "The Gate breathes slow, waiting. The road past it belongs to the System now — or to whoever it forgives." }], idx: 0, t: 0 };
      this.mode = "talk"; return;
    }
    const gen = this.flags.killsPines >= 7 && this.flags.killsRidge >= 7;
    Sfx.bossIntro();
    this.pages = {
      lines: bossGateHint(this.flags), idx: 0, t: 0,
      after: () => this.beginBattle(gen ? "sentry" : "kesh", gen ? 30 : 12),
    };
    this.mode = "talk";
  }

  private beginBattle(id: string, zoneLevel: number) {
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
  }

  // ---------------- battle ----------------
  private updateBattle(dt: number) {
    const b = this.battle;
    if (!b) { this.mode = "world"; return; }
    const inp = this.input;
    if (b.over) {
      if (inp.pressed("confirm")) {
        if (b.phase === "won" || b.phase === "spared") {
          if (b.result && b.msgIndex < b.msgs.length - 1) b.msgIndex++;
          else this.endBattle();
        } else this.endBattle();
      }
      return;
    }
    if (b.phase === "dialogue") {
      if (inp.pressed("confirm")) { advanceDialogue(b); Sfx.select(); }
      stepBattle(b, { up: false, down: false, left: false, right: false, confirm: false }, dt);
      return;
    }
    if (b.phase === "menu") {
      const dx = (inp.pressed("right") ? 1 : 0) - (inp.pressed("left") ? 1 : 0);
      if (b.subOpen) {
        const dy = (inp.pressed("down") ? 1 : 0) - (inp.pressed("up") ? 1 : 0);
        if (dy || dx) { navMenu(b, dx, dy); Sfx.move(); }
        if (inp.pressed("confirm")) { confirmAtMenu(b); Sfx.select(); }
        if (inp.pressed("cancel")) { b.subOpen = false; Sfx.cancel(); }
      } else {
        if (dx) { navMenu(b, dx, 0); Sfx.move(); }
        if (inp.pressed("confirm")) { confirmAtMenu(b); Sfx.open(); }
      }
      stepBattle(b, { up: false, down: false, left: false, right: false, confirm: false }, dt);
      return;
    }
    if (b.phase === "target") {
      if (inp.pressed("confirm") && b.bar.locked === null) { lockBar(b); Sfx.hitEnemy(); }
      stepBattle(b, { up: false, down: false, left: false, right: false, confirm: false }, dt);
      return;
    }
    if (b.phase === "enemyTurn") {
      stepBattle(b, { up: inp.down("up"), down: inp.down("down"), left: inp.down("left"), right: inp.down("right"), confirm: false }, dt);
      if (b.player.hp <= 0) this.toGameOver();
    }
  }

  private toGameOver() {
    this.flags.deaths++;
    Sfx.stopMusic();
    Sfx.death();
    this.mode = "over";
    this.pages = { lines: this.flags.deaths > 1 ? ENDINGS.gameover2 : ENDINGS.gameover, idx: 0, t: 0 };
    this.battle = null;
  }
  private respawn() {
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
  }

  private endBattle() {
    const b = this.battle;
    if (!b || !b.result) { this.battle = null; this.mode = "world"; Sfx.playMusic("town"); return; }
    const r = b.result;
    Sfx.stopMusic();
    const store = useGame.getState();
    const eid = b.enemy.id;
    if (r.outcome === "win") {
      store.awardBattle(r.sp, r.gold);
      const z = zoneAt(this.world, this.px, this.py);
      if (eid === "hare" || eid === "hound" || eid === "imp" || eid === "wight") {
        if (z?.id === "ridge") this.flags.killsRidge++; else this.flags.killsPines++;
      }
      if (eid === "kesh") { this.flags.keshKilled = true; this.flags.bossDone = true; }
      if (eid === "sentry") {
        this.flags.genDone = true; this.flags.bossDone = true;
        this.battle = null;
        this.mode = "ending";
        this.pages = { lines: ENDINGS.genocide, idx: 0, t: 0 };
        this.endAfter = () => this.saveGame();
        return;
      }
    }
    if (r.outcome === "spare") {
      Sfx.spare();
      store.awardBattle(0, r.gold);
      if (eid === "hare") this.flags.sparedHare = true;
      if (eid === "hound") this.flags.sparedHound = true;
      if (eid === "kesh") { this.flags.sparedKesh = true; this.flags.bossDone = true; }
      if (eid === "architect") { this.flags.architectSpared = true; this.flags.bossDone = true; this.flags.tpDone = true; }
    }
    if ((this.flags.killsPines >= 7 || this.flags.killsRidge >= 7) && !this.flags.genocideZone) {
      this.flags.genocideZone = true; // the town hears about the quota; the doors lock
    }
    this.battle = null;

    // Pacifist finale: the Gate opens for the spared — audience with the Architect
    if (eid === "kesh" && r.outcome === "spare" && this.flags.sparedKesh && this.flags.sparedHare && this.flags.sparedHound && totalKills(this.flags) === 0) {
      this.flags.bossDone = true;
      this.pages = {
        lines: [
          { text: "The crater breathes out. The halo of locked doors above the arch turns, one by one, to face you." },
          { who: "SYSTEM", text: "[FINAL AUDIENCE: THE ARCHITECT. BRING NOTHING BUT YOUR NUMBERS.]" },
        ], idx: 0, t: 0,
        after: () => this.beginBattle("architect", 30),
      };
      this.mode = "talk";
      return;
    }
    // Boss resolved → route ending pages
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
  }

  private saveGame() {
    writeSave<WorldSaveData>(SAVE_KEY, { x: this.px, y: this.py, flags: this.flags });
    Sfx.save();
    this.flags.saved = true;
    this.toast = { text: "[PROGRESS WRITTEN TO THE GATE. THE TOWN WILL REMEMBER.]", t: 3.2 };
  }

  private updateShop(dt: number) {
    void dt;
    const inp = this.input;
    const n = SHOP_ITEMS.length + 1;
    if (inp.pressed("down")) { this.shopSel = (this.shopSel + 1) % n; Sfx.move(); }
    if (inp.pressed("up")) { this.shopSel = (this.shopSel + n - 1) % n; Sfx.move(); }
    if (inp.pressed("cancel")) { this.mode = "world"; Sfx.cancel(); return; }
    if (inp.pressed("confirm")) {
      if (this.shopSel === SHOP_ITEMS.length) { this.mode = "world"; Sfx.cancel(); return; }
      const it = SHOP_ITEMS[this.shopSel];
      const s = useGame.getState();
      if (s.gold < it.cost) {
        Sfx.error();
        this.pages = { lines: [shopNoGold()], idx: 0, t: 0, after: () => { this.mode = "shop"; } };
        this.mode = "talk";
        return;
      }
      useGame.setState((st) => ({
        gold: st.gold - it.cost,
        potions: it.id === "potion" ? st.potions + 1 : st.potions,
      }));
      if (it.id !== "potion") this.flags.bought[it.id] = (this.flags.bought[it.id] ?? 0) + 1;
      Sfx.heal();
      this.pages = { lines: shopThanks(it.id), idx: 0, t: 0, after: () => { this.mode = "shop"; } };
      this.mode = "talk";
    }
  }

  // ---------------- render ----------------
  private render() {
    const g = this.g;
    g.filter = "none";
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#05070d";
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    switch (this.mode) {
      case "boot": this.renderBoot(g); break;
      case "intro": this.renderIntro(g); break;
      case "world": this.renderWorld(g); this.renderPrompt(g); break;
      case "talk": this.renderWorld(g); this.renderPages(g); break;
      case "shop": this.renderWorld(g); this.renderShop(g); break;
      case "status": this.renderWorld(g); this.renderStatus(g); break;
      case "over": this.renderAsh(g); this.renderPages(g); break;
      case "ending": this.renderWorld(g); this.renderPages(g); break;
      case "battle": this.renderBattle(g); break;
    }
    if (this.transT > 0) { g.fillStyle = `rgba(0,0,0,${this.transT})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.toast) {
      const a = clamp(this.toast.t, 0, 1);
      g.globalAlpha = a;
      const w = Math.min(VIEW_W - 36, 16 + this.toast.text.length * 8.1);
      g.fillStyle = "#0a0f1c"; g.fillRect(18, 14, w, 32);
      g.strokeStyle = "#7fe7ff"; g.lineWidth = 2; g.strokeRect(19, 15, w - 2, 30);
      drawText(g, this.toast.text.slice(0, 110), 26, 23, 12, "#bfe8ff");
      g.globalAlpha = 1;
    }
  }

  private renderBoot(g: CanvasRenderingContext2D) {
    if (this.bgReady && this.bg) { g.globalAlpha = 0.25; g.drawImage(this.bg, 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; }
    g.fillStyle = "rgba(3,5,10,0.6)"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(g, "A S H E N V E I L", VIEW_W / 2, 108, 42, "#e8f0ff", "center");
    drawText(g, "an unregistered dungeon with a small town in it", VIEW_W / 2, 158, 13, "#9fb4d8", "center");
    drawText(g, "— a training quest for people who train at 5 AM —", VIEW_W / 2, 176, 13, "#6d80a8", "center");
    const s = useGame.getState();
    drawText(g, `SYSTEM LINK: ${s.name || "GUEST"}   LV ${s.level} (real-world)   ${isMuted() ? "MUTED [M]" : "SOUND [M]"}`, VIEW_W / 2, 246, 12, "#7fe7ff", "center");
    if (Math.floor(performance.now() / 430) % 2 === 0) drawText(g, "PRESS  Z", VIEW_W / 2, 312, 22, "#ffffff", "center");
    drawText(g, "ARROWS/WASD move · Z confirm · X cancel & status · hold SHIFT: dash (LV 5+)", VIEW_W / 2, 402, 10, "#59708f", "center");
    drawText(g, "levels are earned in the real world; the dungeon pays in skill points", VIEW_W / 2, 418, 10, "#59708f", "center");
  }
  private renderIntro(g: CanvasRenderingContext2D) {
    g.fillStyle = "#000"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const p = this.pages;
    if (!p) return;
    const cur = p.lines[p.idx];
    if (!cur) return;
    const shown = Math.floor(p.t * TYPE_RATE);
    const lines = this.wrap((cur.text ?? "").slice(0, Math.max(0, shown)), 15, VIEW_W - 140);
    lines.slice(0, 12).forEach((l, i) => drawText(g, l, 70, 90 + i * 26, 15, "#cfe0ff"));
    if (shown >= (cur.text ?? "").length) drawText(g, "▼ Z", VIEW_W - 70, VIEW_H - 30, 12, "#ffffff", "right");
  }
  private renderAsh(g: CanvasRenderingContext2D) {
    g.fillStyle = "#000"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const t = performance.now() / 1000;
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(i * 7.3) * 0.5 + 0.5) * VIEW_W;
      const y = ((t * 12 + i * 37) % 520) - 20;
      g.globalAlpha = 0.25; g.fillStyle = "#ff3355";
      g.fillRect(x, VIEW_H / 2 + Math.sin(y) * 2, 2, 2);
    }
    g.globalAlpha = 1;
    g.drawImage(A.getProp("soul"), VIEW_W / 2 - 6, VIEW_H / 2 - 30, 12, 12);
  }

  private renderWorld(g: CanvasRenderingContext2D) {
    const ox = Math.round(-this.cam.x), oy = Math.round(-this.cam.y);
    if (this.bgReady && this.bg) {
      if (this.flags.genDone) g.filter = "grayscale(0.92) brightness(0.72)";
      g.drawImage(this.bg, ox, oy, MAP_PX, MAP_PX);
      g.filter = "none";
    }
    const drawList: { y: number; f: () => void }[] = [];
    for (const p of this.world.props) {
      if (p.sprite === "water") {
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
      }
      const baseY = p.y + p.h;
      const key = p.sprite === "gate" ? (this.flags.gateOpen ? "gateOpen" : "gateClosed") : p.sprite;
      drawList.push({ y: baseY - 0.5, f: () => {
        if (this.flags.genDone && (key === "inn" || key === "house" || key === "stall" || key === "stall2")) g.globalAlpha = 0.8;
        g.drawImage(A.getProp(key), ox + p.x, oy + p.y, p.w, p.h);
        g.globalAlpha = 1;
      } });
    }
    // the bridge deck across the gap
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
    // ash where NPCs used to stand
    for (const n of this.world.npcs) {
      if (n.hideAfter && this.flags[n.hideAfter as keyof WorldFlags] && n.id !== "dog") {
        drawList.push({ y: n.y * TILE + 8, f: () => g.drawImage(A.getProp("ash"), ox + n.x * TILE - 4, oy + n.y * TILE) });
      }
    }
    if (!this.flags.genDone) {
      for (const n of this.world.npcs) {
        if (n.hideAfter && this.flags[n.hideAfter as keyof WorldFlags]) continue;
        const bob = Math.floor(performance.now() / 460) % 2;
        drawList.push({ y: n.y * TILE + 10, f: () => {
          if (n.sprite === "houndOw") g.drawImage(A.getProp("hound"), ox + n.x * TILE - 8, oy + n.y * TILE - 10);
          else {
            const img = this.sprites[`n_${n.sprite}`]?.[0] ?? A.getProp("sign");
            g.drawImage(img, ox + n.x * TILE - 8, oy + n.y * TILE - 16 + bob);
          }
        } });
      }
    }
    // player — walk frame chosen from 3 frames: idle, step, step-alt (down2)
    const frames = this.sprites[`p${this.dir[0].toUpperCase()}${this.dir.slice(1)}`] ?? this.sprites.pDown;
    const fi = this.moving ? 1 + (Math.floor(this.walkT) % 2) : 0;
    const fr = this.moving && Math.floor(this.walkT) % 4 === 3 ? frames[2] : frames[fi];
    drawList.push({ y: this.py + 8, f: () => g.drawImage(fr, ox + this.px - 8, oy + this.py - 19) });
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) d.f();
    for (const s of this.world.signs) g.drawImage(A.getProp("sign"), ox + s.x * TILE - 6, oy + s.y * TILE - 10);
    // cold night tint
    g.fillStyle = "rgba(8,12,24,0.16)"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    this.renderMinimap(g);
  }
  private renderMinimap(g: CanvasRenderingContext2D) {
    const S = 60;
    const x = VIEW_W - S - 10, y = 10;
    g.fillStyle = "rgba(5,8,16,0.75)"; g.fillRect(x, y, S, S);
    g.strokeStyle = "#2c4a66"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, S, S);
    g.fillStyle = "#233047";
    g.fillRect(x + (8 / 64) * S, y + (46 / 64) * S, (47 / 64) * S, (16 / 64) * S);
    g.fillRect(x + (20 / 64) * S, y + (3 / 64) * S, (26 / 64) * S, (9 / 64) * S);
    g.fillStyle = "#ffd88a"; g.fillRect(x + (58 / 64) * S - 1, y + (26 / 64) * S - 1, 3, 3);
    g.fillStyle = "#7fe7ff"; g.fillRect(x + (this.px / MAP_PX) * S - 1, y + (this.py / MAP_PX) * S - 1, 2, 2);
  }
  private renderPrompt(g: CanvasRenderingContext2D) {
    const hit = this.nearestInteract();
    if (!hit) return;
    let label = "TALK";
    if (hit.kind === "sign") label = "READ";
    if (hit.key === "save") label = "SAVE";
    if (hit.key === "bossGate") label = "ENTER";
    if (hit.key === "gate") label = this.flags.gateOpen ? "OPEN GATE" : this.flags.hasKey ? "USE KEY" : "LOCKED";
    if (Math.floor(performance.now() / 320) % 2 === 0) drawText(g, `[Z] ${label}`, VIEW_W / 2, VIEW_H - 110, 13, "#ffd88a", "center");
  }

  private box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    g.fillStyle = "#000000"; g.fillRect(x, y, w, h);
    g.strokeStyle = "#ffffff"; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }
  private wrap(text: string, size: number, maxW: number): string[] {
    const g = this.g;
    g.font = `${size}px "Share Tech Mono", monospace`;
    const out: string[] = [];
    let line = "";
    for (const w of text.split(" ")) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = w; }
      else line = test;
    }
    if (line) out.push(line);
    return out;
  }
  private renderPages(g: CanvasRenderingContext2D) {
    const p = this.pages;
    if (!p) return;
    const cur = p.lines[p.idx];
    if (!cur) return;
    this.box(g, 96, 330, VIEW_W - 192, 128);
    if (cur.who) drawText(g, cur.who, 116, 342, 13, "#ffd88a");
    const shown = Math.floor(p.t * TYPE_RATE);
    const lines = this.wrap((cur.text ?? "").slice(0, Math.max(0, shown)), 14, VIEW_W - 240);
    lines.slice(0, 4).forEach((l, i) => drawText(g, l, 116, 366 + i * 19, 14, "#ffffff"));
    if (shown >= (cur.text ?? "").length && Math.floor(performance.now() / 300) % 2 === 0) {
      drawText(g, "▼", VIEW_W - 124, 438, 12, "#ffffff", "right");
    }
  }
  private renderShop(g: CanvasRenderingContext2D) {
    this.box(g, 120, 196, 400, 244);
    drawText(g, "MISOL'S EVERYTHING", 140, 212, 16, "#ffd88a");
    drawText(g, `GOLD ${useGame.getState().gold}`, 500, 212, 13, "#9fe8ff", "right");
    SHOP_ITEMS.forEach((it, i) => {
      const sel = i === this.shopSel;
      drawText(g, `${sel ? "♥" : " "} ${it.name} — ${it.cost}g`, 140, 244 + i * 26, 14, sel ? "#ffffff" : "#9fb4d8");
    });
    drawText(g, `${this.shopSel === SHOP_ITEMS.length ? "♥" : " "} LEAVE`, 140, 244 + SHOP_ITEMS.length * 26, 14, this.shopSel === SHOP_ITEMS.length ? "#ffffff" : "#9fb4d8");
    if (this.shopSel < SHOP_ITEMS.length) {
      const sel = SHOP_ITEMS[this.shopSel];
      this.wrap(sel.desc, 11, 372).slice(0, 2).forEach((l, i) => drawText(g, l, 142, 372 + i * 14, 11, "#6d80a8"));
      drawText(g, `carrot ${(this.flags.bought.carrot ?? 0)}  treat ${(this.flags.bought.treat ?? 0)}  ramen ${(this.flags.bought.ramen ?? 0)}  potions ${(useGame.getState().potions)}`, 142, 402, 10, "#59708f");
    }
    drawText(g, "Z buy · X leave", 142, 420, 10, "#59708f");
  }
  private renderStatus(g: CanvasRenderingContext2D) {
    const s = useGame.getState();
    const combat = deriveBattleStats({ str: s.str, agi: s.agi, vit: s.vit, fatigueLevel: s.fatigueLevel });
    this.box(g, 110, 54, 420, 376);
    drawText(g, "STATUS — REAL-WORLD LINK", 130, 70, 16, "#ffd88a");
    const rows: [string, string][] = [
      ["NAME", (s.name || "GUEST").toUpperCase()],
      ["LV (earned at 5 AM)", String(s.level)],
      ["battle HP / ATK / DEF", `${combat.maxHP} / ${combat.atk} / ${combat.def}`],
      ["STR / AGI / VIT", `${s.str} / ${s.agi} / ${s.vit}`],
      ["skill points in hand", String(s.sp)],
      ["gold", String(s.gold)],
      ["potions", String(s.potions)],
      ["kills — pines / ridge", `${this.flags.killsPines} / ${this.flags.killsRidge}`],
      ["spared — hare/hound/kesh", `${this.flags.sparedHare ? "✓" : "—"} / ${this.flags.sparedHound ? "✓" : "—"} / ${this.flags.sparedKesh ? "✓" : "—"}`],
      ["ridge gate", this.flags.gateOpen ? "OPEN" : this.flags.hasKey ? "key in pocket" : "locked (find the innkeeper)"],
      ["route so far", routeOf(this.flags)],
      ["deaths in the dungeon", String(this.flags.deaths)],
    ];
    rows.forEach((r, i) => {
      drawText(g, r[0], 130, 106 + i * 23, 12, "#9fb4d8");
      drawText(g, r[1], 512, 106 + i * 23, 12, "#ffffff", "right");
    });
    drawText(g, "LEVEL RISES ONLY WHEN YOU TRAIN IRL. KILLS PAY SKILL", 130, 394, 10, "#6d80a8");
    drawText(g, "POINTS — SPEND THEM IN THE SKILL TREE ON THE MAIN APP.", 130, 406, 10, "#6d80a8");
  }

  private renderBattle(g: CanvasRenderingContext2D) {
    const b = this.battle;
    if (!b) { this.mode = "world"; return; }
    g.fillStyle = "#000"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const grad = g.createLinearGradient(0, 0, 0, 250);
    grad.addColorStop(0, b.enemy.boss ? "rgba(38,10,26,0.75)" : "rgba(14,20,38,0.75)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, VIEW_W, 250);
    let es = this.battleSprites[b.enemy.id];
    if (!es) {
      const mkf: Record<string, () => HTMLCanvasElement> = { hare: A.hareBattle, hound: A.houndBattle, imp: A.impBattle, wight: A.wightBattle, kesh: A.keshBattle, architect: A.architectBattle, sentry: A.sentryBattle };
      es = mkf[b.enemy.id]?.() ?? A.hareBattle();
      this.battleSprites[b.enemy.id] = es;
    }
    if (es) {
      const maxH = 208;
      let sc = b.enemy.boss ? 6 : 6;
      if (es.height * sc > maxH) sc = Math.floor(maxH / es.height);
      const bob = Math.floor(performance.now() / 520) % 2;
      const w = es.width * sc, h = es.height * sc;
      g.globalAlpha = b.over && b.result?.outcome === "win" ? 0.12 : 1;
      g.drawImage(es, Math.round(VIEW_W / 2 - w / 2), Math.round(126 - h / 2 + bob + Math.min(40, (238 - 126 - h / 2) / 2)), w, h);
      g.globalAlpha = 1;
    }
    if (b.shake > 0.1) g.save();
    if (b.shake > 0.1) g.translate((Math.random() - 0.5) * Math.min(6, b.shake), (Math.random() - 0.5) * Math.min(6, b.shake));
    const bx = b.box.x, by = b.box.y, bw = b.box.w, bh = b.box.h;
    this.box(g, bx, by, bw, bh);

    const showMsg = b.phase === "dialogue" || b.over;
    if (showMsg) {
      const msg = b.msgs[b.msgIndex];
      if (msg) {
        const t = typeof msg === "string" ? { text: msg } : msg;
        let y = by + 14;
        if (t.who) { drawText(g, t.who, bx + 18, y, 12, "#ffd88a"); y += 18; }
        this.wrap(t.text, 13, bw - 36).slice(0, 4).forEach((l, i) => drawText(g, l, bx + 18, y + 4 + i * 17, 13, "#ffffff"));
      }
      if (b.over && b.result && (b.result.outcome === "win" || b.result.outcome === "spare")) {
        drawText(g, `+${b.result.sp} SKILL POINTS   +${b.result.gold} GOLD${b.result.outcome === "spare" ? "   (MERCY — no XP exists; ask the 5 AM crew)" : ""}`, bx + 18, by + bh - 22, 11, "#9fe8ff");
        if (Math.floor(performance.now() / 300) % 2 === 0) drawText(g, "▼ Z", bx + bw - 16, by + bh - 22, 12, "#fff", "right");
      } else if (b.over) {
        if (Math.floor(performance.now() / 300) % 2 === 0) drawText(g, "▼ Z", bx + bw - 16, by + bh - 22, 12, "#fff", "right");
      }
    }
    if (b.phase === "target") {
      const barW = bw, barY = by - 60;
      g.fillStyle = "#10141c"; g.fillRect(bx, barY, barW, 24);
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect(bx + 1, barY + 1, barW - 2, 22);
      g.fillStyle = "rgba(255,216,138,0.9)"; g.fillRect(bx + barW / 2 - 4, barY, 8, 24);
      const px = bx + barW / 2 + b.bar.pos * (barW / 2 - 14);
      g.fillStyle = b.bar.locked !== null ? "#7fff9e" : "#ffffff";
      g.fillRect(px - 3, barY - 3, 6, 30);
      drawText(g, "Z — STRIKE", VIEW_W / 2, by + 34, 13, "#9fb4d8", "center");
    }
    if ((b.phase === "menu" || b.phase === "target" || b.phase === "enemyTurn") && !b.over) {
      const labels = ["FIGHT", "ACT", "ITEM", "MERCY"];
      labels.forEach((l, i) => {
        const x = 132 + i * 100;
        const sel = b.menu === i && !b.subOpen;
        g.strokeStyle = "#ff9a00"; g.lineWidth = 2;
        const pad = sel ? -4 : 0;
        g.strokeRect(x + pad, 404, 88 - pad * 2, 32);
        if (sel) { g.fillStyle = "rgba(255,154,0,0.18)"; g.fillRect(x + pad, 404, 88 - pad * 2, 32); }
        if (sel) g.drawImage(A.getProp("cursor"), x - 18, 413, 12, 12);
        drawText(g, l, x + 44, 412, 16, sel ? "#ffff00" : "#ff9a00", "center");
      });
    }
    if (b.phase === "menu" && b.subOpen) {
      const items = menuItems(b);
      items.slice(0, 5).forEach((it, i) => {
        drawText(g, `${b.sub === i ? "♥" : " "} ${it.label}`, bx + 22, by + 12 + i * 20, 13, it.enabled ? "#ffffff" : "#55556a");
      });
      if (b.menu === 3 && b.enemy.spareable) { g.fillStyle = "rgba(159,232,255,0.12)"; g.fillRect(bx + 4, by + 4, bw - 8, 20); drawText(g, "★ ", bx + 8, by + 8, 13, "#7fe7ff"); }
    }
    if (b.phase === "enemyTurn") {
      g.save();
      g.beginPath(); g.rect(bx + 3, by + 3, bw - 6, bh - 6); g.clip();
      for (const p of b.bullets) {
        g.globalAlpha = p.windup > 0 ? 0.35 : 1;
        g.fillStyle = p.color ?? "#ffffff";
        if (p.shape === "circle") { g.beginPath(); g.arc(p.x, p.y, Math.max(2, p.w / 2), 0, Math.PI * 2); g.fill(); }
        else g.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      }
      g.globalAlpha = 1;
      g.restore();
      g.drawImage(A.getProp("soul"), Math.round(b.soul.x) - 4, Math.round(b.soul.y) - 4);
      if (b.turnT < 1.2 && Math.floor(performance.now() / 180) % 2 === 0) drawText(g, "*", VIEW_W / 2, VIEW_H - 60, 12, "#59708f", "center");
    }
    if (b.shake > 0.1) g.restore();
    if (b.flash > 0.01) { g.fillStyle = `rgba(255,60,90,${b.flash * 0.3})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    // player strip
    drawText(g, b.player.name, 150, 382, 14, "#ffffff");
    drawText(g, `LV ${b.player.level}`, 330, 382, 14, "#ffffff");
    const frac = clamp(b.player.hp / b.player.maxHp, 0, 1);
    g.fillStyle = "#8a8a8a"; g.fillRect(420, 383, 92, 12);
    g.fillStyle = frac > 0.5 ? "#7fff9e" : frac > 0.25 ? "#ffd88a" : "#ff5566";
    g.fillRect(420, 383, 92 * frac, 12);
    drawText(g, `${b.player.hp} / ${b.player.maxHp}`, 520, 382, 13, "#ffffff");
    g.drawImage(A.getProp("soul"), 128, 384, 10, 10);
    // enemy state tag
    if (b.enemy.spareable) drawText(g, `${b.enemy.name} is willING to be spared`, VIEW_W / 2, 232, 11, "#9fe8ff", "center");
  }
}
