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
  menuItems, campaignStats, type BattleState,
} from "./battle";
import {
  getNpc, signAll, ENDINGS, SHOP_INTRO, SHOP_ITEMS,
  shopThanks, shopNoGold, gateHint, bossGateHint, WELCOME_BACK, levelUpToast,
  prologue, regionArrive, bossGate as bossGateScript, bossAfter, ceremony as ceremonyLines, ceremonyAnswer, epilogue, nextObjective, type Line,
} from "./script";
import * as A from "./art";
import { useGame } from "../store/game";


const SAVE_KEY = "sl_ashenveil_v2";
const OLD_SAVE_KEY = "sl_ashenveil_v1";
const TYPE_RATE = 36; // chars per second

type Mode = "boot" | "intro" | "world" | "talk" | "shop" | "status" | "battle" | "over" | "ending" | "choice";

interface Pages { lines: Line[]; idx: number; t: number; after?: () => void }

export class AshenGame {
  private g: CanvasRenderingContext2D;
  input = new Input();
  private raf = 0;
  private last = 0;
  private started = false;

  private world: WorldDef;
  private regionId = "verdant";
  private zoom = 2;
  private hasSave = false;
  private choice: { lines: Line[]; idx: number; t: number; opts: { label: string; run: () => void }[]; sel: number } | null = null;
  private shopName = "MISOL'S EVERYTHING";
  private canvasEl: HTMLCanvasElement;
  private keyHud: (e: KeyboardEvent) => void;
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
  }
  /** for touch buttons in the React shell */
  virtual(k: Parameters<Input["press"]>[0], down: boolean) { this.input.press(k, down); }
  toggleMute() {
    setMuted(!isMuted());
    if (!isMuted()) Sfx.playMusic(this.mode === "battle" ? (this.battle && this.battle.enemy.boss ? "boss" : "battle") : this.world.region.music);
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
    // the expedition cast
    S.n_seo = [mk({ hair: "#2c2f3a", hairLt: "#4a4f60", coat: "#3d4a66", coatDk: "#2a344c", coatLt: "#5a6f96" })];
    S.n_hana = [mk({ hair: "#1d3326", hairLt: "#2f5540", coat: "#4f7a46", coatDk: "#38572f", coatLt: "#6f9c5f", hat: "beanie" })];
    S.n_jino = [mk({ hair: "#4a3020", hairLt: "#6b4a2b", coat: "#b0632c", coatDk: "#7d4620", coatLt: "#d4883e", small: true })];
    S.n_roan = [mk({ hair: "#8a6a3f", hairLt: "#b98f55", coat: "#c9a06a", coatDk: "#96724a", coatLt: "#e4c492", accent: "#f4e8c8", small: true })];
    S.n_sila = [mk({ hair: "#22202a", hairLt: "#383548", coat: "#2f5a5e", coatDk: "#1f3f43", coatLt: "#457e83", hat: "beanie" })];
    S.n_reedwatcher = [mk({ hair: "#6b6248", hairLt: "#8f8568", coat: "#5d6b4a", coatDk: "#3f4a33", coatLt: "#7c8c66", beard: true })];
    S.n_kang = [mk({ hair: "#8f8f8f", hairLt: "#c2c2c2", coat: "#46506e", coatDk: "#2f3750", coatLt: "#636f96", beard: true })];
    S.n_verity = [mk({ hair: "#3b1d22", hairLt: "#5c2e36", coat: "#7a2431", coatDk: "#541621", coatLt: "#a53a48" })];
    S.n_ember = [mk({ hair: "#c2571f", hairLt: "#e8853a", coat: "#8a3c1a", coatDk: "#5e2811", coatLt: "#b95e2e", small: true })];
    S.n_herald = [mk({ hair: "#c8b46a", hairLt: "#e8d9a0", coat: "#3a3524", coatDk: "#262216", coatLt: "#57502f" })];
    S.n_ivy = [mk({ hair: "#5c3a52", hairLt: "#7e5573", coat: "#4a3a66", coatDk: "#332849", coatLt: "#66538c", hat: "beanie" })];
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
          if (this.hasSave) { this.mode = "world"; Sfx.playMusic(this.world.region.music); break; }
          this.pages = { lines: prologue(useGame.getState().name || "HUNTER"), idx: 0, t: 0 };
          this.mode = "intro";
        }
        break;
      case "intro": this.updatePages(dt, () => {
        this.mode = "world"; this.flags.introDone = true;
        Sfx.playMusic(this.world.region.music);
      }); break;
      case "choice": this.updateChoice(dt); break;
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

    const VW = VIEW_W / this.zoom, VH = VIEW_H / this.zoom;
    this.cam.x = clamp(lerp(this.cam.x, this.px - VW / 2, dt * 6), 0, Math.max(0, MAP_PX - VW));
    this.cam.y = clamp(lerp(this.cam.y, this.py - VH / 2, dt * 6), 0, Math.max(0, MAP_PX - VH));

    if (this.input.pressed("cancel")) { this.mode = "status"; Sfx.open(); return; }
    if (this.input.pressed("confirm")) this.interact();
  }

  private updateChoice(dt: number) {
    const c = this.choice;
    if (!c) { this.mode = "world"; return; }
    c.t += dt;
    if (c.idx < c.lines.length) {
      const cur = c.lines[c.idx];
      const len = (cur?.text ?? "").length;
      if (this.input.pressed("confirm")) {
        if (c.t * TYPE_RATE < len) c.t = len / TYPE_RATE + 0.001;
        else { c.idx++; c.t = 0; Sfx.select(); }
      }
      return;
    }
    if (this.input.pressed("down") || this.input.pressed("up")) { c.sel = c.sel === 0 ? 1 : 0; Sfx.move(); }
    if (this.input.pressed("confirm")) {
      Sfx.select();
      const run = c.opts[c.sel].run;
      this.choice = null;
      run();
    }
  }

  private encounterTick() {
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
      if (n.hideAfter && this.hideFlag(n.hideAfter)) continue;
      consider(n.x * TILE + 8, n.y * TILE, "npc", n.dialogue);
    }
    if (this.world.boss && !this.flags.bossDown[this.world.boss.id]) {
      const bo = this.world.boss;
      consider(bo.x * TILE + 8, (bo.y + 1) * TILE, "prop", "boss");
    }
    // the alpha's den: only exists for players the dungeon has taught nothing yet
    if (this.regionId === "caverns" && this.flags.killsTotal >= 14 && !this.flags.bossDown["alpha"]) {
      consider(20 * TILE + 8, 11 * TILE, "prop", "den");
    }
    if (this.world.exit) {
      const ex = this.world.exit;
      consider(ex.x * TILE + 8, ex.y * TILE + 8, "prop", "exit");
    }
    for (const s of this.world.signs) consider(s.x * TILE + 4, s.y * TILE + 4, "sign", s.text);
    for (const p of this.world.props) {
      if (p.gate) consider(p.x + p.w / 2, p.y + p.h - 6, "prop", "gate");
      if (p.interact) consider(p.x + p.w / 2, p.y + p.h - 6, "prop", p.interact.id);
    }
    return best ? (best as unknown as { r: { kind: "npc" | "sign" | "prop"; key: string } }).r : null;
  }

  private hideFlag(key: string): boolean {
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
    if (hit.kind === "prop" && hit.key === "den") {
      Sfx.bossIntro();
      this.pages = { lines: bossGateScript("alpha", this.flags), idx: 0, t: 0, after: () => this.beginBattle("alpha", 30, true) };
      this.mode = "talk"; return;
    }
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
  }
  private afterTalk(key: string) {
    const f = this.flags;
    f.met[key] = (f.met[key] ?? 0) + 1;
    if (key === "dog.rock") f.dogFound = true;
    if (key === "kid.lost" && f.dogFound) f.dogReturned = true;
    if (key === "inn.baek" && f.dogReturned && !f.hasKey) f.hasKey = true;
    if (key === "kang.caverns" && f.met[key] >= 2) f.kangBond = true;   // the second lesson is the trust
    if (key === "verity.caverns" && f.met[key] >= 1) f.met["verity.keys"] = 1;
    if (key === "ivy.citadel" && f.met[key] >= 1 && f.kangBond) f.met["ivy.lesson"] = 1;
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

  private beginBattle(id: string, zoneLevel: number, isBoss = false) {
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
      if (this.regionId === "ashenveil") this.flags.killsTotal++;
      else if (!b.enemy.boss) this.flags.killsTotal++;
      if ((b.enemy.boss || eid === "alpha") && this.regionId !== "ashenveil") {
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
      if (eid === "bat") this.flags.emberBond = true;
      if (eid === "hknife") {
        this.flags.savedPair = true;
        this.pages = { lines: [{ text: "The roll call ends. Down the hall, forty years of standing armor sits down at once, and a light walks out of a visor and UP, into the crack in the east wall, and the wall forgives someone. Somewhere above, in a marsh filing office that does not exist, two names move from PENDING to WALKED HOME." }, { who: "SYSTEM", text: "[SURVEY TEAM: HANA, JINO — STATUS UPDATED. THE UPDATE CAME FROM NO DEPARTMENT. WE HAVE DECIDED NOT TO INVESTIGATE WHICH ONE, BECAUSE FOR ONCE THE PAPERWORK IS KIND.]" }], idx: 0, t: 0 };
        this.mode = "talk";
      }
      if ((b.enemy.boss || eid === "alpha") && this.regionId !== "ashenveil") {
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
    // Boss resolved → route ending pages (with the campaign epilogue appended)
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
    if (eid === "warden" && this.world.boss && !this.flags.unregistered) {
      this.choice = {
        lines: ceremonyLines(this.flags),
        idx: 0, t: 0,
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
  }

  private saveGame() {
    writeSave<WorldSaveData>(SAVE_KEY, { region: this.regionId, x: this.px, y: this.py, flags: this.flags });
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
      case "choice": this.renderWorld(g); this.renderChoice(g); break;
    }
    if (this.mode === "world" || this.mode === "talk") this.renderTracker(g);
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
    drawText(g, "A S H E N V E I L", VIEW_W / 2, 96, 40, "#e8f0ff", "center");
    drawText(g, "an expedition: five floors, one swallowed city block, forty-one debts", VIEW_W / 2, 146, 13, "#9fb4d8", "center");
    drawText(g, "— a training quest for people who train at 5 AM —", VIEW_W / 2, 164, 13, "#6d80a8", "center");
    const s = useGame.getState();
    drawText(g, `SYSTEM LINK: ${s.name || "GUEST"}   LV ${s.level} (real-world)   ${isMuted() ? "MUTED [M]" : "SOUND [M]"}`, VIEW_W / 2, 246, 12, "#7fe7ff", "center");
    if (Math.floor(performance.now() / 430) % 2 === 0) drawText(g, "PRESS  Z", VIEW_W / 2, 312, 22, "#ffffff", "center");
    drawText(g, "ARROWS/WASD move · Z confirm · X status · SHIFT dash (LV 5+) · T hide tracker hint", VIEW_W / 2, 396, 10, "#59708f", "center");
    drawText(g, "F fullscreen · - / + zoom · levels earned IRL by dailies; the dungeon pays skill points", VIEW_W / 2, 412, 10, "#59708f", "center");
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
    }
    const drawList: { y: number; f: () => void }[] = [];
    for (const p of this.world.props) {
      if (p.sprite === "water") {
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
      }
      const baseY = p.y + p.h;
      const key = p.sprite === "gate" ? (this.flags.gateOpen ? "gateOpen" : "gateClosed") : p.sprite;
      drawList.push({ y: baseY - 0.5, f: () => {
        if (this.flags.genDone && (key === "inn" || key === "house" || key === "stall" || key === "stall2")) g.globalAlpha = 0.8;
        try { g.drawImage(A.getProp(key), ox + p.x, oy + p.y, p.w, p.h); } catch { /* unknown key */ }
        g.globalAlpha = 1;
      } });
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
  }
  private renderMinimap(g: CanvasRenderingContext2D) {
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
    this.box(g, 110, 300, VIEW_W - 220, 146);
    if (c.idx < c.lines.length) {
      const cur = c.lines[c.idx];
      const shown = Math.floor(c.t * TYPE_RATE);
      if (cur?.who) drawText(g, cur.who, 130, 314, 12, "#ffd88a");
      this.wrap((cur?.text ?? "").slice(0, Math.max(0, shown)), 13, VIEW_W - 268).slice(0, 5).forEach((l, i) => drawText(g, l, 130, 334 + i * 18, 13, "#ffffff"));
      if (shown >= (cur?.text ?? "").length) drawText(g, "▼ Z", VIEW_W - 130, 434, 12, "#ffffff", "right");
      return;
    }
    drawText(g, "THE SYSTEM WAITS FOR YOUR ANSWER", VIEW_W / 2, 316, 12, "#ffd88a", "center");
    c.opts.forEach((o, i) => {
      const sel = i === c.sel;
      drawText(g, `${sel ? "\u2665" : " "} ${o.label}`, 140, 348 + i * 24, 15, sel ? "#ffffff" : "#6d80a8");
    });
    drawText(g, "up/down choose · Z answer", VIEW_W - 140, 432, 10, "#59708f", "right");
  }

  private renderPrompt(g: CanvasRenderingContext2D) {
    const hit = this.nearestInteract();
    if (!hit) return;
    let label = "TALK";
    if (hit.kind === "sign") label = "READ";
    if (hit.key === "save") label = "SAVE";
    if (hit.key === "bossGate") label = "ENTER";
    if (hit.key === "shop.sila") label = "TRADE";
    if (hit.key === "boss") label = "CHALLENGE";
    if (hit.key === "exit") label = this.world.boss && !this.flags.bossDown[this.world.boss.id] ? "BRICKED UP" : `TRAVEL: ${this.world.exit?.label ?? ""}`;
    if (hit.key === "goBack") label = "RETURN TO THE CITADEL";
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
    drawText(g, this.shopName, 140, 212, 16, "#ffd88a");
    drawText(g, `GOLD ${useGame.getState().gold}`, 500, 212, 13, "#9fe8ff", "right");
    SHOP_ITEMS.forEach((it, i) => {
      const sel = i === this.shopSel;
      drawText(g, `${sel ? "\u2665" : " "} ${it.name} — ${it.cost}g`, 140, 244 + i * 26, 14, sel ? "#ffffff" : "#9fb4d8");
    });
    drawText(g, `${this.shopSel === SHOP_ITEMS.length ? "\u2665" : " "} LEAVE`, 140, 244 + SHOP_ITEMS.length * 26, 14, this.shopSel === SHOP_ITEMS.length ? "#ffffff" : "#9fb4d8");
    if (this.shopSel < SHOP_ITEMS.length) {
      const sel = SHOP_ITEMS[this.shopSel];
      this.wrap(sel.desc, 11, 372).slice(0, 2).forEach((l, i) => drawText(g, l, 142, 372 + i * 14, 11, "#6d80a8"));
      drawText(g, `carrot ${(this.flags.bought.carrot ?? 0)}  treat ${(this.flags.bought.treat ?? 0)}  ramen ${(this.flags.bought.ramen ?? 0)}  potions ${(useGame.getState().potions)}`, 142, 402, 10, "#59708f");
    }
    drawText(g, "Z buy · X leave", 142, 420, 10, "#59708f");
  }
  private renderStatus(g: CanvasRenderingContext2D) {
    const s = useGame.getState();
    const combat = campaignStats(s.level, s.str, s.agi, s.vit, s.fatigueLevel);
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
      ["floor", `${this.world.region.name} — band LV ${this.world.region.from}\u2013${this.world.region.to}`],
      ["kills — pines / ridge / total", `${this.flags.killsPines} / ${this.flags.killsRidge} / ${this.flags.killsTotal}`],
      ["floor bosses resolved", Object.keys(this.flags.bossDown).filter((k) => this.flags.bossDown[k]).length + " / 5"],
      ["spared — hare/hound/kesh", `${this.flags.sparedHare ? "\u2713" : "\u2014"} / ${this.flags.sparedHound ? "\u2713" : "\u2014"} / ${this.flags.sparedKesh ? "\u2713" : "\u2014"}`],
      ["ridge gate", this.flags.gateOpen ? "OPEN" : this.flags.hasKey ? "key in pocket" : "locked (find the innkeeper)"],
      ["route so far", routeOf(this.flags)],
      ["deaths in the dungeon", String(this.flags.deaths)],
    ];
    rows.forEach((r, i) => {
      drawText(g, r[0], 130, 100 + i * 21, 11, "#9fb4d8");
      drawText(g, r[1], 512, 100 + i * 21, 11, "#ffffff", "right");
    });
    drawText(g, "LEVEL RISES ONLY WHEN YOU TRAIN IRL. KILLS PAY SKILL", 130, 398, 10, "#6d80a8");
    drawText(g, "POINTS — SPEND THEM IN THE SKILL TREE ON THE MAIN APP.", 130, 410, 10, "#6d80a8");
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
      es = A.getBattleSprite(b.enemy.id);
      this.battleSprites[b.enemy.id] = es;
    }
    if (es) {
      const maxH = 208;
      let sc = b.enemy.boss ? 9 : 7;
      if (es.height * sc > maxH) sc = Math.max(5, Math.floor(maxH / es.height));
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
        drawText(g, `+${b.result.sp} SKILL POINTS   +${b.result.gold} GOLD${b.result.outcome === "spare" ? "   (MERCY \u2014 no XP exists; ask the 5 AM crew)" : ""}`, bx + 18, by + bh - 22, 11, "#9fe8ff");
        if (Math.floor(performance.now() / 300) % 2 === 0) drawText(g, "\u25BC Z", bx + bw - 16, by + bh - 22, 12, "#fff", "right");
      } else if (b.over) {
        if (Math.floor(performance.now() / 300) % 2 === 0) drawText(g, "\u25BC Z", bx + bw - 16, by + bh - 22, 12, "#fff", "right");
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
      drawText(g, "Z \u2014 STRIKE", VIEW_W / 2, by + 34, 13, "#9fb4d8", "center");
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
        drawText(g, `${b.sub === i ? "\u2665" : " "} ${it.label}`, bx + 22, by + 12 + i * 20, 13, it.enabled ? "#ffffff" : "#55556a");
      });
      if (b.menu === 3 && b.enemy.spareable) { g.fillStyle = "rgba(159,232,255,0.12)"; g.fillRect(bx + 4, by + 4, bw - 8, 20); drawText(g, "\u2605 ", bx + 8, by + 8, 13, "#7fe7ff"); }
    }
    if (b.phase === "enemyTurn") {
      g.save();
      g.beginPath(); g.rect(bx + 3, by + 3, bw - 6, bh - 6); g.clip();
      for (const pr of b.bullets) {
        g.globalAlpha = pr.windup > 0 ? 0.35 : 1;
        g.fillStyle = pr.color ?? "#ffffff";
        if (pr.shape === "circle") { g.beginPath(); g.arc(pr.x, pr.y, Math.max(2, pr.w / 2), 0, Math.PI * 2); g.fill(); }
        else g.fillRect(pr.x - pr.w / 2, pr.y - pr.h / 2, pr.w, pr.h);
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
    drawText(g, `${Math.max(0, Math.ceil(b.player.hp))} / ${b.player.maxHp}`, 520, 382, 13, "#ffffff");
    g.drawImage(A.getProp("soul"), 128, 384, 10, 10);
    // enemy state tag
    if (b.enemy.spareable) drawText(g, `${b.enemy.name} is willING to be spared`, VIEW_W / 2, 232, 11, "#9fe8ff", "center");
    // RESONANCE: the overlevel rescue — the floor refuses to let a debt stand unpaid
    if (b.resonance) {
      const t2 = performance.now() / 380;
      const a2 = 0.35 + Math.sin(t2) * 0.18;
      g.globalAlpha = a2;
      g.strokeStyle = "#3fd2ff"; g.lineWidth = 2; g.strokeRect(b.soul.x - 9, b.soul.y - 9, 18, 18);
      g.globalAlpha = 1;
      drawText(g, "\u25C8 RESONANCE \u2014 the floor holds you up", VIEW_W / 2, 396, 10, "#7fe7ff", "center");
    }
  }
}
