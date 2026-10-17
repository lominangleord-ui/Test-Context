// Ashenveil — the game view v2: real per-floor worlds (ground chunks,
// collision.png masks, objects.json), camera follow with clamps, foot-box
// collision that slides along walls, a dev-only floor editor — and the same
// Undertale-style battle stage underneath, letterboxed. Canvas is 960×540
// world units; 1 world unit = 2 art px; the ground is NEVER upscaled past 1:1.
// No React inside (the shell just mounts this canvas).
import {
  VIEW_W, VIEW_H, Input, clamp, lerp, readSave, writeSave,
  Sfx, isMuted, setMuted, drawText, outlineSprite,
} from "./core";
import {
  totalKills, routeOf, freshFlags, makeFloor, loadFloorArt, placeholderGround,
  inZone, posBlocked, stepMove, atHazard,
  type WorldFlags, type WorldSaveData, type Floor, type FloorSave,
} from "./world";
import {
  createBattle, stepBattle, confirmAtMenu, navMenu, advanceDialogue, lockBar,
  menuItems, campaignStats, spawnLevelFor, claimGate, REMNANT_IDS, resolveClaim, RESONANCE_TEXT, type BattleState,
} from "./battle";
import {
  getNpc, signAll, ENDINGS, SHOP_INTRO, SHOP_ITEMS,
  shopThanks, shopNoGold, gateHint, bossGateHint, WELCOME_BACK, levelUpToast, CREATION_INTRO,
  prologue, regionArrive, bossGate as bossGateScript, bossAfter, ceremony as ceremonyLines, ceremonyAnswer, epilogue, type Line,
} from "./script";
import * as A from "./art";
import { useGame } from "../store/game";
import type { FloorEditor } from "./editor";
import { Art, ArtMusic, actorKey, portraitKey, battleKey, propKey, displayName, playerPartKey } from "./artset";
import { bossGateDecision, bossGateLines } from "./gate";
import { dollFor, invalidateDollCache, defaultAppearance, normalizeAppearance, subTokens, randomize as randomLook, cycleField, validName, CREATOR_FIELDS, COLOR_SWATCHES, SKIN_SWATCHES, HAIR_SWATCHES, ACCESSORY_NAMES, JACKET_NAMES, BUILD_NAMES, FACE_NAMES, type Appearance, type CreatorField } from "./appearance";
import { OBJECTIVES, journalRows, defaultTracked, resolveTarget, nodeDoneEff, METRES, type ObjNode } from "./objectives";
import { onRest, FLOOR_IDS as FLOOR_IDS_LIST } from "./world";
import { ENEMY_LINES as EX_LINES_LIST } from "./script";


const SAVE_KEY = "sl_ashenveil_v2";
const TYPE_RATE = 36; // chars per second

type Mode = "boot" | "intro" | "world" | "talk" | "shop" | "status" | "battle" | "over" | "ending" | "choice" | "create" | "journal";

interface Pages { lines: Line[]; idx: number; t: number; after?: () => void; pg?: number }

export class AshenGame {
  private g: CanvasRenderingContext2D;
  input = new Input();
  private raf = 0;
  private last = 0;
  private started = false;
  paused = false;

  // --- world state (public for the dev editor and the headless harness) ---
  floor: Floor;
  regionId = "verdant";
  flags: WorldFlags;
  px = 0;
  py = 0;
  cam = { x: 0, y: 0 };
  private dir: "down" | "up" | "left" | "right" = "down";
  private walkT = 0;
  private moving = false;
  private lastSafe = { x: 0, y: 0 };
  private warnedSolid = false;
  private hurtT = 0;
  showColl = false;
  noclip = false; // F5 (dev/editor only): free walk so you can inspect sealed rooms while tracing
  // --- ART V3 / objective pointer / creator ---
  private pointerOn = true;
  private stuckT = 0;
  private lastTrackedId = "";
  private hintShown = new Set<string>();
  private pagesActor: string | null = null;
  private journalSel = 0;
  private journalTop = 0;
  private artPanel = false;
  private artScroll = 0;
  private shadowPrev = { x: 0, y: 0 };
  private creating: { sel: number; editing: boolean; facing: "front" | "back" | "side"; draft: Appearance } | null = null;
  private createReturn: Mode = "world";
  private clickHud: ((e: PointerEvent) => void) | null = null;
  editorAllowed = false;
  private editor: FloorEditor | null = null;

  private hasSave = false;
  private choice: { lines: Line[]; idx: number; t: number; opts: { label: string; run: () => void }[]; sel: number } | null = null;
  private shopName = "MISOL'S EVERYTHING";
  private canvasEl: HTMLCanvasElement;
  private keyHud: (e: KeyboardEvent) => void;
  private visHud: () => void;

  private mode: Mode = "boot";
  private pages: Pages | null = null;
  private pageAfter: (() => void) | null = null;
  private battle: BattleState | null = null;
  private battleSprites: Record<string, HTMLCanvasElement> = {};
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
    const save = readSave<WorldSaveData>(SAVE_KEY);
    this.hasSave = !!save;
    this.regionId = save?.region ?? "verdant";
    this.flags = save ? { ...freshFlags(), ...save.flags } : freshFlags();
    // A pre-campaign save parked the player on the legacy prototype map — grid
    // walls, no quests, a den that only says 'quiet'. Re-file them at the real
    // beginning; the rest of the ledger (gold, titles, flags) stays intact.
    const vf = (this.flags as unknown as { visitedFloors?: Record<string, boolean> }).visitedFloors;
    if (!FLOOR_IDS_LIST.includes(this.regionId) || (this.regionId === "ashenveil" && !vf?.ashenveil && !this.flags.unregistered)) this.regionId = "verdant";
    this.floor = makeFloor(this.regionId);
    this.floor.art.ground = placeholderGround(this.floor);
    const parkedHere = !!save && save.region === this.regionId;
    this.px = parkedHere ? save!.x : this.floor.objects.spawn[0];
    this.py = parkedHere ? save!.y : this.floor.objects.spawn[1];
    if (!(this.px >= 0 && this.px <= this.floor.w && this.py >= 0 && this.py <= this.floor.h)) { this.px = this.floor.objects.spawn[0]; this.py = this.floor.objects.spawn[1]; }
    this.lastSafe = { x: this.px, y: this.py };
    if (save) this.toast = { text: WELCOME_BACK[0].text, t: 4.5 };
    this.centerCam();
    void loadFloorArt(this.floor);
    if (typeof document !== "undefined") this.buildSprites();
    // ART V3: manifest first; dev builds poll for hot-reloaded art. When any file
    // changes, every art cache in this class is rebuilt — no code edit needed.
    void Art.loadManifest().then(() => {
      this.buildSprites();
      void loadFloorArt(this.floor); // art that existed at boot is now wired — re-run the layer loader
    });
    if (this.isDevBuild()) {
      Art.startDevReload();
      (window as unknown as Record<string, unknown>).__art = Art; // console access in dev
    }
    Art.onChange(() => {
      this.buildSprites();
      invalidateDollCache();
      this.battleSprites = {};
      void loadFloorArt(this.floor);
    });
    this.editorAllowed = (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true)
      || (typeof location !== "undefined" && /[?&]editor=1/.test(location.search));
    this.keyHud = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void this.canvasEl.parentElement?.requestFullscreen?.().catch(() => {});
      }
      if (e.key === "F3") { this.showColl = !this.showColl; e.preventDefault(); return; }
      if (e.key === "F5") {
        e.preventDefault();
        if (!this.editorAllowed) { this.toastNow("[DEV] NOCLIP IS DEV-ONLY — run dev, or open with ?editor=1"); return; }
        this.noclip = !this.noclip;
        this.toastNow(this.noclip ? "[DEV] NOCLIP ON — walls let you pass (F5 off)" : "[DEV] NOCLIP OFF");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        if (!this.editorAllowed) { this.toastNow("[EDITOR] HIDDEN IN PRODUCTION — run dev, or open with ?editor=1"); return; }
        void import("./editor").then((m) => {
          if (this.editor) { this.editor.open = !this.editor.open; if (this.editor.open) this.editor.reloadDraftFor(this.regionId); }
          else { this.editor = new m.FloorEditor(this); this.editor.open = true; }
          Sfx.open();
        });
        return;
      }
      if (e.key === "t" || e.key === "T") { this.pointerOn = !this.pointerOn; this.toastNow(this.pointerOn ? "[POINTER] ON — the floor shows you the way" : "[POINTER] OFF (T brings it back)"); }
      if (e.key === "f4" || e.key === "F4") { e.preventDefault(); this.artPanel = !this.artPanel; this.artScroll = 0; }
      if (e.key === "j" || e.key === "J") {
        if (this.mode === "journal") this.mode = "world";
        else if (this.mode === "world" || this.mode === "talk") { this.journalSel = 0; this.mode = "journal"; Sfx.open(); }
      }
      if (e.key === "m" || e.key === "M") {
        if (this.mode === "world" && onRest(this.floor, this.px, this.py)) this.openCreator();
      }
      if (this.creating && this.creating.editing) this.creatorType(e);
    };
    window.addEventListener("keydown", this.keyHud);
    this.clickHud = (e: PointerEvent) => this.onPointer(e);
    canvas.addEventListener("pointerdown", this.clickHud);
    // pause on tab blur: dt is ALSO capped at 50 ms, so a returning tab never
    // teleports you through a wall.
    this.visHud = () => {
      this.paused = document.hidden;
      if (!this.paused) this.last = performance.now();
    };
    document.addEventListener("visibilitychange", this.visHud);
    this.input.attach();
    this.lastLevel = useGame.getState().level;
  }

  // ---------------- surface for the editor + harness ----------------
  get canvas() { return this.canvasEl; }
  toastNow(text: string) { this.toast = { text, t: 3.2 }; }
  warpPlayer(x: number, y: number) { this.px = x; this.py = y; this.lastSafe = { x, y }; this.centerCam(); }
  applyFloorObjects(o: FloorSave) {
    this.floor.objects = o;
    this.floor.w = o.chunks[0] * 960;
    this.floor.h = o.chunks[1] * 540;
    this.floor.art.ground = placeholderGround(this.floor) ?? this.floor.art.ground;
    void loadFloorArt(this.floor);
  }

  start() {
    if (this.started) return;
    this.started = true;
    const loop = (t: number) => {
      const dt = clamp((t - this.last) / 1000, 0.001, 0.05); // dt cap: no tunneling through walls on lag
      this.last = t;
      try { if (!this.paused) this.update(dt); this.render(); } finally { this.input.endFrame(); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame((t) => { this.last = t; loop(t); });
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.keyHud) window.removeEventListener("keydown", this.keyHud);
    if (this.visHud) document.removeEventListener("visibilitychange", this.visHud);
    this.input.detach();
    this.stopTrack();
    this.started = false;
  }
  centerCam() {
    const f = this.floor;
    this.cam.x = f.w > VIEW_W ? clamp(this.px - VIEW_W / 2, 0, f.w - VIEW_W) : (f.w - VIEW_W) / 2;
    this.cam.y = f.h > VIEW_H ? clamp(this.py - VIEW_H / 2, 0, f.h - VIEW_H) : (f.h - VIEW_H) / 2;
  }
  /** Land on a floor immediately (used by travel, the harness, and after respawn). */
  jumpToFloor(id: string, playMusic = true) {
    this.regionId = id;
    (this.flags as { visitedFloors?: Record<string, boolean> }).visitedFloors = (this.flags as unknown as { visitedFloors: Record<string, boolean> }).visitedFloors ?? {};
    (this.flags as unknown as { visitedFloors: Record<string, boolean> }).visitedFloors[id] = true;
    this.floor = makeFloor(id);
    this.floor.art.ground = placeholderGround(this.floor);
    const sp = this.floor.objects.spawn;
    this.px = sp[0]; this.py = sp[1];
    this.lastSafe = { x: this.px, y: this.py };
    this.flags.floorHp = 0;
    this.warnedSolid = false;
    this.centerCam();
    void loadFloorArt(this.floor);
    this.mode = "world";
    this.encCooldown = 6; this.steps = 0; // arrive in peace, not mid-ambush
    this.editor?.reloadDraftFor(id);
    if (playMusic) this.playTrack(this.floor.music);
  }
  private isDevBuild() {
    return (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true)
      || (typeof location !== "undefined" && /[?&](editor|artdev)=1/.test(location.search));
  }
  /** Music: a manifest file (music:<track>) wins over the procedural chiptune. */
  private playTrack(track: "town" | "battle" | "boss" | "final" | "marsh" | "cave") {
    if (isMuted() || ArtMusic.tryPlay(track)) return;
    Sfx.playMusic(track);
  }
  private stopTrack() { ArtMusic.stop(); Sfx.stopMusic(); }
  /** for touch buttons in the React shell */
  virtual(k: Parameters<Input["press"]>[0], down: boolean) { this.input.press(k, down); }
  toggleJournal() { if (this.mode === 'journal') { this.mode = 'world'; Sfx.cancel(); } else if (this.mode === 'world' || this.mode === 'talk') { this.journalSel = 0; this.mode = 'journal'; Sfx.open(); } }
  toggleMute() {
    setMuted(!isMuted());
    if (isMuted()) this.stopTrack();
    else if (this.mode === "battle" && this.battle) this.playTrack(this.battle.enemy.boss ? "boss" : "battle");
    else this.playTrack(this.floor.music);
  }

  private buildSprites() {
    const S = this.sprites;
    S.pDown = [outlineSprite(A.hunterDown(0)), outlineSprite(A.hunterDown(1))];
    S.pUp = [outlineSprite(A.hunterUp(0)), outlineSprite(A.hunterUp(1))];
    S.pLeft = [outlineSprite(A.hunterSide(0)), outlineSprite(A.hunterSide(1))];
    S.pRight = [outlineSprite(A.hunterSide(0, true)), outlineSprite(A.hunterSide(1, true))];
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

  // ---------------- world: movement, collision, hazards, travel ----------------
  private updateWorld(dt: number) {
    if (this.editor?.open) { this.editor.update(dt); return; }
    // stuck help: a tracked objective that has not advanced in 10 minutes gets ONE extra hint
    const node = this.trackedNode();
    const nid = node ? node.id + node.title : "";
    if (nid !== this.lastTrackedId) { this.lastTrackedId = nid; this.stuckT = 0; }
    if (node) {
      const t = resolveTarget(node, this.floor, this.flags);
      if (t && Math.hypot(t.x - this.px, t.y - this.py) < 100) this.stuckT = 0; // arrived: the clock resets
      else this.stuckT += dt;
      if (this.stuckT > 600 && !this.hintShown.has(nid)) { this.hintShown.add(nid); this.toastNow("[STUCK?] " + node.hint); }
    }
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
      const sp = dash ? 302 : 168; // world units/s (view = 960 wide; the old feel was 56/320 px at zoom 2)
      const flags = this.flags as unknown as Record<string, boolean>;
      if (this.noclip) {
        this.px = clamp(this.px + vx * sp * dt * 1.7, 0, this.floor.w);
        this.py = clamp(this.py + vy * sp * dt * 1.7, 0, this.floor.h);
      } else {
        const m = stepMove(this.floor, this.px, this.py, vx * sp * dt, vy * sp * dt, flags);
        this.px = m.x; this.py = m.y;
      }
      // SAFETY NET: if the ground turns solid under you (late collision.png
      // load, an editor paint stroke), snap to the last valid spot and warn ONCE.
      if (!this.noclip && posBlocked(this.floor, this.px, this.py, flags)) {
        this.px = this.lastSafe.x; this.py = this.lastSafe.y;
        if (!this.warnedSolid) {
          this.warnedSolid = true;
          console.warn("[ashenveil] player entered a solid cell — snapped to last valid position (mask changed underfoot?)");
        }
      } else { this.lastSafe.x = this.px; this.lastSafe.y = this.py; }
      this.walkT += dt * (dash ? 11 : 7.2);
      this.steps += sp * dt * (dash ? 0.35 : 1); // dashing hides you from the grass
      if (Math.floor(prevStep) !== Math.floor(this.walkT)) Sfx.move();
      this.encounterTick();
    } else this.walkT = 0;
    this.encCooldown = Math.max(0, this.encCooldown - dt);

    // hazard burn / regen (red mask cells); feet HP is the floor's tax
    const pool = this.floorPool();
    if (this.flags.floorHp <= 0) this.flags.floorHp = pool;
    this.flags.floorHp = Math.min(this.flags.floorHp, pool);
    if (atHazard(this.floor, this.px, this.py)) {
      this.flags.floorHp = Math.max(0.001, this.flags.floorHp - pool * 0.06 * dt); // ~17 s of lava is fatal
      this.hurtT -= dt;
      if (this.hurtT <= 0) { this.hurtT = 0.5; Sfx.hurt(); }
      if (this.flags.floorHp <= pool * 0.02) this.toGameOver();
    } else if (this.flags.floorHp < pool) this.flags.floorHp = Math.min(pool, this.flags.floorHp + pool * 0.035 * dt);

    // camera: follow + clamp; small floors sit CENTRED (negative cam = margin)
    const f = this.floor;
    const tx = f.w > VIEW_W ? clamp(this.px - VIEW_W / 2, 0, f.w - VIEW_W) : (f.w - VIEW_W) / 2;
    const ty = f.h > VIEW_H ? clamp(this.py - VIEW_H / 2, 0, f.h - VIEW_H) : (f.h - VIEW_H) / 2;
    this.cam.x = lerp(this.cam.x, tx, clamp(dt * 6, 0, 1));
    this.cam.y = lerp(this.cam.y, ty, clamp(dt * 6, 0, 1));

    if (this.input.pressed("cancel")) { this.mode = "status"; Sfx.open(); return; }
    if (this.input.pressed("confirm")) this.interact();
  }
  private floorPool(): number {
    const s = useGame.getState();
    return campaignStats(s.level, s.str, s.agi, s.vit, s.fatigueLevel).maxHP;
  }

  private encounterTick() {
    if (this.encCooldown > 0) return;
    const z = inZone(this.floor, this.px, this.py);
    if (!z) return;
    const cleared = this.regionId === "ashenveil"
      ? (z.id === "pines" && this.flags.killsPines >= 7) || (z.id === "ridge" && this.flags.killsRidge >= 7)
      : !!(this.floor.objects.boss && this.flags.bossDown[this.floor.objects.boss.id]);
    if (cleared) return;
    if (this.steps > 2100 + Math.random() * 2600) { // ~14-30 s of walking; dashing halves your footprint (dash = safety)
      this.steps = 0;
      const id = z.enemies[Math.floor(Math.random() * z.enemies.length)];
      Sfx.encounter();
      const lvl = useGame.getState().level;
      this.beginBattle(id, spawnLevelFor(lvl, Math.random), false);
    }
  }

  private nearestInteract(): { kind: "npc" | "sign" | "prop"; key: string } | null {
    const fx = this.px + (this.dir === "left" ? -24 : this.dir === "right" ? 24 : 0);
    const fy = this.py + (this.dir === "up" ? -18 : this.dir === "down" ? 20 : 0);
    let best: { d: number; r: { kind: "npc" | "sign" | "prop"; key: string } } | null = null;
    const consider = (x: number, y: number, kind: "npc" | "sign" | "prop", key: string) => {
      const d = Math.hypot(fx - x, fy - y);
      if (d < 34 && (!best || d < best.d)) best = { d, r: { kind, key } };
    };
    for (const n of this.floor.objects.npcs) {
      if (n.hideAfter && this.hideFlag(n.hideAfter)) continue;
      consider(n.x, n.y - 8, "npc", n.dialogue);
    }
    const bo = this.floor.objects.boss;
    if (bo && !this.flags.bossDown[bo.id]) consider(bo.x + bo.w / 2, bo.y + bo.h / 2, "prop", "boss");
    this.floor.objects.exits.forEach((e, i) => consider(e.x + e.w / 2, e.y + e.h / 2, "prop", `exit${i}`));
    for (const r of this.floor.objects.rests) consider(r.x + r.w / 2, r.y + r.h / 2, "prop", "rest");
    for (const s of this.floor.objects.signs) consider(s.x, s.y - 8, "sign", s.text);
    for (const p of this.floor.objects.props) if (p.interactId) consider(p.x + p.w / 2, p.y + p.h - 12, "prop", p.interactId);
    return best ? (best as unknown as { r: { kind: "npc" | "sign" | "prop"; key: string } }).r : null;
  }

  private interact() {
    const hit = this.nearestInteract();
    if (!hit) return;
    if (hit.kind === "prop" && hit.key === "save") { this.saveGame(); return; }
    if (hit.kind === "prop" && hit.key === "bossGate") { this.startBoss(); return; }
    if (hit.kind === "prop" && hit.key === "boss") { this.startRegionBoss(); return; }
    if (hit.kind === "prop" && hit.key === "gate") { this.tryGate(); return; }
    if (hit.kind === "prop" && hit.key === "rest") {
      this.flags.floorHp = this.floorPool();
      Sfx.heal();
      this.pagesActor = null;
      this.pages = { lines: [{ text: "You sit down on the flat stone that is definitely furniture. The burn leaves your feet first, then the noise, then — eventually — the part of you that counts steps. [J] journal · [M] the camp mirror keeps your reflection until you look" }], idx: 0, t: 0 };
      this.mode = "talk";
      return;
    }
    if (hit.kind === "prop" && hit.key === "den") {
      if (!(this.flags.killsTotal >= 14) || this.flags.bossDown["alpha"]) {
        this.pages = { lines: [{ who: "SYSTEM", text: `THE DEN IS NOT OPEN: it wakes at 14 settled names across the floors — the ledger says ${this.flags.killsTotal ?? 0}. Kills, spares and claims all count.` }, { text: "The den is quiet. Whatever lives in den-logic has not decided you are an audience yet. The journal [J] keeps the tally; the pointer will show the zones worth walking through." }], idx: 0, t: 0 };
        this.mode = "talk"; return;
      }
      const lvA = useGame.getState().level;
      const decA = bossGateDecision({ playerLevel: lvA, recLevel: 24, hubSeen: (this.flags.met["seo.verdant"] ?? 0) > 0 });
      if (decA === "block") {
        this.choice = {
          lines: bossGateLines("THE ALPHA", 24, lvA, "block"), idx: 0, t: 0, sel: 0,
          opts: [
            { label: "BACK OUT — TRAIN FIRST", run: () => this.toastNow("[SYSTEM] The den notes your prudence and files it.") },
            { label: `FIGHT IT ANYWAY — LV ${lvA} VS LV 24`, run: () => this.proceedDenAlpha() },
          ],
        };
        this.mode = "choice"; Sfx.open(); return;
      }
      if (decA === "warn") {
        this.choice = {
          lines: bossGateLines("THE ALPHA", 24, lvA, "warn"), idx: 0, t: 0, sel: 1,
          opts: [
            { label: `FIGHT IT ANYWAY — LV ${lvA} VS LV 24`, run: () => this.proceedDenAlpha() },
            { label: "BACK OUT; TRAIN FIRST", run: () => this.toastNow("[SYSTEM] The den exhales. Noted: not today.") },
          ],
        };
        this.mode = "choice"; Sfx.open(); return;
      }
      this.proceedDenAlpha(); return;
    }
    if (hit.kind === "prop" && hit.key.startsWith("exit")) { this.tryExit(Number(hit.key.slice(4))); return; }
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
      const who = this.floor.objects.npcs.find((n) => n.dialogue === hit.key);
      this.pagesActor = who ? who.id : hit.key.split(".")[0];
      this.pages = { lines: tree, idx: 0, t: 0 };
      this.pageAfter = () => this.afterTalk(hit.key);
      this.mode = "talk"; Sfx.open();
    } else {
      this.pagesActor = null;
      this.pages = { lines: signAll(hit.key, this.flags), idx: 0, t: 0 };
      this.mode = "talk"; Sfx.open();
    }
  }
  private tryExit(i: number) {
    const ex = this.floor.objects.exits[i];
    if (!ex) return;
    const bo = this.floor.objects.boss;
    const bossLocked = !!(bo && !this.flags.bossDown[bo.id]);
    const needFlag = !!ex.requires && !this.flags[ex.requires as keyof WorldFlags];
    if (bossLocked || needFlag) {
      const why = needFlag && !bo ? "the door itself has opinions"
        : `the resident above (${bo?.name ?? "it"}, LV ${bo?.level ?? "?"}) has not been settled — you are LV ${useGame.getState().level}. RATING SAFETY, the dungeon calls it`;
      this.pages = { lines: [{ text: `The way to the ${ex.label} is bricked up. The dungeon files it as 'for your safety.' Between you and the bricks: ${why}.` }], idx: 0, t: 0 };
      this.mode = "talk"; return;
    }
    this.transDir = 1;
    const to = ex.to;
    this.pendingMode = () => {
      this.jumpToFloor(to, false);
      this.pagesActor = null;
      const lines = regionArrive(to, this.flags);
      if (lines.length) { this.pages = { lines, idx: 0, t: 0 }; this.mode = "talk"; }
      this.playTrack(this.floor.music);
    };
  }
  private startRegionBoss() {
    const bo = this.floor.objects.boss;
    if (!bo) return;
    const lv = useGame.getState().level;
    const hubSeen = (this.flags.met["seo.verdant"] ?? 0) > 0;
    const decision = bossGateDecision({ playerLevel: lv, recLevel: bo.level, hubSeen });
    if (decision === "block") {
      // The hard gate is an exam, not a wall: full explanation first, then a real
      // decision with BACK OUT pre-selected. A challenge never ends in "nothing".
      Sfx.open();
      this.choice = {
        lines: bossGateLines(bo.name.toUpperCase(), bo.level, lv, "block"), idx: 0, t: 0, sel: 0,
        opts: [
          { label: "BACK OUT — TRAIN FIRST", run: () => this.toastNow("[SYSTEM] Filed under: PRUDENT. The ledger respects it.") },
          { label: `SIGN IT ANYWAY — LV ${lv} VS LV ${bo.level}`, run: () => this.proceedBoss(bo.id, bo.level) },
        ],
      };
      this.mode = "choice";
      return;
    }
    if (decision === "warn") {
      Sfx.open();
      this.choice = {
        lines: bossGateLines(bo.name.toUpperCase(), bo.level, lv, "warn"), idx: 0, t: 0, sel: 1,
        opts: [
          { label: `SIGN IT ANYWAY — LV ${lv} VS LV ${bo.level}`, run: () => this.proceedBoss(bo.id, bo.level) },
          { label: "BACK OUT; TRAIN FIRST", run: () => this.toastNow("[SYSTEM] Filed under: PRUDENT. The ledger respects it.") },
        ],
      };
      this.mode = "choice";
      return;
    }
    this.proceedBoss(bo.id, bo.level);
  }
  private proceedDenAlpha() {
    Sfx.bossIntro();
    this.pagesActor = "alpha";
    this.pages = { lines: bossGateScript("alpha", this.flags), idx: 0, t: 0, after: () => this.beginBattle("alpha", 24, true) };
    this.mode = "talk";
  }
  private proceedBoss(id: string, level: number) {
    Sfx.bossIntro();
    this.pagesActor = id;
    this.pages = { lines: bossGateScript(id, this.flags), idx: 0, t: 0, after: () => this.beginBattle(id, level, true) };
    this.mode = "talk";
  }
  private tryGate() {
    if (this.flags.gateOpen) {
      this.pages = { lines: [{ text: "The gate stands open. Beyond it: the ridge, the dead trees, and the smell of old snow that never got swept." }], idx: 0, t: 0 };
    } else if (this.flags.hasKey) {
      this.flags.gateOpen = true; // the prop's collider dissolves with the flag — no grid rebuild anywhere
      Sfx.gate();
      this.pages = { lines: [{ text: "The Ridge Key turns like it was oiled yesterday. The portcullis climbs — and the ridge beyond does NOT approve." }], idx: 0, t: 0 };
    } else {
      this.pages = { lines: gateHint(), idx: 0, t: 0 };
    }
    this.mode = "talk"; Sfx.open();
  }
  private respawn() {
    // death softens only the walk, never the ledger: flags, kills, gold, map — all stay.
    const sp = this.floor.objects.spawn;
    this.warpPlayer(sp[0], sp[1]);
    this.flags.floorHp = 0; // refilled on the next frame
    this.battle = null;
    this.mode = "world";
    this.encCooldown = 10; this.steps = 0; // the floor that killed you waits a full ten seconds before it tries again
    this.playTrack(this.floor.music);
    this.pages = { lines: [{ text: "You wake at the way in. The floor carries people back the way a river carries leaves — without ceremony, and without ever quite meaning to." }], idx: 0, t: 0 };
    this.mode = "talk";
  }

  // ---------------- render: the world ----------------
  private renderWorld(g: CanvasRenderingContext2D) {
    const f = this.floor;
    const ox = Math.round(-this.cam.x), oy = Math.round(-this.cam.y);
    g.save();
    if (this.flags.genDone && this.regionId === "ashenveil") g.filter = "grayscale(0.92) brightness(0.72)";
    if (f.art.ground) g.drawImage(f.art.ground as CanvasImageSource, ox, oy, f.w, f.h); // art px → units is 2:1; NEVER upscaled past 1:1
    else { g.fillStyle = "#0a0e18"; g.fillRect(ox, oy, f.w, f.h); }
    g.filter = "none";
    for (const r of f.objects.rests) { // rest pads glow beneath everything
      const t = performance.now() / 1400;
      g.globalAlpha = 0.14 + Math.sin(t) * 0.05; g.fillStyle = "#7fe7a4";
      g.beginPath(); g.ellipse(ox + r.x + r.w / 2, oy + r.y + r.h / 2, r.w * 0.6, r.h * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    for (const e of f.objects.exits) { // exits: green glow open, bricks when locked
      const bo = f.objects.boss;
      const locked = (bo && !this.flags.bossDown[bo.id]) || (!!e.requires && !this.flags[e.requires as keyof WorldFlags]);
      if (!locked) {
        const t = performance.now() / 800;
        g.globalAlpha = 0.35 + Math.sin(t) * 0.15; g.fillStyle = "#8fffd8";
        g.beginPath(); g.ellipse(ox + e.x + e.w / 2, oy + e.y + e.h / 2, e.w * 0.45, e.h * 0.8, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      try { g.drawImage(A.getProp("arch"), ox + e.x + e.w / 2 - 24, oy + e.y - 8, 48, 40); } catch { /* art missing in harness */ }
      if (locked) { g.fillStyle = "rgba(40,46,60,0.94)"; g.fillRect(ox + e.x, oy + e.y, e.w, e.h * 0.8); g.fillStyle = "#5b6a80"; g.fillRect(ox + e.x, oy + e.y, e.w, 5); }
    }
    const drawList: { y: number; f: () => void }[] = [];
    for (const p of f.objects.props) {
      if (p.sprite === "water") {
        const tileKey = this.regionId === "ashenveil" ? "ice" : "pool";
        for (let ty = 0; ty < Math.ceil(p.h / 32); ty++) for (let tx = 0; tx < Math.ceil(p.w / 32); tx++) {
          try { g.drawImage(A.getProp(tileKey), ox + p.x + tx * 32, oy + p.y + ty * 32, 32, 32); } catch { /* harness */ }
        }
        continue;
      }
      const key = p.sprite === "gate" ? (this.flags.gateOpen ? "gateOpen" : "gateClosed") : p.sprite;
      drawList.push({ y: p.y + p.h, f: () => {
        if (this.flags.genDone && (key === "inn" || key === "house" || key === "stall" || key === "stall2")) g.globalAlpha = 0.8;
        const src = Art.isReal(propKey(key)) ? Art.art(propKey(key), key, "prop") : A.getProp(key);
        try { g.drawImage(src as CanvasImageSource, ox + p.x, oy + p.y, p.w, p.h); } catch { /* unknown key */ }
        g.globalAlpha = 1;
      } });
    }
    if (this.flags.genDone) for (const n of f.objects.npcs) { // the town is only ash after the ending
      if (n.hideAfter && this.flags[n.hideAfter as keyof WorldFlags]) continue;
      drawList.push({ y: n.y + 12, f: () => { try { g.drawImage(A.getProp("ash"), ox + n.x - 10, oy + n.y - 4, 20, 14); } catch { /* harness */ } } });
    }
    if (!this.flags.genDone) for (const n of f.objects.npcs) {
      if (n.hideAfter && this.hideFlag(n.hideAfter)) continue;
      const bob = Math.floor(performance.now() / 460) % 2;
      drawList.push({ y: n.y + 14, f: () => {
        // V3: one art key per actor id — actors never share the player's sprite,
        // and missing files render as their own labelled card, not a lookalike.
        const facing = n.facing === "up" ? "back" : n.facing === "left" || n.facing === "right" ? "side" : "front";
        const src = Art.art(actorKey(n.id, facing), displayName(n.id), "actor");
        const H = 48, W = H * (src.width / Math.max(1, src.height));
        const flip = n.facing === "left";
        g.save();
        g.translate(ox + n.x, oy + n.y - 10 + bob);
        if (flip) g.scale(-1, 1);
        g.drawImage(src as CanvasImageSource, -W / 2, -H, W, H);
        g.restore();
      } });
    }
    { // the doll composite (creator's look) — overworld use; mirrors side→left
      const ap = useGame.getState().appearance ?? defaultAppearance(useGame.getState().name);
      const facing = this.dir === "up" ? "back" : this.dir === "left" || this.dir === "right" ? "side" : "front";
      const fr = dollFor(ap, facing);
      const bobY = this.moving ? Math.floor(this.walkT) % 2 : 0;
      drawList.push({ y: this.py + 10, f: () => {
        // ground shadow LAGS the sprite by one frame (a story clue — it is not yours)
        g.globalAlpha = 0.35; g.fillStyle = "#05070d";
        g.beginPath(); g.ellipse(ox + this.shadowPrev.x, oy + this.shadowPrev.y - 2, 12, 5, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        const H = 52, W = H * (fr.width / Math.max(1, fr.height));
        g.save();
        g.translate(ox + this.px, oy + this.py - 2 + bobY);
        if (this.dir === "left") g.scale(-1, 1);
        g.drawImage(fr, -W / 2, -H, W, H);
        g.restore();
        this.shadowPrev.x = this.px; this.shadowPrev.y = this.py;
      } });
    }
    drawList.sort((a, b) => a.y - b.y); // painter's order by feet: you walk BEHIND tree tops via overlay.png, in front of trunks
    for (const d of drawList) d.f();
    for (const s of f.objects.signs) { try { g.drawImage(A.getProp("sign"), ox + s.x - 11, oy + s.y - 18, 22, 18); } catch { /* harness */ } }
    const bo = f.objects.boss;
    if (bo && !this.flags.bossDown[bo.id]) {
      const t = performance.now() / 620;
      g.globalAlpha = 0.30 + Math.sin(t) * 0.16; g.fillStyle = "#ff5566";
      g.beginPath(); g.ellipse(ox + bo.x + bo.w / 2, oy + bo.y + bo.h / 2, 22, 12, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      if (Math.floor(t * 2) % 2 === 0) drawText(g, bo.name, ox + bo.x + bo.w / 2, oy + bo.y - 16, 11, "#ff9aa6", "center");
    }
    if (f.art.overlay) g.drawImage(f.art.overlay as CanvasImageSource, ox, oy, f.w, f.h); // ABOVE the player: tree/arch/wall tops
    if (f.tint === "cave") {
      const gr = g.createRadialGradient(this.px - this.cam.x, this.py - this.cam.y, 110, this.px - this.cam.x, this.py - this.cam.y, 340);
      gr.addColorStop(0, "rgba(4,3,8,0)"); gr.addColorStop(1, "rgba(4,3,8,0.82)");
      g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (f.tint === "hall") { g.fillStyle = "rgba(30,24,8,0.16)"; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    else if (f.tint === "water") { g.fillStyle = "rgba(8,20,24,0.14)"; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    else { g.fillStyle = this.regionId === "ashenveil" ? "rgba(8,12,24,0.16)" : "rgba(10,14,26,0.10)"; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    const pool = this.floorPool();
    if (this.flags.floorHp < pool - 0.5) {
      const frac = clamp(this.flags.floorHp / pool, 0, 1);
      drawText(g, "FEET", 14, VIEW_H - 34, 9, "#6d80a8");
      g.fillStyle = "#1d2430"; g.fillRect(52, VIEW_H - 32, 120, 8);
      g.fillStyle = frac > 0.5 ? "#7fff9e" : frac > 0.25 ? "#ffd88a" : "#ff5566";
      g.fillRect(52, VIEW_H - 32, 120 * frac, 8);
    }
    if (this.showColl) this.renderCollOverlay(g, ox, oy);
    g.restore();
    this.renderMinimap(g);
  }
  private renderCollOverlay(g: CanvasRenderingContext2D, ox: number, oy: number) {
    const m = this.floor.mask;
    const c0 = Math.max(0, Math.floor(-ox / m.cell)), c1 = Math.min(m.cw, Math.ceil((-ox + VIEW_W) / m.cell));
    const r0 = Math.max(0, Math.floor(-oy / m.cell)), r1 = Math.min(m.ch, Math.ceil((-oy + VIEW_H) / m.cell));
    for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) {
      const v = m.cells[y * m.cw + x];
      if (v === 0) continue;
      g.fillStyle = v === 1 ? "rgba(255,64,64,0.28)" : v === 2 ? "rgba(64,120,255,0.35)" : v === 3 ? "rgba(255,150,40,0.38)" : "rgba(64,255,120,0.32)";
      g.fillRect(ox + x * m.cell, oy + y * m.cell, m.cell + 0.5, m.cell + 0.5);
    }
    g.lineWidth = 1.5;
    g.strokeStyle = "rgba(255,255,120,0.75)";
    for (const p of this.floor.objects.props) if (p.solid) {
      if (p.solid === "ellipse") { g.beginPath(); g.ellipse(ox + p.x + p.w / 2, oy + p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); g.stroke(); }
      else g.strokeRect(ox + p.x, oy + p.y, p.w, p.h);
    }
    g.strokeStyle = "rgba(140,255,190,0.9)";
    for (const e of this.floor.objects.exits) g.strokeRect(ox + e.x, oy + e.y, e.w, e.h);
    g.strokeStyle = "rgba(255,120,140,0.9)";
    const bob = this.floor.objects.boss;
    if (bob) g.strokeRect(ox + bob.x, oy + bob.y, bob.w, bob.h);
    g.strokeStyle = "rgba(127,231,255,0.4)";
    for (const z of this.floor.objects.zones) g.strokeRect(ox + z.x, oy + z.y, z.w, z.h);
    g.fillStyle = "#ffffff";
    const sp = this.floor.objects.spawn;
    g.fillRect(ox + sp[0] - 2, oy + sp[1] - 2, 4, 4);
    g.fillRect(ox + this.px - 2, oy + this.py - 2, 4, 4);
    g.font = "10px monospace";
    g.fillStyle = "#9fd8ff";
    g.fillText(`mask ${m.cw}\u00d7${m.ch} @ ${m.cell.toFixed(1)}u/cell`, 12, 12);
  }
  private mmCache: { id: string; t: number; cv: HTMLCanvasElement } | null = null;
  private renderMinimap(g: CanvasRenderingContext2D) {
    const f = this.floor, m = f.mask;
    const S = 90;
    const x = VIEW_W - S - 10, y = 10;
    const hh = S * (f.h / f.w);
    const px = (wx: number) => x + (wx / f.w) * S, py = (wy: number) => y + (wy / f.h) * hh;
    g.fillStyle = "rgba(5,8,16,0.82)"; g.fillRect(x, y, S, hh);
    // Class-readable ground, cached ~1.2 s (cheap to rebuild so editor paint shows up fast).
    const now = performance.now();
    if (!this.mmCache || this.mmCache.id !== f.id || now - this.mmCache.t > 1200) {
      const c = document.createElement("canvas");
      c.width = m.cw; c.height = m.ch;
      const cg = c.getContext("2d")!;
      const img = cg.createImageData(c.width, c.height);
      const PAL: [number, number, number, number][] = [
        [208, 218, 234, 128], // walkable — pale open ground
        [12, 16, 26, 236],    // solid — near-black rock
        [63, 120, 255, 214], // water — blue
        [255, 90, 74, 214],   // hazard — red
        [63, 210, 127, 235],  // exit pads — green
      ];
      for (let i = 0; i < m.cells.length; i++) {
        const [r, gg, b, a] = PAL[m.cells[i]] ?? PAL[1];
        img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
      }
      cg.putImageData(img, 0, 0);
      this.mmCache = { id: f.id, t: now, cv: c };
    }
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mmCache.cv as never, x, y, S, hh);
    g.restore();
    for (const zn of f.objects.zones) { g.fillStyle = "rgba(255,90,90,0.14)"; g.fillRect(px(zn.x), py(zn.y), (zn.w / f.w) * S, (zn.h / f.h) * hh); }
    const bob = f.objects.boss;
    if (bob) { g.fillStyle = "#ff5566"; g.fillRect(px(bob.x + bob.w / 2) - 1.5, py(bob.y + bob.h / 2) - 1.5, 3, 3); }
    g.fillStyle = "#7fff9e";
    for (const e of f.objects.exits) g.fillRect(px(e.x + e.w / 2) - 1.5, py(e.y + e.h / 2) - 1.5, 3.5, 3.5);
    const tn = this.trackedNode();
    const tgt = tn ? resolveTarget(tn, f, this.flags) : null;
    if (tgt && !tgt.sealed) { // tracked objective: a diamond, echoing the in-world pointer
      g.save(); g.translate(px(tgt.x), py(tgt.y)); g.rotate(Math.PI / 4);
      g.fillStyle = "rgba(6,10,18,0.85)"; g.fillRect(-3.2, -3.2, 6.4, 6.4);
      g.fillStyle = "#7fe7ff"; g.fillRect(-2.2, -2.2, 4.4, 4.4);
      g.restore();
    }
    g.fillStyle = "rgba(8,12,20,0.9)"; g.fillRect(px(this.px) - 2.6, py(this.py) - 2.6, 5.2, 5.2);
    g.fillStyle = "#ffffff"; g.fillRect(px(this.px) - 1.5, py(this.py) - 1.5, 3, 3);
    g.strokeStyle = "#3f5f86"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, S - 1, hh - 1);
    drawText(g, f.name, VIEW_W - 10, y + hh + 12, 10, "#7fa0c8", "right");
    // the permanent answer to "how do I get stronger": level, progress, and where SP goes
    const gs = useGame.getState();
    const boG = f.objects.boss;
    const grow = boG && !this.flags.bossDown[boG.id]
      ? `LV ${gs.level} · XP ${gs.xp}/${gs.xpMax} · SP ${gs.sp} [X] · BOSS REC LV ${boG.level}`
      : `LV ${gs.level} · XP ${gs.xp}/${gs.xpMax} · SP ${gs.sp} [X]`;
    drawText(g, grow, VIEW_W - 10, y + hh + 26, 9, gs.sp > 0 ? "#ffd88a" : "#5d7396", "right");
  }
  private renderPrompt(g: CanvasRenderingContext2D) {
    const hit = this.nearestInteract();
    if (!hit) return;
    let label = "TALK";
    if (hit.kind === "sign") label = "READ";
    if (hit.key === "save") label = "SAVE";
    if (hit.key === "bossGate") label = `ENTER — GATE DUELIST · REC LV ${this.flags.killsPines >= 7 && this.flags.killsRidge >= 7 ? 24 : 8}`;
    if (hit.key === "shop.sila") label = "TRADE";
    if (hit.key === "boss") {
      const bo0 = this.floor.objects.boss;
      label = bo0 ? `CHALLENGE — ${bo0.name.toUpperCase()} · REC LV ${bo0.level} · YOU LV ${useGame.getState().level}` : "CHALLENGE";
    }
    if (hit.key === "rest") label = "REST";
    if (hit.key.startsWith("exit")) {
      const e = this.floor.objects.exits[Number(hit.key.slice(4))];
      const bo = this.floor.objects.boss;
      const locked = !!(bo && !this.flags.bossDown[bo.id]) || !!(e?.requires && !this.flags[e.requires as keyof WorldFlags]);
      label = locked ? (bo ? `BOSS FIRST — ${bo.name.toUpperCase()} · REC LV ${bo.level}` : "SEALED — CHECK THE JOURNAL [J]") : `TRAVEL: ${e?.label ?? ""}`;
    }
    if (Math.floor(performance.now() / 320) % 2 === 0) drawText(g, `[Z] ${label}`, VIEW_W / 2, VIEW_H - 158, 13, "#ffd88a", "center");
  }

  // ---------------- dialogue: wrap + paginate, max 3 lines, fixed panel ----------------
  private pageData(cur: Line) {
    const text = cur.text ?? "";
    const lines = this.wrap(text, 14, VIEW_W - 300);
    const starts: number[] = [];
    let acc = 0;
    for (const l of lines) { starts.push(acc); acc += l.length + 1; }
    const pages: { from: number; to: number }[] = [];
    const n = Math.max(1, lines.length);
    for (let i = 0; i < n; i += 3) {
      const from = starts[i] ?? 0;
      const to = i + 3 >= n ? text.length : starts[i + 3];
      pages.push({ from, to: Math.max(from + 1, to) });
    }
    return { pages };
  }
  private updatePages(dt: number, onDone: () => void) {
    const p = this.pages;
    if (!p) { onDone(); return; }
    const cur = p.lines[p.idx];
    if (!cur) { this.pages = null; onDone(); return; }
    const { pages } = this.pageData(cur);
    const pg = clamp(p.pg ?? 0, 0, pages.length - 1);
    const pd = pages[pg];
    const pageLen = Math.max(1, pd.to - pd.from);
    if (p.t * TYPE_RATE < pageLen) {
      const was = Math.floor(p.t * TYPE_RATE);
      p.t += dt;
      const now = Math.floor(p.t * TYPE_RATE);
      if (now > was && now % 4 === 0) Sfx.text();
    } else {
      p.t += dt;
      // narration settles on its own; choices and dialogue wait for you
      if (p.t * TYPE_RATE > pageLen + 30) {
        if (pg < pages.length - 1) { p.pg = pg + 1; p.t = 0; }
        else { p.pg = 0; p.idx++; p.t = 0; if (p.idx >= p.lines.length) { const a = p.after; this.pages = null; onDone(); a?.(); } }
      }
    }
    if (this.input.pressed("confirm")) {
      if (p.t * TYPE_RATE < pageLen) p.t = pageLen / TYPE_RATE + 0.001; // reveal this page at once
      else if (pg < pages.length - 1) { p.pg = pg + 1; p.t = 0; Sfx.select(); }
      else {
        p.pg = 0; p.idx++; p.t = 0;
        if (p.idx >= p.lines.length) { const a = p.after; this.pages = null; Sfx.select(); onDone(); a?.(); }
      }
    }
  }
  private renderPages(g: CanvasRenderingContext2D) {
    const p = this.pages;
    if (!p) return;
    const cur = p.lines[p.idx];
    if (!cur) return;
    const { pages } = this.pageData(cur);
    const pg = clamp(p.pg ?? 0, 0, pages.length - 1);
    const pd = pages[pg];
    const pageText = (cur.text ?? "").slice(pd.from, pd.to);
    const shown = Math.floor(p.t * TYPE_RATE);
    this.box(g, 48, VIEW_H - 150, VIEW_W - 96, 132); // the panel is fixed; the page can never clip
    const tx0 = 68;
    if (this.pagesActor) {
      const mood = shown < pageText.length ? "talk" : "neutral";
      const pt = Art.art(portraitKey(this.pagesActor, mood), displayName(this.pagesActor), "portrait");
      const PH2 = 112, PW2 = PH2 * (pt.width / Math.max(1, pt.height));
      g.drawImage(pt as CanvasImageSource, 58, VIEW_H - 142, PW2, PH2);
    }
    if (cur.who) drawText(g, subTokens(cur.who, useGame.getState().appearance), tx0 + (this.pagesActor ? 122 : 0), VIEW_H - 138, 13, "#ffd88a");
    const vis = this.wrap(subTokens(pageText.slice(0, Math.max(0, shown)), useGame.getState().appearance), 14, VIEW_W - 300 - (this.pagesActor ? 122 : 0)).slice(0, 3);
    vis.forEach((l, i) => drawText(g, l, tx0 + (this.pagesActor ? 122 : 0), VIEW_H - 114 + i * 21, 14, "#ffffff"));
    if (shown >= pageText.length && Math.floor(performance.now() / 300) % 2 === 0) {
      const arrow = pg < pages.length - 1 ? `\u25BC Z (${pg + 1}/${pages.length})` : "\u25BC Z";
      drawText(g, arrow, VIEW_W - 68, VIEW_H - 40, 12, "#ffffff", "right");
    }
  }
  private renderStatus(g: CanvasRenderingContext2D) {
    const s = useGame.getState();
    const combat = campaignStats(s.level, s.str, s.agi, s.vit, s.fatigueLevel);
    const f = this.floor;
    const pool = this.floorPool();
    this.box(g, 140, 54, 680, 434);
    drawText(g, "STATUS \u2014 REAL-WORLD LINK", 160, 70, 16, "#ffd88a");
    const rows: [string, string][] = [
      ["NAME", (s.name || "GUEST").toUpperCase()],
      ["LV (earned at 5 AM)", String(s.level)],
      ["battle HP / ATK / DEF", `${combat.maxHP} / ${combat.atk} / ${combat.def}`],
      ["STR / AGI / VIT", `${s.str} / ${s.agi} / ${s.vit}`],
      ["skill points in hand", String(s.sp)],
      ["gold", String(s.gold)],
      ["potions", String(s.potions)],
      ["floor", `${f.name} \u2014 ${f.w}\u00d7${f.h} units, ${f.objects.chunks[0]}\u00d7${f.objects.chunks[1]} chunks`],
      ["feet (floor HP)", `${Math.ceil(Math.min(this.flags.floorHp, pool))} / ${pool}`],
      ["kills \u2014 pines / ridge / total", `${this.flags.killsPines} / ${this.flags.killsRidge} / ${totalKills(this.flags)}`],
      ["floor bosses resolved", `${Object.keys(this.flags.bossDown).filter((k) => this.flags.bossDown[k]).length} / 5`],
      ["spared \u2014 hare/hound/kesh", `${this.flags.sparedHare ? "\u2713" : "\u2014"} / ${this.flags.sparedHound ? "\u2713" : "\u2014"} / ${this.flags.sparedKesh ? "\u2713" : "\u2014"}`],
      ["ridge gate", this.flags.gateOpen ? "OPEN" : this.flags.hasKey ? "key in pocket" : "locked (ask around the inn)"],
      ["route so far", routeOf(this.flags)],
      ["deaths in the dungeon", String(this.flags.deaths)],
    ];
    rows.forEach((r, i) => {
      drawText(g, r[0], 160, 100 + i * 22, 12, "#9fb4d8");
      drawText(g, r[1], 800, 100 + i * 22, 12, "#ffffff", "right");
    });
    drawText(g, "LEVEL RISES ONLY WHEN YOU TRAIN IRL. KILLS PAY SKILL POINTS \u2014 SPEND THEM", 160, 442, 10, "#6d80a8");
    drawText(g, "IN THE SKILL TREE ON THE MAIN APP. THE FLOOR TELLS NO ONE.", 160, 456, 10, "#6d80a8");
  }
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
      case "shop": {
        g.save();
        const s = VIEW_H / 480;
        g.translate((VIEW_W - 640 * s) / 2, 0);
        g.scale(s, s);
        this.renderShop(g);
        g.restore();
        break;
      }
      case "status": this.renderWorld(g); this.renderStatus(g); break;
      case "over": this.renderAsh(g); this.renderPages(g); break;
      case "ending": this.renderWorld(g); this.renderPages(g); break;
      case "battle": { // the fight keeps its 640×480 design space: letterbox, uniform scale
        g.save();
        const s = VIEW_H / 480;
        g.translate((VIEW_W - 640 * s) / 2, 0);
        g.scale(s, s);
        this.renderBattle(g);
        g.restore();
        break;
      }
      case "choice": this.renderWorld(g); this.renderChoice(g); break;
      case "journal": this.renderJournal(g); break;
      case "create": this.renderCreate(g); break;
    }
    if (this.editor?.open) this.editor.render(g);
    if (this.mode === "world") this.renderPointer(g);
    if (this.artPanel) this.renderArtStatus(g);
    if (this.transT > 0) { g.fillStyle = `rgba(0,0,0,${this.transT})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.paused) {
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(g, "PAUSED — THE FLOOR WAITS. (tab hidden; dt never jumps past 50 ms)", VIEW_W / 2, VIEW_H / 2, 12, "#9fb4d8", "center");
    }
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
      case "create": this.updateCreate(dt); return;
      case "journal": this.updateJournal(dt); return;
      case "boot":
        if (this.input.pressed("confirm")) {
          Sfx.select();
          if (this.hasSave) { this.mode = "world"; this.playTrack(this.floor.music); break; }
          this.pages = { lines: prologue(useGame.getState().name || "HUNTER"), idx: 0, t: 0 };
          this.mode = "intro";
        }
        break;
      case "intro": this.updatePages(dt, () => {
        this.flags.introDone = true;
        this.afterIntro();
      }); break;
      case "choice": this.updateChoice(dt); break;
      case "talk": this.updatePages(dt, () => { this.mode = "world"; this.runPageAfter(); }); break;
      case "over": this.updatePages(dt, () => this.respawn()); break;
      case "ending": this.updatePages(dt, () => { this.mode = "world"; this.playTrack("town"); this.runEndAfter(); }); break;
      case "status":
        if (this.input.pressed("cancel") || this.input.pressed("menu")) { this.mode = "world"; Sfx.cancel(); }
        break;
      case "shop": this.updateShop(dt); break;
      case "world": this.updateWorld(dt); break;
      case "battle": this.updateBattle(dt); break;
    }
  }
  private pendingMode: (() => void) | null = null;
  private resBeatT = 0;
  private runPageAfter() { const f = this.pageAfter; this.pageAfter = null; f?.(); }
  private runEndAfter() { const f = this.endAfter; this.endAfter = null; f?.(); }
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
      path: s.monarchPath ?? undefined, // only exists past the Job Change; claimGate guards the rest
    }, zoneLevel, (Date.now() ^ 0x5f3759df) >>> 0, {
      sparedHare: f.sparedHare, sparedHound: f.sparedHound,
      sparedHob: f.sparedStory["hobgoblin"], savedPair: f.savedPair,
      emberBond: f.emberBond, kangTaught: f.kangBond, chainedTusk: f.chainedTusk,
      // HARD GATE: no claim of any kind before the Job Change. The engine cannot
      // open this door by itself — there is no other caller (locked by tests).
      canClaim: claimGate(s.level, s.monarchPath) && REMNANT_IDS.has(id),
    });
    this.mode = "battle";
    Sfx.stopMusic();
    const bossIds = ["kesh", "architect", "hobgoblin", "sentinel", "irontusk", "warden", "alpha"];
    this.playTrack(id === "sentry" ? "final" : isBoss || bossIds.includes(id) ? "boss" : "battle");
  }

  // ---------------- battle ----------------
  private updateBattle(dt: number) {
    const b = this.battle;
    if (!b) { this.mode = "world"; return; }
    const inp = this.input;
    if (b.resonance) {
      // a faint heartbeat under the room — felt, not heard
      this.resBeatT += dt;
      if (this.resBeatT > 1.1) { this.resBeatT = 0; Sfx.heartbeat(); }
    } else this.resBeatT = 0;
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
    if (b.phase === "target" || b.phase === "extract") {
      if (inp.pressed("confirm") && b.bar.locked === null) {
        if (b.phase === "target") { lockBar(b); Sfx.hitEnemy(); }
        else {
          resolveClaim(b);
          Sfx.select();
          if (b.over && b.result?.outcome === "claim") Sfx.spare();
        }
      }
      stepBattle(b, { up: false, down: false, left: false, right: false, confirm: false }, dt);
      return;
    }
    if (b.phase === "enemyTurn") {
      stepBattle(b, { up: inp.down("up"), down: inp.down("down"), left: inp.down("left"), right: inp.down("right"), confirm: false }, dt);
      if (b.player.hp <= 0) this.toGameOver();
    }
  }
  private endBattle() {
    const b = this.battle;
    if (!b || !b.result) { this.battle = null; this.mode = "world"; this.playTrack("town"); return; }
    const r = b.result;
    this.stopTrack();
    const store = useGame.getState();
    const eid = b.enemy.id;
    if (r.outcome === "claim") {
      // A claimed name: small thanks from the System; the ally itself is the reward.
      // (S7 wires claimed shadows into the army ledger — the door is shut until then.)
      store.awardBattle(r.sp, r.gold);
      this.battle = null;
      this.mode = "world";
      this.playTrack(this.floor.music);
      return;
    }
    if (r.outcome === "win") {
      const foeLv = b.enemy.zoneLevel || 1;
      const xp = b.enemy.boss ? Math.round(foeLv * foeLv * 60) : Math.round(80 + 34 * foeLv);
      store.awardBattle(r.sp, r.gold, xp);
      const z = inZone(this.floor, this.px, this.py);
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
      { const fl = b.enemy.zoneLevel || 1; store.awardBattle(0, r.gold, b.enemy.boss ? Math.round(fl * fl * 45) : Math.round(64 + 26 * fl)); }
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
    this.encCooldown = 8; // post-battle grace — you never fight the next ambush at 20% HP
    this.playTrack(this.floor.music);
  }

  /** After a regional boss resolves (win OR spare): the Warden's floor ends
   *  with the ceremony — the only dialogue choice in the campaign. */
  private toGameOver() {
    this.flags.deaths++;
    Sfx.stopMusic();
    Sfx.death();
    this.mode = "over";
    this.pages = { lines: this.flags.deaths > 1 ? ENDINGS.gameover2 : ENDINGS.gameover, idx: 0, t: 0 };
    this.battle = null;
  }
  private afterBossResolve(eid: string, spared: boolean) {
    this.mode = "world";
    this.saveGame();
    if (eid === "warden" && this.floor.objects.boss && !this.flags.unregistered) {
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
  private renderBoot(g: CanvasRenderingContext2D) {
        g.fillStyle = "rgba(3,5,10,0.6)"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(g, "A S H E N V E I L", VIEW_W / 2, 96, 40, "#e8f0ff", "center");
    drawText(g, "an expedition: five floors, one swallowed city block, forty-one debts", VIEW_W / 2, 146, 13, "#9fb4d8", "center");
    drawText(g, "— a training quest for people who train at 5 AM —", VIEW_W / 2, 164, 13, "#6d80a8", "center");
    const s = useGame.getState();
    drawText(g, `SYSTEM LINK: ${s.name || "GUEST"}   LV ${s.level} (real-world)   ${isMuted() ? "MUTED [M]" : "SOUND [M]"}`, VIEW_W / 2, 246, 12, "#7fe7ff", "center");
    if (Math.floor(performance.now() / 430) % 2 === 0) drawText(g, "PRESS  Z", VIEW_W / 2, 312, 22, "#ffffff", "center");
    drawText(g, "ARROWS/WASD move · Z confirm · X status · SHIFT dash (LV 5+) · J journal · T pointer on/off · M mirror (at rest)", VIEW_W / 2, 396, 10, "#59708f", "center");
    drawText(g, "F fullscreen · J journal · T pointer · F4 art status · F2 editor (dev) · F3 collision", VIEW_W / 2, 412, 10, "#59708f", "center");
  }
  private renderIntro(g: CanvasRenderingContext2D) {
    g.fillStyle = "#000"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    const p = this.pages;
    if (!p) return;
    const cur = p.lines[p.idx];
    if (!cur) return;
    const shown = Math.floor(p.t * TYPE_RATE);
    const lines = this.wrap(subTokens((cur.text ?? "").slice(0, Math.max(0, shown)), useGame.getState().appearance), 15, VIEW_W - 140);
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
  // ---------------- the pointer (objective graph UI) ----------------
  private trackedNode(): ObjNode | null {
    const f = this.flags;
    const tid = (f as { trackedId?: string }).trackedId ?? "";
    if (tid) {
      const n = OBJECTIVES.find((x) => x.id === tid);
      if (n && !nodeDoneEff(n, f)) return n;
    }
    return defaultTracked(f);
  }
  private guidance(): "full" | "light" | "off" {
    const v = useGame.getState().settings?.guidance;
    return v === "light" || v === "off" ? v : "full";
  }
  private renderPointer(g: CanvasRenderingContext2D) {
    if (!this.pointerOn || this.guidance() === "off") return;
    const node = this.trackedNode();
    if (!node) return;
    const full = this.guidance() === "full";
    const targets: { t: NonNullable<ReturnType<typeof resolveTarget>>; label: string }[] = [];
    if (node.group) {
      for (const m of OBJECTIVES.filter((x) => x.group === node.group && !nodeDoneEff(x, this.flags))) {
        const t = resolveTarget(m, this.floor, this.flags);
        if (t && !t.sealed) targets.push({ t, label: m.title });
      }
    } else {
      const t = resolveTarget(node, this.floor, this.flags);
      if (t) targets.push({ t, label: node.title });
    }
    if (!targets.length) {
      if (full) drawText(g, node.hint, VIEW_W / 2, 132, 11, "#59708f", "center"); // way sealed; the journal knows
      return;
    }
    const tt = performance.now() / 420;
    const bob = Math.sin(tt) * 4;
    for (const { t, label } of targets.slice(0, 2)) {
      const px = t.x - this.cam.x, py = t.y - this.cam.y;
      const onScreen = px > -20 && px < VIEW_W + 20 && py > -20 && py < VIEW_H + 20;
      const dist = METRES(Math.hypot(t.x - this.px, t.y - this.py));
      if (t.sealed) continue; // never point at a locked exit
      if (onScreen) {
        if (full || this.guidance() === "light") {
          g.fillStyle = "#7fe7ff";
          g.save(); g.translate(px, py - 30 + bob); g.rotate(Math.PI / 4);
          g.fillRect(-5, -5, 10, 10); g.restore();
          g.globalAlpha = 0.35; g.fillStyle = "#ffffff";
          g.save(); g.translate(px, py - 30 + bob); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore();
          g.globalAlpha = 1;
          if (dist <= 10) { // arrived-ish: pulse ring
            const r = 14 + (performance.now() / 500 % 1) * 26;
            g.strokeStyle = "rgba(127,231,255,0.5)"; g.lineWidth = 2;
            g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.stroke();
          }
          if (full) {
            const lab = `${label}  ·  ${dist} m`;
            const half = lab.length * 3.1 + 8;
            const anchor: CanvasTextAlign = px + half > VIEW_W - 6 ? "right" : px - half < 6 ? "left" : "center";
            drawText(g, lab, anchor === "right" ? px - 12 : anchor === "left" ? px + 12 : px, py - 46 + bob, 10, "#bfe8ff", anchor);
          }
        }
      } else if (this.guidance() === "light" || full) {
        // edge arrow pointing off-screen
        const cx = VIEW_W / 2, cy = VIEW_H / 2;
        const ang = Math.atan2(py - cy, px - cx);
        const ex = cx + Math.cos(ang) * (VIEW_W / 2 - 26), ey = cy + Math.sin(ang) * (VIEW_H / 2 - 26);
        g.save(); g.translate(ex, ey); g.rotate(ang);
        g.fillStyle = "#7fe7ff";
        g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-2, 0); g.lineTo(-6, 7); g.closePath(); g.fill();
        g.restore();
        if (full) drawText(g, `${label}  ·  ${dist} m`, ex - Math.cos(ang) * 26, ey - Math.sin(ang) * 26 + 4, 10, "#bfe8ff", "center");
      }
      if (node.group && targets.length > 1 && onScreen) drawText(g, "CHOOSE", VIEW_W / 2, VIEW_H - 176, 13, "#ffd88a", "center");
    }
    let hintTag = "";
    if (node.target === "boss") {
      const boH = this.floor.objects.boss;
      if (boH) {
        const lvH = useGame.getState().level;
        hintTag = lvH >= boH.level
          ? ` [REC LV ${boH.level} — YOU LV ${lvH}: CLEARED]`
          : ` [REC LV ${boH.level} — YOU LV ${lvH}: TRAIN FIRST]`;
      }
    }
    if (full && node.hint) {
      const maxChars = Math.max(24, Math.floor((VIEW_W * 0.40 - 52) / 6.6));
      const room = Math.max(12, maxChars - hintTag.length);
      const shown = (node.hint.length > room ? node.hint.slice(0, room - 1) + "…" : node.hint) + hintTag;
      const w = Math.min(VIEW_W * 0.40, shown.length * 6.6 + 46);
      g.fillStyle = "rgba(6,10,18,0.72)"; g.fillRect(8, 120, w, 22);
      g.strokeStyle = "rgba(96,128,168,0.38)"; g.lineWidth = 1; g.strokeRect(8.5, 120.5, w - 1, 21);
      g.fillStyle = "#8fa5c8"; g.fillRect(14, 125, 9, 12); // tiny scroll icon
      g.fillStyle = "rgba(6,10,18,0.9)";
      g.fillRect(16, 128, 5, 1); g.fillRect(16, 131, 5, 1); g.fillRect(16, 134, 4, 1);
      drawText(g, shown, 30, 135, 11, "#c9d8ea");
    }
  }

  // ---------------- journal (J) ----------------
  private journalList() {
    const f = this.flags;
    const rows = journalRows(f);
    const groups: { head: string; items: typeof rows }[] = [];
    const main = rows.filter((r) => r.node.kind === "MAIN");
    const forks = rows.filter((r) => r.node.kind === "FORK");
    const side = rows.filter((r) => r.node.kind === "SIDE");
    if (main.length) groups.push({ head: "MAIN", items: main });
    if (forks.length) groups.push({ head: "FORKS — pick one; the other stays open", items: forks });
    if (side.length) groups.push({ head: "SIDE", items: side });
    const flat: { node: ObjNode; done: boolean; active: boolean }[] = [];
    for (const gp of groups) for (const it of gp.items) flat.push(it);
    return { groups, flat };
  }
  private updateJournal(dt: number) {
    void dt;
    const { flat } = this.journalList();
    if (this.input.pressed("cancel")) { this.mode = "world"; Sfx.cancel(); return; }
    if (this.input.pressed("down")) { this.journalSel = Math.min(flat.length - 1, this.journalSel + 1); Sfx.move(); }
    if (this.input.pressed("up")) { this.journalSel = Math.max(0, this.journalSel - 1); Sfx.move(); }
    if (this.input.pressed("confirm")) {
      const row = flat[this.journalSel];
      if (row && !row.done) {
        const cur = (this.flags as { trackedId?: string }).trackedId ?? "";
        (this.flags as unknown as { trackedId: string }).trackedId = cur === row.node.id ? "" : row.node.id;
        this.stuckT = 0;
        Sfx.select();
      } else Sfx.error();
    }
  }
  private renderJournal(g: CanvasRenderingContext2D) {
    this.renderWorld(g);
    this.box(g, 120, 40, VIEW_W - 240, VIEW_H - 80);
    drawText(g, "JOURNAL \u2014 WHERE THE FLOOR STANDS", 140, 58, 15, "#ffd88a");
    const { groups } = this.journalList();
    type JLine = { head: boolean; text: string; right?: string; sel?: boolean; rowIdx: number };
    const lines: JLine[] = [];
    let row = 0;
    const tracked = (this.flags as { trackedId?: string }).trackedId ?? "";
    for (const gp of groups) {
      lines.push({ head: true, text: gp.head, rowIdx: -1 });
      for (const it of gp.items) {
        const mark = it.done ? "\u2713" : row === this.journalSel ? "\u25B6" : "\u00b7";
        lines.push({ head: false, rowIdx: row, sel: row === this.journalSel,
          text: `${mark} ${it.node.title}`, right: it.node.floor.toUpperCase() + (it.done ? "" : tracked === it.node.id ? "  [TRACKED]" : "") });
        (lines[lines.length - 1] as JLine & { col: string }).col = it.done ? "#4c5a74" : row === this.journalSel ? "#ffffff" : "#9fb4d8";
        (lines[lines.length - 1] as JLine & { rcol: string }).rcol = it.done ? "#4c5a74" : "#6d80a8";
        row++;
      }
      lines.push({ head: true, text: "", rowIdx: -2 });
    }
    const cap = this.journalCap();
    let selLine = lines.findIndex((l) => l.rowIdx === this.journalSel);
    if (selLine < 0) selLine = 0;
    if (selLine < this.journalTop) this.journalTop = Math.max(0, selLine);
    if (selLine >= this.journalTop + cap) this.journalTop = selLine - cap + 1;
    const top = this.journalTop;
    let y = 92;
    for (let i = top; i < Math.min(lines.length, top + cap); i++) {
      const l = lines[i] as JLine & { col?: string; rcol?: string };
      if (l.rowIdx === -2) { y += 6; continue; }
      if (l.head) { drawText(g, l.text, 140, y, 10, "#59708f"); y += 20; continue; }
      drawText(g, l.text, 156, y, 13, l.col ?? "#9fb4d8");
      drawText(g, l.right ?? "", VIEW_W - 150, y, 11, l.rcol ?? "#6d80a8", "right");
      y += 19;
    }
    if (top > 0) drawText(g, "\u25B2", VIEW_W / 2, 80, 10, "#59708f", "center");
    if (top + cap < lines.length) drawText(g, "\u25BC", VIEW_W / 2, VIEW_H - 92, 10, "#59708f", "center");
    // "Where to?" line for the tracked item
    const node = this.trackedNode();
    if (node) {
      const t = resolveTarget(node, this.floor, this.flags);
      const where = t && !t.sealed
        ? `${node.floor === this.floor.id ? "HERE" : "FIND THE WAY: " + node.floor.toUpperCase()} \u00b7 ${t.label} \u00b7 ${METRES(Math.hypot(t.x - this.px, t.y - this.py))} m`
        : "the route is sealed \u2014 close this floor's business first";
      drawText(g, "Where to?  " + where, 140, VIEW_H - 66, 12, "#7fe7ff");
      if (tracked) drawText(g, "[Z] untrack", VIEW_W - 150, VIEW_H - 66, 10, "#59708f", "right");
    }
    drawText(g, "\u2191\u2193 browse · Z track · X close", 140, VIEW_H - 48, 10, "#59708f");
  }
  private journalCap() { return Math.max(6, Math.floor((VIEW_H - 178) / 19)); }

  // ---------------- F4: ART_STATUS ----------------
  private artInv() {
    const actorIds = new Set<string>(["player"]);
    const portraitIds = new Set<string>(["player"]);
    for (const id of FLOOR_IDS_LIST) {
      const fl = makeFloor(id);
      for (const n of fl.objects.npcs) { actorIds.add(n.id); portraitIds.add(n.id); }
      if (fl.objects.boss) { actorIds.add(fl.objects.boss.id); portraitIds.add(fl.objects.boss.id); }
    }
    const battleIds = Object.keys(EX_LINES_LIST);
    const partKeys: string[] = [];
    const parts: [string, number][] = [["body", 3], ["trousers", 1], ["jacket", 3], ["strap", 1], ["face", 4], ["hair", 8], ["accessory", 7]];
    for (const [slot, v] of parts) for (let i = 0; i < v; i++) for (const f of ["front", "back", "side"]) partKeys.push(playerPartKey(slot, i, f));
    return Art.inventory([...actorIds].sort(), [...portraitIds].sort(), battleIds, A.PROP_KEYS, [...FLOOR_IDS_LIST], partKeys);
  }
  private renderArtStatus(g: CanvasRenderingContext2D) {
    this.box(g, 30, 26, VIEW_W - 60, VIEW_H - 52);
    const rows = this.artInv();
    const found = rows.filter((r) => Art.status(r.key) === "FOUND").length;
    const ph = rows.filter((r) => Art.status(r.key) === "PLACEHOLDER").length;
    drawText(g, `ART_STATUS \u2014 ${rows.length} assets: ${found} FOUND \u00b7 ${ph} PLACEHOLDER \u2014 drop files at public/<path> or edit manifest.json; dev hot-reloads in 2s`, 46, 42, 12, "#ffd88a");
    const per = 22;
    this.artScroll = clamp(this.artScroll, 0, Math.max(0, rows.length - per));
    rows.slice(this.artScroll, this.artScroll + per).forEach((r, i) => {
      const st = Art.status(r.key);
      const col = st === "FOUND" ? "#7fff9e" : st === "PENDING" ? "#7fe7ff" : "#ff9d5c";
      drawText(g, r.key, 46, 66 + i * 19, 11, "#cfe0ff");
      drawText(g, r.file ?? (r.kind === "actor" ? `art/actors/${r.key.split(":")[1]}/${r.key.split(":")[2]}.png` : "—"), 470, 66 + i * 19, 10, "#59708f");
      drawText(g, st, VIEW_W - 52, 66 + i * 19, 11, col, "right");
    });
    drawText(g, "\u2191\u2193 scroll \u00b7 F4 close", VIEW_W / 2, VIEW_H - 42, 10, "#59708f", "center");
    if (this.mode === "world") { // scroll with the dpad while the panel is up
      if (this.input.down("down")) this.artScroll += 1;
      if (this.input.down("up")) this.artScroll -= 1;
    }
  }

  // ---------------- character creator (canvas mode) ----------------
  openCreator() {
    const st = useGame.getState();
    this.createReturn = this.mode === "journal" ? "world" : this.mode === "talk" ? "world" : this.mode;
    this.creating = {
      sel: 0, editing: false, facing: "front",
      draft: normalizeAppearance({ ...defaultAppearance(st.name || ""), ...(st.appearance ?? {}) }),
    };
    this.mode = "create";
    invalidateDollCache();
    Sfx.open();
  }
  private creatorType(e: KeyboardEvent) {
    const cr = this.creating;
    if (!cr || !cr.editing) return;
    e.preventDefault();
    if (e.key === "Enter") { cr.editing = false; if (!validName(cr.draft.name)) cr.draft.name = "HUNTER"; Sfx.select(); return; }
    if (e.key === "Escape") { cr.editing = false; return; }
    if (e.key === "Backspace") { cr.draft.name = cr.draft.name.slice(0, -1); return; }
    if (e.key.length === 1 && cr.draft.name.length < 14 && /\S?\S/.test(e.key) && e.key !== " ") { cr.draft.name += e.key; Sfx.text(); }
    if (e.key === " " && cr.draft.name.length < 14 && cr.draft.name.length > 0) { cr.draft.name += " "; }
  }
  private updateCreate(dt: number) {
    void dt;
    const cr = this.creating;
    if (!cr) { this.mode = "world"; return; }
    if (cr.editing) return; // typing eats the frame
    if (this.input.pressed("down")) { cr.sel = Math.min(CREATOR_FIELDS.length - 1, cr.sel + 1); Sfx.move(); }
    if (this.input.pressed("up")) { cr.sel = Math.max(0, cr.sel - 1); Sfx.move(); }
    const field = CREATOR_FIELDS[cr.sel];
    if (this.input.pressed("left")) { if (field !== "name" && field !== "confirm") { this.creating = { ...cr, draft: cycleField(cr.draft, field, -1) }; } Sfx.move(); }
    if (this.input.pressed("right")) { if (field !== "name" && field !== "confirm") { this.creating = { ...cr, draft: cycleField(cr.draft, field, 1) }; } Sfx.move(); }
    if (this.input.pressed("confirm")) {
      if (field === "name") { cr.editing = true; Sfx.open(); }
      else if (field === "randomize") { this.creating = { ...this.creating!, draft: randomLook(Math.random), sel: 0 }; Sfx.select(); }
      else if (field === "confirm") this.commitCreator();
      else this.creating = { ...this.creating!, draft: cycleField(cr.draft, field, 1) };
    }
    if (this.input.pressed("cancel") && this.flags.created) { this.creating = null; this.mode = "world"; Sfx.cancel(); }
  }
  private commitCreator() {
    const cr = this.creating!;
    const name = validName(cr.draft.name) ? cr.draft.name.trim() : "HUNTER";
    useGame.getState().setLook(name, cr.draft);
    invalidateDollCache();
    this.creating = null;
    this.flags.created = true;
    this.mode = this.createReturn === "create" ? "world" : this.createReturn;
    if (this.mode !== "world") this.mode = "world";
    Sfx.levelup();
    this.toastNow(`[THE MIRROR AGREES] ${name.toUpperCase()} — ${cr.draft.pronouns}`);
    if (!this.flags.introDone) { this.pages = { lines: [{ text: "You button the jacket to the chin. The System appends a line to a file no one reads: LOOK CONFIRMED. IT DOES NOT ASK TWICE." }], idx: 0, t: 0 }; this.mode = "talk"; }
  }
  /** intro hook: before Seo's check-in, the locker-room mirror gets one moment. */
  private afterIntro() {
    if (!this.flags.created) {
      this.mode = "world";
      this.pages = { lines: CREATION_INTRO, idx: 0, t: 0, after: () => this.openCreator() };
      this.mode = "talk";
    } else { this.mode = "world"; this.playTrack(this.floor.music); }
  }
  private renderCreate(g: CanvasRenderingContext2D) {
    const cr = this.creating;
    if (!cr) return;
    g.fillStyle = "#0a0e18"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    // locker-room wash
    g.fillStyle = "#101828"; g.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? "#0d1522" : "#111b2c"; g.fillRect(i * 160, 0, 160, VIEW_H); }
    drawText(g, "THE ASSOCIATION LOCKER ROOM \u2014 THE MIRROR IS HONEST TODAY", 20, 22, 13, "#ffd88a");
    // LEFT: live preview on a plinth, facing via ←/→ on the preview
    const ap = cr.draft;
    const doll = dollFor(ap, cr.facing);
    const SC = 4;
    const dx = 200 - (doll.width * SC) / 2, dy = 372 - doll.height * SC;
    g.fillStyle = "#0a0f1c"; g.fillRect(40, 60, 320, 340);
    g.strokeStyle = "#2c4a66"; g.lineWidth = 2; g.strokeRect(41, 61, 318, 338); // mirror frame
    // the preview's own shadow LAGS the facing change by a frame (the story clue)
    g.globalAlpha = 0.4; g.fillStyle = "#000";
    g.beginPath(); g.ellipse(200, 372, doll.width * SC * 0.36, 10, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.save();
    if (cr.facing === "back") { g.translate(400, 0); g.scale(-1, 1); }
    g.imageSmoothingEnabled = false;
    g.drawImage(doll, dx, dy, doll.width * SC, doll.height * SC);
    g.restore();
    drawText(g, `front \u00b7 back \u00b7 side \u2014 click the mirror to turn (${cr.facing})`, 200, 400, 10, "#59708f", "center");
    // RIGHT: option rows
    const x0 = 392, rowY = 58, rowH = 26;
    CREATOR_FIELDS.forEach((f, i) => {
      const y = rowY + i * rowH;
      const sel = i === cr.sel;
      if (sel) { g.fillStyle = "#1b2a44"; g.fillRect(x0 - 8, y - 13, VIEW_W - x0 - 20, rowH - 2); }
      const label = f.toUpperCase();
      drawText(g, sel ? "\u25B6 " + label : "  " + label, x0, y, 12, sel ? "#ffffff" : "#9fb4d8");
      this.createValue(g, f, ap, x0 + 150, y, sel);
    });
    if (cr.editing) {
      this.box(g, x0, rowY - 24, VIEW_W - x0 - 26, 34);
      drawText(g, "NAME (2\u201314 characters) \u2014 type, Enter to lock, Esc to stop", x0 + 10, rowY - 14, 10, "#7fe7ff");
      drawText(g, ">" + (ap.name || "") + (Math.floor(performance.now() / 300) % 2 ? "\u2588" : " "), x0 + 10, rowY + 4, 14, "#ffffff");
    }
  }
  private createValue(g: CanvasRenderingContext2D, f: CreatorField, ap: Appearance, x: number, y: number, sel: boolean) {
    const sw = (arr: string[], cur: string, w = 13) => {
      arr.forEach((c, i) => {
        g.fillStyle = c; g.fillRect(x + i * (w + 3), y - 8, w, w);
        if (c === cur) { g.strokeStyle = "#ffffff"; g.lineWidth = 1.5; g.strokeRect(x + i * (w + 3) - 1.5, y - 9.5, w + 3, w + 3); }
      });
    };
    switch (f) {
      case "name": drawText(g, ap.name || "(unnamed)", x, y, 12, "#ffffff"); drawText(g, sel && !ap.name ? "Z: type" : "", x + 120, y, 10, "#59708f"); break;
      case "pronouns": drawText(g, ap.pronouns + (sel ? "   \u2190/\u2192 he \u00b7 she \u00b7 they" : ""), x, y, 12, "#c9e6ff"); break;
      case "build": drawText(g, BUILD_NAMES[ap.build], x, y, 12, "#c9e6ff"); break;
      case "skin": sw(SKIN_SWATCHES, SKIN_SWATCHES[ap.skin]); break;
      case "face": drawText(g, FACE_NAMES[ap.face], x, y, 12, "#c9e6ff"); break;
      case "hair": drawText(g, `style ${ap.hair + 1}/8`, x, y, 12, "#c9e6ff"); break;
      case "hairColor": sw(HAIR_SWATCHES, ap.hairColor); break;
      case "streak": drawText(g, ap.streak ? "ON" : "off", x, y, 12, ap.streak ? "#7fff9e" : "#59708f"); break;
      case "streakColor": sw(COLOR_SWATCHES.slice(0, 6), ap.streakColor, 10); break;
      case "jacket": drawText(g, JACKET_NAMES[ap.jacket], x, y, 12, "#c9e6ff"); break;
      case "jacketColor": sw(COLOR_SWATCHES, ap.jacketColor, 10); break;
      case "pantsColor": sw(COLOR_SWATCHES, ap.pantsColor, 10); break;
      case "strapColor": sw(COLOR_SWATCHES, ap.strapColor, 10); break;
      case "accessory": drawText(g, ACCESSORY_NAMES[ap.accessory + 1], x, y, 12, "#c9e6ff"); break;
      case "accColor": sw(COLOR_SWATCHES, ap.accColor, 10); break;
      case "randomize": drawText(g, "\u29c3 roll a whole stranger", x, y, 12, "#ffd88a"); break;
      case "confirm": drawText(g, this.flags.created ? "\u2713 done \u2014 back to the floor" : "\u2713 THIS ONE \u2014 step away from the mirror", x, y, 12, "#7fff9e"); break;
    }
  }
  private onPointer(e: PointerEvent) {
    const cr = this.creating;
    if (cr) { // creator: rows, swatches, mirror-turn, buttons — keyboard stays primary, mouse/touch first-class here
      const rect = this.canvasEl.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const sy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
      const rowY = 58, rowH = 26;
      if (sx >= 392 && sy >= rowY - 14) {
        const idx = Math.floor((sy - (rowY - 14)) / rowH);
        if (idx >= 0 && idx < CREATOR_FIELDS.length) {
          const f = CREATOR_FIELDS[idx];
          cr.sel = idx;
          if (f === "confirm") { this.commitCreator(); return; }
          if (f === "randomize") { this.creating = { ...cr, draft: randomLook(Math.random) }; Sfx.select(); return; }
          if (f === "name") { cr.editing = true; return; }
          // swatch hit for color rows
          const arr = f === "skin" ? SKIN_SWATCHES : f === "hairColor" ? HAIR_SWATCHES : f === "streakColor" ? COLOR_SWATCHES.slice(0, 6) : ["jacketColor", "pantsColor", "strapColor", "accColor"].includes(f) ? COLOR_SWATCHES : null;
          if (arr && sy >= rowY + idx * rowH - 9 && sy <= rowY + idx * rowH + 5) {
            const w = arr.length > 8 ? 13 : 10;
            const ci = Math.floor((sx - 542) / (w + 3));
            if (ci >= 0 && ci < arr.length) {
              const d = { ...cr.draft };
              if (f === "skin") d.skin = ci; else (d as unknown as Record<string, string>)[f] = arr[ci];
              invalidateDollCache(); this.creating = { ...cr, draft: d }; Sfx.select(); return;
            }
          }
          const dir = sx > 542 + (arr ? arr.length * 16 : 0) ? 1 : -1;
          this.creating = { ...cr, draft: cycleField(cr.draft, f, dir as 1 | -1) }; Sfx.move();
          return;
        }
      }
      if (sx < 360 && sy < 400) { const fs = ["front", "back", "side"] as const; cr.facing = fs[(fs.indexOf(cr.facing) + 1) % 3]; Sfx.move(); }
      return;
    }
    // world clicks: near an interactable, click = Z (talk/save/exit)
    if (this.mode === "world") { this.interact(); }
    else if (this.mode === "talk") { /* clicks advance via Z-synthesis */ }
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
  private hideFlag(key: string): boolean {
    if (key.startsWith("genocide")) return this.flags.genocideZone;
    return !!this.flags[key as keyof WorldFlags];
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
    // First meeting with a quest NPC is legible labor: the System pays paperwork XP.
    if (f.met[key] === 1 && this.floor.objects.npcs.some((np) => np.dialogue === key)) {
      useGame.getState().awardBattle(0, 0, 60);
    }
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
    const rec = gen ? 24 : 8;
    const lv = useGame.getState().level;
    const hubSeen = (this.flags.met["seo.verdant"] ?? 0) > 0;
    const decision = bossGateDecision({ playerLevel: lv, recLevel: rec, hubSeen });
    if (decision === "block") {
      Sfx.open();
      this.choice = {
        lines: bossGateLines(gen ? "THE FINAL SENTRY" : "KESH, THE MONEYBOSS", rec, lv, "block"), idx: 0, t: 0, sel: 0,
        opts: [
          { label: "BACK OUT — TRAIN FIRST", run: () => this.toastNow("[SYSTEM] Filed under: PRUDENT. The ledger respects it.") },
          { label: `CROSS THE THRESHOLD ANYWAY — LV ${lv} VS LV ${rec}`, run: () => this.proceedArch() },
        ],
      };
      this.mode = "choice";
      return;
    }
    if (decision === "warn") {
      Sfx.open();
      this.choice = {
        lines: bossGateLines(gen ? "THE FINAL SENTRY" : "KESH, THE MONEYBOSS", rec, lv, "warn"), idx: 0, t: 0, sel: 1,
        opts: [
          { label: `CROSS THE THRESHOLD ANYWAY — LV ${lv} VS LV ${rec}`, run: () => this.proceedArch() },
          { label: "BACK OUT; TRAIN FIRST", run: () => this.toastNow("[SYSTEM] The arch keeps its breathing. Unjudged. For now.") },
        ],
      };
      this.mode = "choice";
      return;
    }
    this.proceedArch();
  }
  private proceedArch() {
    const gen = this.flags.killsPines >= 7 && this.flags.killsRidge >= 7;
    Sfx.bossIntro();
    this.pages = {
      lines: bossGateHint(this.flags), idx: 0, t: 0,
      after: () => this.beginBattle(gen ? "sentry" : "kesh", gen ? 24 : 8),
    };
    this.mode = "talk";
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
  private renderBattle(g: CanvasRenderingContext2D) {
    const b = this.battle;
    if (!b) { this.mode = "world"; return; }
    g.fillStyle = "#000"; g.fillRect(0, 0, 640, 480);
    const grad = g.createLinearGradient(0, 0, 0, 250);
    grad.addColorStop(0, b.enemy.boss ? "rgba(38,10,26,0.75)" : "rgba(14,20,38,0.75)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 640, 250);
    let es = this.battleSprites[b.enemy.id];
    if (!es) {
      es = Art.isReal(battleKey(b.enemy.id)) ? (Art.art(battleKey(b.enemy.id), b.enemy.name, "battle") as never) : A.getBattleSprite(b.enemy.id);
      this.battleSprites[b.enemy.id] = es;
    }
    if (es) {
      const maxH = 208;
      let sc = b.enemy.boss ? 9 : 7;
      if (es.height * sc > maxH) sc = Math.max(5, Math.floor(maxH / es.height));
      const bob = Math.floor(performance.now() / 520) % 2;
      const w = es.width * sc, h = es.height * sc;
      g.globalAlpha = b.over && b.result?.outcome === "win" ? 0.12 : 1;
      g.drawImage(es, Math.round(640 / 2 - w / 2), Math.round(126 - h / 2 + bob + Math.min(40, (238 - 126 - h / 2) / 2)), w, h);
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
      if (b.over && b.result && (b.result.outcome === "win" || b.result.outcome === "spare" || b.result.outcome === "claim")) {
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
      drawText(g, "Z \u2014 STRIKE", 640 / 2, by + 34, 13, "#9fb4d8", "center");
    }
    if (b.phase === "extract") {
      const ebarW = bw, ebarY = by - 60;
      g.fillStyle = "#0b1018"; g.fillRect(bx, ebarY, ebarW, 24);
      g.strokeStyle = "#8fb4ff"; g.lineWidth = 2; g.strokeRect(bx + 1, ebarY + 1, ebarW - 2, 22);
      const half = b.claimWindow * (ebarW / 2 - 14);
      g.fillStyle = "rgba(140,180,255,0.3)"; g.fillRect(bx + ebarW / 2 - half, ebarY + 2, half * 2, 20);
      g.strokeStyle = "rgba(200,220,255,0.6)"; g.strokeRect(bx + ebarW / 2 - half, ebarY + 2, half * 2, 20);
      const epx = bx + ebarW / 2 + b.bar.pos * (ebarW / 2 - 14);
      g.fillStyle = b.bar.locked !== null ? "#7fff9e" : "#ffffff";
      g.fillRect(epx - 3, ebarY - 3, 6, 30);
      drawText(g, `Z \u2014 ${b.claimVerb}`, 640 / 2, by + 34, 13, "#8fb4ff", "center");
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
      if (b.turnT < 1.2 && Math.floor(performance.now() / 180) % 2 === 0) drawText(g, "*", 640 / 2, 480 - 60, 12, "#59708f", "center");
    }
    if (b.shake > 0.1) g.restore();
    if (b.flash > 0.01) { g.fillStyle = `rgba(255,60,90,${b.flash * 0.3})`; g.fillRect(0, 0, 640, 480); }
    if (b.resonance) {
      // soft blue, hand-on-the-shoulder — an assist that will not explain itself
      const t = performance.now() / 1000;
      const pulse = 0.10 + 0.05 * Math.sin(t * Math.PI * 2 * 0.92);
      g.save();
      g.beginPath(); g.rect(bx + 3, by + 3, bw - 6, bh - 6); g.clip();
      const cx = b.soul.x, cy = b.soul.y;
      const rg = g.createRadialGradient(cx, cy, 2, cx, cy, 28);
      rg.addColorStop(0, `rgba(140,180,255,${(pulse + 0.12).toFixed(3)})`);
      rg.addColorStop(1, "rgba(140,180,255,0)");
      g.fillStyle = rg; g.fillRect(cx - 32, cy - 32, 64, 64);
      g.fillStyle = `rgba(172,200,255,${(0.3 + pulse).toFixed(3)})`;
      g.fillRect(cx - 12, cy - 10, 7, 4); g.fillRect(cx + 5, cy - 10, 7, 4);
      g.fillRect(cx - 13, cy - 13, 2, 4); g.fillRect(cx + 11, cy - 13, 2, 4);
      g.restore();
    }
    if (b.resFlash > 0) {
      g.globalAlpha = Math.min(1, b.resFlash);
      const rlines = this.wrap(RESONANCE_TEXT, 11, 640 - 130).slice(0, 3);
      rlines.forEach((l, i) => drawText(g, l, 640 / 2, 222 + i * 13, 11, "#bcd0ff", "center"));
      g.globalAlpha = 1;
    }
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
    if (b.enemy.spareable) drawText(g, `${b.enemy.name} is willING to be spared`, 640 / 2, 232, 11, "#9fe8ff", "center");
    // RESONANCE: the overlevel rescue — the floor refuses to let a debt stand unpaid
    if (b.resonance) {
      const t2 = performance.now() / 380;
      const a2 = 0.35 + Math.sin(t2) * 0.18;
      g.globalAlpha = a2;
      g.strokeStyle = "#3fd2ff"; g.lineWidth = 2; g.strokeRect(b.soul.x - 9, b.soul.y - 9, 18, 18);
      g.globalAlpha = 1;
      drawText(g, "[RESONANCE]", 640 / 2, 396, 10, "#8fb4ff", "center");
    }
  }

}
