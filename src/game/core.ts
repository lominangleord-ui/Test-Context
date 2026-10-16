// Ashenveil engine — core: input, rng, pixels, audio. No React here.

export const TILE = 16;
export const VIEW_W = 640;
export const VIEW_H = 480;
export const mapW = (px: number) => Math.floor(px / TILE);

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Deterministic RNG (mulberry32). Battle sim is seeded so tests can replay fights. */
export function mkRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- input ----------------

export type GameKey = "up" | "down" | "left" | "right" | "confirm" | "cancel" | "menu";

const KEYMAP: Record<string, GameKey> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  KeyZ: "confirm", Enter: "confirm", Space: "confirm",
  KeyX: "cancel", Escape: "cancel", ShiftRight: "menu", Tab: "menu",
};

export class Input {
  held: Record<GameKey, boolean> = { up: false, down: false, left: false, right: false, confirm: false, cancel: false, menu: false };
  private justPressed = new Set<GameKey>();
  private onKey = (e: KeyboardEvent, down: boolean) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    if (e.code === "Tab" || e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    if (down && !this.held[k]) this.justPressed.add(k);
    this.held[k] = down;
  };
  private kd = (e: KeyboardEvent) => this.onKey(e, true);
  private ku = (e: KeyboardEvent) => this.onKey(e, false);

  attach(el?: HTMLElement) {
    void el;
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
  }
  detach() {
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
  }
  /** Touch/virtual pad entry point. */
  press(k: GameKey, down: boolean) {
    if (down && !this.held[k]) this.justPressed.add(k);
    this.held[k] = down;
  }
  down(k: GameKey): boolean { return this.held[k]; }
  pressed(k: GameKey): boolean { return this.justPressed.has(k); }
  /** call once per frame end */
  endFrame() { this.justPressed.clear(); }
}

// ---------------- pixel sprites ----------------
// Sprites are hand-authored string grids. '.' = transparent.

export function buildSprite(rows: string[], map: Record<string, string>): HTMLCanvasElement {
  // normalize confusable glyphs (authored grids occasionally carry Cyrillic look-alikes)
  rows = rows.map((r) =>
    r.replace(/о/g, "o").replace(/О/g, "O").replace(/Б/g, "B").replace(/б/g, "b").replace(/а/g, "a").replace(/е/g, "e").replace(/р/g, "p").replace(/с/g, "c").replace(/у/g, "y").replace(/х/g, "x").replace(/м/g, "M"));
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const col = map[ch];
      if (!col || col === "-") continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** tint a built canvas into a new one (for NPC palette variants / ash mode) */
export function tintSprite(src: HTMLCanvasElement, replace: [string, string][]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (const [from, to] of replace) {
    const fc = parseHex(from), tc = parseHex(to);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      if (d[i] === fc[0] && d[i + 1] === fc[1] && d[i + 2] === fc[2]) {
        d[i] = tc[0]; d[i + 1] = tc[1]; d[i + 2] = tc[2];
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function outlineSprite(src: HTMLCanvasElement, color = "#000000"): HTMLCanvasElement {
  const w = src.width + 2, h = src.height + 2;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const s = document.createElement("canvas");
  s.width = src.width; s.height = src.height;
  s.getContext("2d")!.drawImage(src, 0, 0);
  const mask = s.getContext("2d")!.getImageData(0, 0, s.width, s.height);
  g.fillStyle = color;
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
    if (mask.data[(y * s.width + x) * 4 + 3] === 0) continue;
    const near4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of near4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) { g.fillRect(x + 1 + dx, y + 1 + dy, 1, 1); continue; }
      if (mask.data[(ny * s.width + nx) * 4 + 3] === 0) g.fillRect(x + 1 + dx, y + 1 + dy, 1, 1);
    }
  }
  g.drawImage(src, 1, 1);
  return c;
}

// ---------------- audio (self-contained synth; independent of the fitness HUD) ----------------

let actx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!actx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      actx = new AC();
    }
    if (actx.state === "suspended") void actx.resume();
    return actx;
  } catch { return null; }
}

let muted = false;
export function setMuted(m: boolean) { muted = m; Sfx.stopMusic(); }
export function isMuted() { return muted; }

function tone(freq: number, dur = 0.08, type: OscillatorType = "square", vol = 0.045, delay = 0, slide = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(dur = 0.12, vol = 0.05, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime + delay);
  src.connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
}

export const Sfx = {
  move: () => tone(610, 0.045, "square", 0.03),
  select: () => tone(880, 0.07, "square", 0.045),
  cancel: () => tone(320, 0.09, "square", 0.04, 0, -80),
  text: () => tone(430 + Math.random() * 40, 0.022, "square", 0.02),
  open: () => tone(520, 0.06, "triangle", 0.05),
  save: () => { tone(660, 0.09, "triangle", 0.06); tone(880, 0.12, "triangle", 0.06, 0.09); tone(1320, 0.16, "triangle", 0.05, 0.2); },
  encounter: () => { for (let i = 0; i < 6; i++) tone(180 + i * 160, 0.05, "sawtooth", 0.05, i * 0.045); noise(0.3, 0.05, 0.28); },
  hitEnemy: () => { noise(0.06, 0.09); tone(240, 0.1, "sawtooth", 0.06, 0, -160); },
  hurt: () => { tone(140, 0.18, "sawtooth", 0.08, 0, -60); noise(0.1, 0.06); },
  heal: () => { tone(523, 0.07, "sine", 0.05); tone(659, 0.07, "sine", 0.05, 0.06); tone(784, 0.1, "sine", 0.05, 0.12); },
  spare: () => { tone(587, 0.1, "triangle", 0.05); tone(740, 0.1, "triangle", 0.05, 0.09); tone(880, 0.14, "triangle", 0.05, 0.18); },
  kill: () => { noise(0.3, 0.07); tone(196, 0.25, "sawtooth", 0.05, 0, -140); },
  levelup: () => { tone(523, 0.06, "square", 0.05); tone(659, 0.06, "square", 0.05, 0.05); tone(784, 0.06, "square", 0.05, 0.1); tone(1046, 0.14, "square", 0.05, 0.15); },
  gate: () => { tone(90, 0.3, "sawtooth", 0.06, 0, 40); noise(0.25, 0.05, 0.05); },
  error: () => tone(180, 0.14, "square", 0.05, 0, -60),
  death: () => { for (let i = 0; i < 8; i++) tone(440 - i * 45, 0.14, "sawtooth", 0.05, i * 0.13); },
  heartbeat: () => { tone(62, 0.1, "sine", 0.05); tone(56, 0.09, "sine", 0.038, 0.17); },
  bossIntro: () => { for (let i = 0; i < 4; i++) tone(98, 0.12, "square", 0.06, i * 0.13); tone(130, 0.5, "sawtooth", 0.05, 0.5, -30); },

  // --- tiny sequencer for background loops ---
  _timer: 0 as ReturnType<typeof setInterval> | 0,
  playMusic(track: "town" | "battle" | "boss" | "final" | "marsh" | "cave") {
    this.stopMusic();
    if (muted) return;
    const T: Record<string, { bpm: number; lead: (number | 0)[]; bass: (number | 0)[]; hat?: number[] }> = {
      // Melody in semitones from A4; 0 = rest. Town: a cold, small waltz of a snow town.
      town: { bpm: 112,
        lead: [76, 0, 72, 0, 68, 0, 71, 0, 74, 0, 0, 0, 69, 0, 71, 72, 0, 76, 0, 0, 74, 0, 72, 0, 68, 0, 0, 0, 64, 0, 68, 71],
        bass: [40, 0, 0, 0, 47, 0, 0, 0, 38, 0, 0, 0, 45, 0, 0, 0, 36, 0, 0, 0, 43, 0, 0, 0, 40, 0, 0, 0, 47, 0, 45, 0] },
      // Battle: urgent 8-bit gallop.
      battle: { bpm: 150,
        lead: [69, 69, 72, 69, 71, 69, 68, 0, 64, 64, 68, 64, 66, 64, 63, 0, 66, 66, 69, 66, 71, 69, 68, 0, 72, 71, 69, 68, 66, 0, 64, 0],
        bass: [45, 45, 45, 45, 43, 43, 43, 43, 40, 40, 40, 40, 38, 38, 38, 38, 45, 45, 45, 45, 43, 43, 43, 43, 40, 40, 40, 40, 43, 43, 38, 38] },
      // Boss: half-time menace, minor 2nds.
      boss: { bpm: 132,
        lead: [62, 0, 0, 0, 61, 0, 0, 0, 62, 0, 0, 0, 65, 0, 66, 0, 62, 0, 0, 0, 61, 0, 0, 0, 59, 0, 0, 0, 58, 0, 61, 0],
        bass: [38, 0, 38, 0, 38, 0, 38, 0, 39, 0, 39, 0, 38, 0, 38, 0, 38, 0, 38, 0, 38, 0, 38, 0, 36, 0, 36, 0, 37, 0, 37, 0] },
      // Sunken Marsh: a slow tide in a minor key, banjo of drowned bells.
      marsh: { bpm: 84,
        lead: [57, 0, 0, 60, 0, 0, 64, 0, 63, 0, 0, 0, 60, 0, 0, 0, 55, 0, 57, 0, 0, 60, 0, 0, 53, 0, 0, 0, 0, 0, 0, 0],
        bass: [33, 0, 0, 0, 0, 0, 36, 0, 33, 0, 0, 0, 29, 0, 0, 0, 33, 0, 0, 0, 0, 0, 36, 0, 31, 0, 0, 0, 28, 0, 0, 0] },
      // Ashen Caverns: heat under a floor. Drip, ember, drip.
      cave: { bpm: 72,
        lead: [0, 0, 50, 0, 0, 0, 49, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 50, 0, 0, 0, 52, 0, 0, 49, 0, 0, 0, 0, 45, 0],
        bass: [26, 0, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 21, 0, 0, 0, 0, 0, 0, 0] },
      // The genocide final: silence that pulses.
      final: { bpm: 96,
        lead: [61, 0, 0, 0, 0, 0, 60, 0, 0, 0, 58, 0, 0, 0, 0, 0],
        bass: [33, 0, 0, 0, 33, 0, 0, 0, 34, 0, 0, 0, 33, 0, 0, 0] },
    };
    const tr = T[track];
    const stepMs = 60000 / tr.bpm / 2;
    let i = 0;
    this._timer = setInterval(() => {
      const n = tr.lead[i % tr.lead.length];
      if (n) tone(mtof(n), stepMs / 1000 * 0.92, "square", 0.028);
      const b = tr.bass[i % tr.bass.length];
      if (b) tone(mtof(b), stepMs / 1000 * 1.6, "triangle", 0.05);
      if (track === "battle" || track === "boss") if (i % 4 === 2) noise(0.025, 0.014);
      i++;
    }, stepMs);
  },
  stopMusic() { if (this._timer) { clearInterval(this._timer); this._timer = 0 as never; } },
};

export function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------- text ----------------

export function drawText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size = 18, color = "#ffffff", align: CanvasTextAlign = "left") {
  g.font = `${size}px "Share Tech Mono", "Courier New", monospace`;
  g.textAlign = align;
  g.textBaseline = "top";
  g.fillStyle = color;
  g.fillText(text, x, y);
}

// ---------------- save ----------------

export function writeSave<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* private mode */ }
}
export function readSave<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
