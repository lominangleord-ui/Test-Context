// Ashenveil — dev-only floor editor. Mounted ONLY when ?editor=1 or DEV builds.
// F2 toggles it. Paint collision (white/black/blue/red/green), drag NPCs, signs,
// exits, spawns, rest pads and prop colliders, export collision.png + objects.json.
// Drafts persist to localStorage so a refresh does not eat an afternoon.
import { Mask, FOOT, CELL, MASK, placeholderGround, saveToJson, type Floor } from "./floor";
import type { AshenGame } from "./view";

type Tool = "paint" | "eraseCell" | "bucket" | "rectFill" | "poly" | "picker" | "npc" | "sign" | "exit" | "propRect" | "propEllipse" | "rest" | "spawn" | "boss";
const TOOLS: Tool[] = ["paint", "eraseCell", "bucket", "rectFill", "poly", "picker", "npc", "sign", "exit", "propRect", "propEllipse", "rest", "spawn", "boss"];
const COLORS: { name: string; v: number; css: string }[] = [
  { name: "walk (white)", v: MASK.WALK, css: "#ffffff" },
  { name: "solid (black)", v: MASK.SOLID, css: "#232838" },
  { name: "water (blue)", v: MASK.WATER, css: "#3f78ff" },
  { name: "hazard (red)", v: MASK.HAZARD, css: "#ff4a4a" },
  { name: "exit (green)", v: MASK.EXIT, css: "#3fd27f" },
];

const DRAFT_KEY = (id: string) => `floorDraft_v2_${id}`;

/** tiny RLE for the cell array — localStorage-safe even on 3x3 floors */
function rle(cells: Uint8Array): string {
  let out = "", v = cells[0], n = 1;
  for (let i = 1; i < cells.length; i++) {
    if (cells[i] === v && n < 999) n++; else { out += `${v}:${n},`; v = cells[i]; n = 1; }
  }
  return out + `${v}:${n}`;
}
function unrle(s: string, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let i = 0;
  for (const part of s.split(",")) {
    const [v, n] = part.split(":").map(Number);
    for (let k = 0; k < n && i < len; k++) out[i++] = v;
  }
  return out;
}

export class FloorEditor {
  open = false;
  private tool: Tool = "paint";
  private color = 1;
  private brush = 2;
  private undo: { i: number; old: number }[][] = [];
  private drag: { kind: "prop" | "npc" | "sign" | "exit" | "rest" | "boss" | "spawn"; idx: number; ox: number; oy: number } | null = null;
  private painting = false;
  private curStroke: { i: number; old: number }[] = [];
  private mx = 0; private my = 0;
  private poly: [number, number][] = [];
  private rectA: [number, number] | null = null;
  private pickTol = 42; // eyedropper colour tolerance (per-channel sum)
  private dirtyT = 0;
  private label = "";

  constructor(private view: AshenGame) {
    const el = view.canvas;
    el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("keydown", this.onKey);
    this.restore();
  }
  destroy() {
    const el = this.view.canvas;
    el.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("keydown", this.onKey);
  }

  private get floor(): Floor { return this.view.floor; }
  /** screen → world units (view is 1:1 with world units; CSS may stretch) */
  private toWorld(e: PointerEvent): [number, number] {
    const el = this.view.canvas;
    const r = el.getBoundingClientRect();
    return [this.view.cam.x + ((e.clientX - r.left) / r.width) * el.width, this.view.cam.y + ((e.clientY - r.top) / r.height) * el.height];
  }
  private saveDraft() {
    const f = this.floor;
    try {
      localStorage.setItem(DRAFT_KEY(f.id), JSON.stringify({ objects: f.objects, cw: f.mask.cw, ch: f.mask.ch, cell: f.mask.cell, rle: rle(f.mask.cells) }));
      this.label = "draft saved";
    } catch { this.label = "draft FAILED (storage full?)"; }
  }
  private restore() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(this.floor.id));
      if (!raw) return;
      const j = JSON.parse(raw);
      if (j.objects) this.view.applyFloorObjects(j.objects);
      if (j.cw === this.floor.mask.cw && j.ch === this.floor.mask.ch) this.floor.mask.cells = unrle(j.rle, this.floor.mask.cw * this.floor.mask.ch);
      this.label = "draft restored";
    } catch { /* fresh floor */ }
  }
  reloadDraftFor(id: string) { void id; this.undo = []; this.restore(); }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === "Tab") { this.tool = TOOLS[(TOOLS.indexOf(this.tool) + 1) % TOOLS.length]; e.preventDefault(); this.label = `tool: ${this.tool}`; }
    if (e.key >= "1" && e.key <= "5") { this.color = Number(e.key) - 1; this.label = COLORS[this.color].name; }
    if (e.key === "[") this.brush = Math.max(1, this.brush === 1 ? 1 : this.brush === 2 ? 1 : this.brush === 4 ? 2 : 4);
    if (e.key === "]") this.brush = Math.min(8, this.brush === 1 ? 2 : this.brush === 2 ? 4 : this.brush === 4 ? 8 : 8);
    if (e.key === "u" || e.key === "U") this.undoStroke();
    if (e.key === "x" || e.key === "Delete" || e.key === "Backspace") this.deleteHovered();
    if (e.key === "e" || e.key === "E") this.exportAll();
    if (e.key === "Enter") this.finishPoly();
    if (e.key === "Escape") { this.poly = []; this.rectA = null; }
    if (e.key === "," || e.key === "-") this.pickTol = Math.max(6, this.pickTol - 6);
    if (e.key === "." || e.key === "=") this.pickTol = Math.min(180, this.pickTol + 6);
  };
  private onDown = (e: PointerEvent) => {
    if (!this.open) return;
    const [wx, wy] = this.toWorld(e);
    // export buttons (screen-space, drawn at the top-left of the panel)
    const sx = e.clientX - this.view.canvas.getBoundingClientRect().left;
    void sx; void wy; void wx;
    if (e.button === 0) {
      if (this.tool === "paint" || this.tool === "eraseCell") { this.painting = true; this.paintAt(wx, wy); }
      else if (this.tool === "bucket") this.floodAt(wx, wy);
      else if (this.tool === "rectFill") { this.rectA = [wx, wy]; this.painting = true; }
      else if (this.tool === "poly") {
        const c = this.floor.mask.cell;
        if (this.poly.length >= 3 && Math.hypot(wx - this.poly[0][0], wy - this.poly[0][1]) < c * 4) this.finishPoly();
        else { this.poly.push([wx, wy]); this.label = `poly: ${this.poly.length} pts — click near the first point or press Enter to fill, Esc cancels`; }
      }
      else if (this.tool === "picker") this.pickColor(wx, wy);
      else this.pickOrPlace(wx, wy);
    } else if (e.button === 2) this.deleteHovered();
  };
  private onMove = (e: PointerEvent) => {
    if (!this.open) return;
    const [wx, wy] = this.toWorld(e);
    this.mx = wx; this.my = wy;
    if (this.painting) this.paintAt(wx, wy);
    if (this.drag) this.dragTo(wx, wy);
  };
  private onUp = () => {
    if (this.painting && this.tool === "rectFill" && this.rectA) this.fillRectCells(this.rectA, [this.mx, this.my]);
    if (this.painting) { this.painting = false; if (this.curStroke.length) { this.undo.push(this.curStroke); this.curStroke = []; this.touch(); } }
    this.rectA = null;
    this.drag = null;
  };
  /** flood the contiguous run of one class (4-neighbour) with the current colour */
  private floodAt(wx: number, wy: number) {
    const m = this.floor.mask;
    const cx = Math.floor(wx / m.cell), cy = Math.floor(wy / m.cell);
    if (cx < 0 || cy < 0 || cx >= m.cw || cy >= m.ch) return;
    const from = m.cells[cy * m.cw + cx], to = COLORS[this.color].v;
    if (from === to) { this.label = "bucket: that cell is already " + COLORS[this.color].name; return; }
    const st: { i: number; old: number }[] = [];
    const q = [cy * m.cw + cx];
    const seen = new Set<number>(q);
    while (q.length) {
      const i = q.pop()!;
      st.push({ i, old: m.cells[i] });
      m.cells[i] = to;
      const x = i % m.cw, y = (i / m.cw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.cw || ny >= m.ch) continue;
        const j = ny * m.cw + nx;
        if (seen.has(j) || m.cells[j] !== from) continue;
        seen.add(j); q.push(j);
      }
    }
    this.undo.push(st); this.touch();
    this.label = `bucket: ${st.length} cells → ${COLORS[this.color].name}`;
  }
  private fillRectCells(a: [number, number], b: [number, number]) {
    const m = this.floor.mask, v = COLORS[this.color].v;
    const x0 = Math.floor(Math.min(a[0], b[0]) / m.cell), x1 = Math.floor(Math.max(a[0], b[0]) / m.cell);
    const y0 = Math.floor(Math.min(a[1], b[1]) / m.cell), y1 = Math.floor(Math.max(a[1], b[1]) / m.cell);
    const st: { i: number; old: number }[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= m.cw || y >= m.ch) continue;
      const i = y * m.cw + x;
      if (m.cells[i] === v) continue;
      st.push({ i, old: m.cells[i] }); m.cells[i] = v;
    }
    if (st.length) { this.undo.push(st); this.touch(); }
    this.label = `rect: ${st.length} cells → ${COLORS[this.color].name}`;
  }
  /** close the lasso and even-odd fill the enclosed cells with the current colour */
  private finishPoly() {
    if (this.poly.length < 3) { this.poly = []; return; }
    const m = this.floor.mask, v = COLORS[this.color].v, P = this.poly;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const [x, y] of P) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    const st: { i: number; old: number }[] = [];
    for (let cy = Math.max(0, Math.floor(miny / m.cell)); cy <= Math.min(m.ch - 1, Math.floor(maxy / m.cell)); cy++)
      for (let cx = Math.max(0, Math.floor(minx / m.cell)); cx <= Math.min(m.cw - 1, Math.floor(maxx / m.cell)); cx++) {
        const x = (cx + 0.5) * m.cell, y = (cy + 0.5) * m.cell;
        let inside = false;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const [xi, yi] = P[i], [xj, yj] = P[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (!inside) continue;
        const k = cy * m.cw + cx;
        if (m.cells[k] === v) continue;
        st.push({ i: k, old: m.cells[k] }); m.cells[k] = v;
      }
    this.poly = [];
    if (st.length) { this.undo.push(st); this.touch(); }
    this.label = `poly: ${st.length} cells → ${COLORS[this.color].name}`;
  }
  /** eyedropper: sample the GROUND art pixel under the cursor, mark every mask cell
   *  whose ground colour matches (within tolerance) as solid — trace a whole wall run
   *  in one click.  , / . tune the tolerance. */
  private pickColor(wx: number, wy: number) {
    const gr = this.floor.art.ground as HTMLCanvasElement | undefined;
    const gc = gr?.getContext?.("2d");
    if (!gr || !gc || !gr.width) { this.label = "picker: no ground art loaded"; return; }
    const scale = gr.width / this.floor.w; // ground canvas px per world unit (2 at 1:1 art)
    let r: number | null = null, g2 = 0, b = 0;
    const sample = (px: number, py: number): [number, number, number] | null => {
      if (px < 0 || py < 0 || px >= gr.width || py >= gr.height) return null;
      const d = gc.getImageData(px, py, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    {
      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const p = sample(Math.round(wx * scale) + dx, Math.round(wy * scale) + dy);
        if (!p) continue; sr += p[0]; sg += p[1]; sb += p[2]; cnt++;
      }
      if (!cnt) { this.label = "picker: sample fell outside the ground art"; return; }
      r = Math.round(sr / cnt); g2 = Math.round(sg / cnt); b = Math.round(sb / cnt);
    }
    const m = this.floor.mask;
    const st: { i: number; old: number }[] = [];
    for (let cy = 0; cy < m.ch; cy++) for (let cx = 0; cx < m.cw; cx++) {
      const i = cy * m.cw + cx;
      if (m.cells[i] === MASK.SOLID) continue;
      const p = sample(Math.round((cx + 0.5) * m.cell * scale), Math.round((cy + 0.5) * m.cell * scale));
      if (!p) continue;
      if (Math.abs(p[0] - r) + Math.abs(p[1] - g2) + Math.abs(p[2] - b) > this.pickTol * 3) continue;
      st.push({ i, old: m.cells[i] }); m.cells[i] = MASK.SOLID;
    }
    if (st.length) { this.undo.push(st); this.touch(); }
    this.label = `picker: rgb(${r},${g2},${b}) tol ${this.pickTol} → ${st.length} cells marked SOLID`;
  }

  private touch() {
    this.dirtyT = 0.35; // debounce the draft write
  }
  private tick(dt: number) {
    if (this.dirtyT > 0) { this.dirtyT -= dt; if (this.dirtyT <= 0) this.saveDraft(); }
  }
  private paintAt(wx: number, wy: number) {
    const m = this.floor.mask;
    const cx = Math.floor(wx / m.cell), cy = Math.floor(wy / m.cell);
    const r = this.brush - 1;
    const stroke: { i: number; old: number }[] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= m.cw || y >= m.ch) continue;
      const i = y * m.cw + x;
      stroke.push({ i, old: m.cells[i] });
      m.cells[i] = COLORS[this.color].v;
    }
    this.curStroke = this.curStroke.concat(stroke);
  }
  private undoStroke() {
    const st = this.undo.pop();
    if (!st) { this.label = "nothing to undo"; return; }
    const m = this.floor.mask;
    for (const s of st) m.cells[s.i] = s.old;
    this.touch();
  }
  private hitObject(wx: number, wy: number): { kind: "prop" | "npc" | "sign" | "exit" | "rest" | "boss" | "spawn"; idx: number } | null {
    const o = this.floor.objects;
    if (o.boss && wx > o.boss.x && wx < o.boss.x + o.boss.w && wy > o.boss.y && wy < o.boss.y + o.boss.h) return { kind: "boss", idx: 0 };
    for (let i = 0; i < o.props.length; i++) { const p = o.props[i]; if (wx > p.x && wx < p.x + p.w && wy > p.y && wy < p.y + p.h) return { kind: "prop", idx: i }; }
    for (let i = 0; i < o.exits.length; i++) { const x = o.exits[i]; if (wx > x.x && wx < x.x + x.w && wy > x.y && wy < x.y + x.h) return { kind: "exit", idx: i }; }
    for (let i = 0; i < o.rests.length; i++) { const r = o.rests[i]; if (wx > r.x && wx < r.x + r.w && wy > r.y && wy < r.y + r.h) return { kind: "rest", idx: i }; }
    for (let i = 0; i < o.npcs.length; i++) { const n = o.npcs[i]; if (Math.abs(wx - n.x) < 22 && wy > n.y - 52 && wy < n.y + 6) return { kind: "npc", idx: i }; }
    for (let i = 0; i < o.signs.length; i++) { const s = o.signs[i]; if (Math.abs(wx - s.x) < 20 && Math.abs(wy - s.y) < 20) return { kind: "sign", idx: i }; }
    if (Math.abs(wx - o.spawn[0]) < 24 && Math.abs(wy - o.spawn[1]) < 24) return { kind: "spawn", idx: 0 };
    return null;
  }
  private pickOrPlace(wx: number, wy: number) {
    const hit = this.hitObject(wx, wy);
    if (hit) {
      const o = this.floor.objects;
      this.drag = {
        kind: hit.kind, idx: hit.idx,
        ox: wx - (hit.kind === "prop" ? o.props[hit.idx].x : hit.kind === "exit" ? o.exits[hit.idx].x : hit.kind === "rest" ? o.rests[hit.idx].x : hit.kind === "npc" ? o.npcs[hit.idx].x : hit.kind === "sign" ? o.signs[hit.idx].x : hit.kind === "boss" ? o.boss!.x : o.spawn[0]),
        oy: wy - (hit.kind === "prop" ? o.props[hit.idx].y : hit.kind === "exit" ? o.exits[hit.idx].y : hit.kind === "rest" ? o.rests[hit.idx].y : hit.kind === "npc" ? o.npcs[hit.idx].y : hit.kind === "sign" ? o.signs[hit.idx].y : hit.kind === "boss" ? o.boss!.y : o.spawn[1]),
      };
      return;
    }
    const o = this.floor.objects;
    if (this.tool === "npc") o.npcs.push({ id: `custom${o.npcs.length + 1}`, x: wx, y: wy, sprite: "seo", facing: "down", dialogue: "seo.verdant" });
    else if (this.tool === "sign") o.signs.push({ x: wx, y: wy, text: "sign.entry" });
    else if (this.tool === "exit") o.exits.push({ x: wx - 40, y: wy - 20, w: 80, h: 40, to: "marsh", label: "NEW EXIT" });
    else if (this.tool === "rest") o.rests.push({ x: wx - 30, y: wy - 20, w: 60, h: 40 });
    else if (this.tool === "propRect") o.props.push({ x: wx - 30, y: wy - 30, w: 60, h: 60, sprite: "pillar", solid: "rect" });
    else if (this.tool === "propEllipse") o.props.push({ x: wx - 30, y: wy - 24, w: 60, h: 48, sprite: "gpine", solid: "ellipse" });
    else if (this.tool === "spawn") { o.spawn = [wx, wy]; this.view.warpPlayer(wx, wy); }
    this.touch();
  }
  private dragTo(wx: number, wy: number) {
    const d = this.drag; if (!d) return;
    const o = this.floor.objects;
    const x = wx - d.ox, y = wy - d.oy;
    if (d.kind === "prop") { o.props[d.idx].x = x; o.props[d.idx].y = y; }
    else if (d.kind === "exit") { o.exits[d.idx].x = x; o.exits[d.idx].y = y; }
    else if (d.kind === "rest") { o.rests[d.idx].x = x; o.rests[d.idx].y = y; }
    else if (d.kind === "npc") { o.npcs[d.idx].x = x; o.npcs[d.idx].y = y; }
    else if (d.kind === "sign") { o.signs[d.idx].x = x; o.signs[d.idx].y = y; }
    else if (d.kind === "boss" && o.boss) { o.boss.x = x; o.boss.y = y; }
    else if (d.kind === "spawn") { o.spawn = [x, y]; }
    this.touch();
  }
  private deleteHovered() {
    const hit = this.hitObject(this.mx, this.my);
    if (!hit) { this.label = "nothing under the cursor to delete"; return; }
    const o = this.floor.objects;
    if (hit.kind === "prop") o.props.splice(hit.idx, 1);
    else if (hit.kind === "exit") o.exits.splice(hit.idx, 1);
    else if (hit.kind === "rest") o.rests.splice(hit.idx, 1);
    else if (hit.kind === "npc") o.npcs.splice(hit.idx, 1);
    else if (hit.kind === "sign") o.signs.splice(hit.idx, 1);
    else if (hit.kind === "boss") o.boss = undefined;
    this.label = "deleted";
    this.touch();
  }
  private exportAll() {
    const f = this.floor;
    this.download("objects.json", new Blob([saveToJson(f.objects)], { type: "application/json" }));
    const c = document.createElement("canvas");
    c.width = f.mask.cw; c.height = f.mask.ch;
    const g = c.getContext("2d")!;
    const img = g.createImageData(c.width, c.height);
    const COL: Record<number, [number, number, number]> = { 0: [255, 255, 255], 1: [0, 0, 0], 2: [40, 90, 220], 3: [225, 45, 45], 4: [45, 200, 90] };
    for (let i = 0; i < f.mask.cells.length; i++) {
      const [r, gg, b] = COL[f.mask.cells[i]] ?? [255, 0, 255];
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    c.toBlob?.((bl) => { if (bl) this.download(`collision_${f.id}.png`, bl); }) ?? this.downloadDataUrl(c);
    this.label = "exported collision.png + objects.json → drop them in public/art/floors/" + f.id + "/";
    this.view.toastNow("[EDITOR] EXPORT DOWNLOADED — public/art/floors/" + f.id + "/");
  }
  private downloadDataUrl(c: HTMLCanvasElement) {
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png"); a.download = `collision_${this.floor.id}.png`;
    a.click();
  }
  private download(name: string, blob: Blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---- live drawing over the game ----
  update(dt: number) { this.tick(dt); }
  render(g: CanvasRenderingContext2D) {
    if (!this.open) return;
    const f = this.floor;
    const ox = -this.view.cam.x, oy = -this.view.cam.y;
    // painted mask, translucent
    const m = f.mask;
    const c0 = Math.max(0, Math.floor(-ox / m.cell)), c1 = Math.min(m.cw, Math.ceil((-ox + 960) / m.cell));
    const r0 = Math.max(0, Math.floor(-oy / m.cell)), r1 = Math.min(m.ch, Math.ceil((-oy + 540) / m.cell));
    for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) {
      const v = m.cells[y * m.cw + x];
      if (v === MASK.WALK) continue;
      g.fillStyle = v === MASK.SOLID ? "rgba(255,64,64,0.30)" : v === MASK.WATER ? "rgba(64,120,255,0.35)" : v === MASK.HAZARD ? "rgba(255,150,40,0.40)" : "rgba(64,255,120,0.35)";
      g.fillRect(ox + x * m.cell, oy + y * m.cell, m.cell + 0.5, m.cell + 0.5);
    }
    // objects
    g.lineWidth = 2;
    for (const p of f.objects.props) {
      g.strokeStyle = p.solid ? "#7fe7ff" : "rgba(127,231,255,0.35)";
      if (p.solid === "ellipse") { g.beginPath(); g.ellipse(ox + p.x + p.w / 2, oy + p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); g.stroke(); }
      else g.strokeRect(ox + p.x, oy + p.y, p.w, p.h);
    }
    for (const e of f.objects.exits) { g.strokeStyle = "#3fd27f"; g.strokeRect(ox + e.x, oy + e.y, e.w, e.h); g.fillStyle = "#3fd27f"; g.font = "11px monospace"; g.fillText("→ " + e.to, ox + e.x, oy + e.y - 4); }
    for (const r of f.objects.rests) { g.strokeStyle = "#7fe7ff"; g.strokeRect(ox + r.x, oy + r.y, r.w, r.h); }
    for (const n of f.objects.npcs) { g.fillStyle = "#ffd88a"; g.fillRect(ox + n.x - 3, oy + n.y - 3, 6, 6); g.font = "10px monospace"; g.fillText(n.id, ox + n.x + 8, oy + n.y); }
    for (const s of f.objects.signs) { g.fillStyle = "#c9a06a"; g.fillRect(ox + s.x - 3, oy + s.y - 3, 6, 6); }
    if (f.objects.boss) { g.strokeStyle = "#ff5566"; g.strokeRect(ox + f.objects.boss.x, oy + f.objects.boss.y, f.objects.boss.w, f.objects.boss.h); }
    g.fillStyle = "#ffffff"; g.font = "10px monospace";
    g.fillText("SPAWN", ox + f.objects.spawn[0] - 16, oy + f.objects.spawn[1] - 14);
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.strokeRect(ox + f.objects.spawn[0] - 8, oy + f.objects.spawn[1] - FOOT.h, 16, FOOT.h);
    // cursor brush
    if (this.tool === "paint" || this.tool === "eraseCell") {
      const s = this.brush * m.cell;
      g.strokeStyle = COLORS[this.color].css;
      g.strokeRect(ox + Math.floor((this.mx - s / 2) / m.cell) * m.cell, oy + Math.floor((this.my - s / 2) / m.cell) * m.cell, s, s);
    }
    // live previews for the new mask tools
    if (this.tool === "rectFill" && this.rectA) {
      g.strokeStyle = COLORS[this.color].css; g.setLineDash([4, 3]);
      g.strokeRect(Math.min(this.rectA[0], this.mx) + ox, Math.min(this.rectA[1], this.my) + oy, Math.abs(this.mx - this.rectA[0]), Math.abs(this.my - this.rectA[1]));
      g.setLineDash([]);
    }
    if (this.poly.length) {
      g.strokeStyle = COLORS[this.color].css; g.lineWidth = 1.5;
      g.beginPath();
      this.poly.forEach(([x, y], i) => (i ? g.lineTo(ox + x, oy + y) : g.moveTo(ox + x, oy + y)));
      g.lineTo(ox + this.mx, oy + this.my);
      g.stroke();
      g.fillStyle = COLORS[this.color].css;
      for (const [x, y] of this.poly) { g.beginPath(); g.arc(ox + x, oy + y, 3, 0, Math.PI * 2); g.fill(); }
    }
    if (this.tool === "picker") {
      g.strokeStyle = "#ffffff"; g.lineWidth = 1;
      g.strokeRect(ox + this.mx - 6, oy + this.my - 6, 12, 12);
      g.fillStyle = "#ffffff"; g.font = "10px monospace";
      g.fillText(`tol ${this.pickTol}`, ox + this.mx + 10, oy + this.my - 8);
    }
    // panel
    g.fillStyle = "rgba(4,7,14,0.88)"; g.fillRect(0, 0, 960, 22); g.fillRect(0, 518, 960, 22);
    g.fillStyle = "#7fe7ff"; g.font = "12px monospace";
    g.fillText(`FLOOR EDITOR — ${f.id} — tool: ${this.tool} (${(TOOLS.indexOf(this.tool) + 1)}/${TOOLS.length}) — mask ${m.cw}x${m.ch}, cell ${m.cell}u${this.label ? " — " + this.label : ""}`, 8, 15);
    g.fillStyle = "#8fa8c8";
    g.fillText("TAB tool · 1-5 class · [ ] brush · bucket/rect/poly: Enter fills, Esc cancels · picker: , . tolerance → SOLID · drag move · X del · U undo · E export · F2 exit · F3 overlay · F5 noclip (dev)", 8, 532);
  }
}

export { COLORS, TOOLS };
void placeholderGround; void Mask; void CELL;
