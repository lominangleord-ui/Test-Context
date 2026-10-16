// Ashenveil ART V3 — the manifest-driven art layer.
//
// Today (pre-V3, for the record): every sprite is hand-built in code — art.ts
// paints string-grid pixels via core.buildSprite; NPC "styles" are tint-swaps of
// the SAME humanoid grid (the clone bug); battle art is a procedural map with an
// imp fallback for unknown ids; the only files ever fetched were floor assets at
// hardcoded art/floors/<id>/ paths. Music was procedural tones with no file path at all.
//
// V3: public/art/manifest.json is the single source of truth:
//   { "assets": { "<key>": "file.png" | { "file": "...", "anchor": "bottom-center", "scale": 0.5 } } }
// Keys are namespaced: actor: / portrait: / battle: / prop: / ui: / floor: / music: / playerpart:.
// Overwriting a PNG or editing the manifest changes the game with ZERO code change;
// in dev the manifest + every live asset is hot-reloaded on a 2 s poll.
// Missing files NEVER crash: slots fall back to labelled placeholder cards
// (unique colour per actor, silhouette + NAME), and each miss is logged once.

export interface ManifestEntry { file: string; anchor?: "bottom-center" | "center"; scale?: number }
export type ManifestAsset = string | ManifestEntry;
export interface Manifest { assets?: Record<string, ManifestAsset> }

export type ArtStatus = "FOUND" | "PLACEHOLDER" | "PENDING";

const MANIFEST_URL = "art/manifest.json";
export const SLOT_SIZE: Record<string, [number, number]> = {
  actor: [128, 192],      // ~128×192 art px, feet anchored bottom-centre
  portrait: [384, 384],
  battle: [512, 512],
  prop: [96, 96],
  ui: [96, 64],
  floor: [1920, 1080],
  playerpart: [128, 192],
  music: [0, 0],
};

export const PLAYER_COLOR = "#5b7ba0"; // reserved — no other actor may wear it

// Deterministic golden-angle palette: every distinct key gets its own colour.
const colorMemo = new Map<string, string>();
const colorTaken = new Set<string>();
export function colorFor(key: string): string {
  const hit = colorMemo.get(key);
  if (hit) return hit;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let hue = (h >>> 0) % 360;
  for (let probe = 0; probe < 48; probe++) {
    const c = `hsl(${hue} 52% ${40 + (probe % 6) * 4}%)`;
    if (!colorTaken.has(c) && c.toLowerCase() !== PLAYER_COLOR) { colorMemo.set(key, c); colorTaken.add(c); return c; }
    hue = (hue + 47) % 360;
  }
  const c = `hsl(${hue} 52% 62%-${colorMemo.size})`; // never hit in practice
  colorMemo.set(key, c); return c;
}

function hasDom() { return typeof document !== "undefined"; }

export class ArtSet {
  manifest: Manifest = {};
  private entries = new Map<string, ManifestEntry>();
  private canvases = new Map<string, HTMLCanvasElement>(); // resolved art (real or placeholder), keyed
  private pending = new Set<string>();
  private loggedMissing = new Set<string>();
  private statuses = new Map<string, ArtStatus>();
  private listeners = new Set<() => void>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private manifestStamp = "";
  private bust = ""; // cache-buster applied to every fetch after a reload

  onChange(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private notify() { for (const f of [...this.listeners]) { try { f(); } catch { /* keep the loop alive */ } } }

  // ---------- manifest ----------
  async loadManifest(): Promise<void> {
    if (typeof fetch !== "function") return;
    try {
      const r = await fetch(`${MANIFEST_URL}?art=${this.bust || "0"}`, { cache: "no-store" });
      if (r.ok) {
        const stamp = r.headers.get("last-modified") ?? "";
        const j = (await r.json()) as Manifest;
        if (stamp !== this.manifestStamp || JSON.stringify(j) !== JSON.stringify(this.manifest)) {
          this.manifestStamp = stamp;
          this.applyManifest(j);
        }
      } else if (Object.keys(this.entries).length === 0) {
        this.applyManifest({}); // no manifest yet: everything runs on placeholders + procedural
      }
    } catch { /* offline / node harness: placeholders */ }
  }

  applyManifest(m: Manifest) {
    this.manifest = m ?? {};
    this.entries.clear();
    for (const [key, v] of Object.entries(this.manifest.assets ?? {})) {
      this.entries.set(key, typeof v === "string" ? { file: v } : v);
    }
    // every live key re-resolves; canvases already drawn for old files are dropped
    this.canvases.clear();
    this.pending.clear();
    this.notify();
  }

  /** The manifest entry for a key, if authored (used by floor.ts to override paths). */
  fileFor(key: string): ManifestEntry | null { return this.entries.get(key) ?? null; }
  scaleFor(key: string): number { return this.entries.get(key)?.scale ?? 1; }
  anchorFor(key: string): "bottom-center" | "center" { return this.entries.get(key)?.anchor ?? "bottom-center"; }

  urlFor(key: string): string | null {
    const f = this.entries.get(key)?.file;
    if (!f) return null;
    return /^(https?:\/\/|\/|data:)/.test(f) ? f : `/art/${f}`;
  }

  // ---------- dev hot reload ----------
  startDevReload(intervalMs = 2000) {
    if (this.pollTimer || typeof fetch !== "function") return;
    this.pollTimer = setInterval(async () => {
      const before = this.fingerprint();
      await this.loadManifest();
      const after = this.fingerprint();
      if (after !== before) {
        this.bust = String(Date.now()); // files changed on disk: bust caches and re-fetch everything live
        for (const key of [...this.canvases.keys()]) void this.resolve(key);
        this.notify();
      }
    }, intervalMs);
    if ((this.pollTimer as unknown as { unref?: () => void }).unref) (this.pollTimer as unknown as { unref: () => void }).unref();
  }
  stopDevReload() { if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; } }
  private fingerprint() {
    return [...this.entries.entries()].map(([k, e]) => `${k}\u0000${e.file}\u0000${e.anchor ?? ""}\u0000${e.scale ?? ""}`).sort().join("\u0001");
  }

  // ---------- resolution ----------
  /** Synchronous draw source: real art if loaded, else the placeholder card. Never null. */
  art(key: string, label: string, kind: keyof typeof SLOT_SIZE): HTMLCanvasElement {
    const hit = this.canvases.get(key);
    if (hit) return hit;
    if (!this.pending.has(key)) { void this.resolve(key, label, kind); }
    return this.placeholder(key, label, kind);
  }
  /** True when the real file is what `art()` returned (drives F4 FOUND counts). */
  isReal(key: string): boolean { return !!this.canvases.get(key) && this.statuses.get(key) === "FOUND"; }
  status(key: string): ArtStatus {
    return this.statuses.get(key)
      ?? (this.canvases.has(key) ? "FOUND"
      : this.pending.has(key) ? "PENDING"
      : this.entries.has(key) ? "PENDING" // wired in the manifest, first request hasn't come yet
      : "PLACEHOLDER");
  }
  /** Mark a key FOUND from outside the load pipeline (floor layers load via fetch/img, not
   *  art()). Deliberately NO notify(): F4 recomputes live, and a notify here can re-enter the
   *  floor loader from inside a render frame and starve the microtask queue. */
  markLoaded(key: string) { this.statuses.set(key, "FOUND"); }

  private async resolve(key: string, label = key, kind: keyof typeof SLOT_SIZE = "prop") {
    this.pending.add(key);
    const e = this.entries.get(key);
    if (!e?.file) { this.markMissing(key, label, kind); this.pending.delete(key); return; }
    const src0 = this.urlFor(key) ?? e.file; // must go through urlFor: manifest stores paths relative to public/art/
    const src = this.bust ? `${src0}${src0.includes("?") ? "&" : "?"}art=${this.bust}` : src0;
    const img = await loadImage(src);
    this.pending.delete(key);
    if (!img) { this.markMissing(key, label, kind); return; }
    const scale = e.scale ?? 1;
    const c = makeCanvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
    if (!c) { this.markMissing(key, label, kind); return; }
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img as never, 0, 0, c.width, c.height);
    this.canvases.set(key, c);
    this.statuses.set(key, "FOUND");
    this.notify();
  }

  private markMissing(key: string, label: string, kind: keyof typeof SLOT_SIZE) {
    this.statuses.set(key, "PLACEHOLDER");
    if (!this.loggedMissing.has(key)) {
      this.loggedMissing.add(key); // once — the F4 screen lists the rest
      console.warn(`[artset] missing asset "${key}" (${label}) — placeholder card in use; add it to public/${MANIFEST_URL.replace("art/", "art/")} or drop the file at the manifest path`);
    }
    const ph = this.placeholder(key, label, kind); // cache it so status lookups agree
    this.canvases.set(key, ph);
  }

  /** Labeled placeholder: coloured silhouette (unique per key) + NAME. Player's colour is reserved. */
  placeholder(key: string, label: string, kind: keyof typeof SLOT_SIZE): HTMLCanvasElement {
    const cachedKey = `\u0000ph:${key}`;
    const hit = this.canvases.get(cachedKey);
    if (hit) return hit;
    const [w0, h0] = SLOT_SIZE[kind] ?? [96, 96];
    const w = kind === "prop" ? Math.min(w0, 64) : w0;
    const h = kind === "prop" ? Math.min(h0, 64) : h0;
    const c = makeCanvas(w, h);
    if (!c) return c as never;
    const g = c.getContext("2d")!;
    const color = key.startsWith("actor:player") || key.startsWith("playerpart:") || key === "actor:player" ? PLAYER_COLOR : colorFor(key);
    g.clearRect(0, 0, w, h);
    // a card frame + head-and-shoulders silhouette + the name on the card
    g.fillStyle = "rgba(10,14,26,0.72)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = Math.max(2, Math.round(w / 48));
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    g.fillStyle = color;
    const cx = w / 2;
    const headR = kind === "portrait" ? w * 0.16 : w * 0.13;
    g.beginPath(); g.arc(cx, h * (kind === "portrait" ? 0.30 : 0.34), headR, 0, Math.PI * 2); g.fill();
    g.beginPath();
    g.moveTo(cx - headR * 2.1, h * 0.98);
    g.quadraticCurveTo(cx - headR * 2.0, h * (kind === "portrait" ? 0.52 : 0.56), cx, h * (kind === "portrait" ? 0.46 : 0.50));
    g.quadraticCurveTo(cx + headR * 2.0, h * (kind === "portrait" ? 0.52 : 0.56), cx + headR * 2.1, h * 0.98);
    g.closePath(); g.fill();
    const name = (label || key.split(":").slice(-1)[0]).toUpperCase();
    const fs = Math.max(8, Math.min(kind === "prop" ? 10 : 26, Math.floor(w * 0.85 / Math.max(4, name.length)) * 1.15));
    g.font = `bold ${Math.round(fs)}px monospace`;
    g.textAlign = "center";
    g.fillStyle = "#0a0e18"; g.fillRect(w * 0.06, h - fs * 2.1, w * 0.88, fs * 1.7);
    g.fillStyle = "#ffffff";
    g.fillText(name, cx, h - fs * 0.9, w * 0.8);
    this.canvases.set(cachedKey, c);
    return c;
  }
  invalidatePlaceholders() { for (const k of [...this.canvases.keys()]) if (k.startsWith("\u0000ph:")) this.canvases.delete(k); }

  // ---------- inventory (F4 + tests) ----------
  /** Every key the game will ask for, with its expected file, computed from live data. */
  inventory(actorIds: string[], portraitIds: string[], battleIds: string[], propIds: string[], floorIds: string[], playerPartKeys: string[]): { key: string; kind: string; label: string; file: string | null }[] {
    const rows: { key: string; kind: string; label: string; file: string | null }[] = [];
    const add = (key: string, kind: keyof typeof SLOT_SIZE, label: string) =>
      rows.push({ key, kind, label, file: this.entries.get(key)?.file ?? null });
    for (const id of floorIds) {
      add(`floor:${id}:ground`, "floor", `${id} ground`);
      add(`floor:${id}:overlay`, "floor", `${id} overlay`);
      add(`floor:${id}:collision`, "floor", `${id} collision`);
      add(`floor:${id}:objects`, "floor", `${id} objects.json`);
    }
    for (const id of actorIds) for (const f of ["front", "back", "side"]) add(`actor:${id}:${f}`, "actor", displayName(id));
    for (const id of portraitIds) for (const x of ["neutral", "talk", "hurt", "special"]) add(`portrait:${id}:${x}`, "portrait", displayName(id));
    for (const id of battleIds) add(`battle:${id}`, "battle", displayName(id));
    for (const id of propIds) add(`prop:${id}`, "prop", id);
    for (const k of playerPartKeys) add(k, "playerpart", k.split(":").slice(1, 3).join("/"));
    for (const t of ["town", "battle", "boss", "final", "marsh", "cave"]) add(`music:${t}`, "music", t);
    for (const u of ["frame", "button", "dialog"]) add(`ui:${u}`, "ui", u);
    return rows;
  }
}

export const displayName = (id: string) => id.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---------- module plumbing ----------
/** Headless stand-in: every canvas call becomes a no-op, so art code paths run
 *  identically under node tests (they just produce empty sprites). */
export function fakeCanvas(w: number, h: number): HTMLCanvasElement {
  const el = { width: w, height: h, getContext: () => ctxStub(el as never) };
  return el as never;
}
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {
    canvas,
    measureText: (t: string) => ({ width: String(t).length * 5 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    globalAlpha: 1, imageSmoothingEnabled: false,
  };
  return new Proxy(target, {
    get(t, k: string) { if (k in t) return t[k]; return () => undefined; },
    set(t, k: string, v) { t[k] = v; return true; },
  }) as never;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  if (!hasDom()) return fakeCanvas(Math.max(1, w), Math.max(1, h));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    if (typeof Image === "undefined") return res(null);
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

export const Art = new ArtSet();

/** Music: manifest override for the procedural tracks. Returns true if a file plays. */
export const ArtMusic = {
  tryPlay(track: string): boolean {
    const url = Art.urlFor(`music:${track}`);
    if (!url || typeof Audio === "undefined") return false;
    this.stop();
    this.a = new Audio(url);
    this.a.loop = true;
    void this.a.play().catch(() => { this.a = null; });
    return true;
  },
  stop() { if (this.a) { this.a.pause(); this.a = null; } },
  a: null as InstanceType<typeof Audio> | null,
};

// key builders — one grammar everywhere is what kills the clone bug
export const actorKey = (id: string, facing: "front" | "back" | "side") => `actor:${id}:${facing}`;
export const portraitKey = (id: string, expr: string) => `portrait:${id}:${expr}`;
export const battleKey = (id: string) => `battle:${id}`;
export const propKey = (id: string) => `prop:${id}`;
export const playerPartKey = (slot: string, variant: number, facing: string) => `playerpart:${slot}:${variant}:${facing}`;
