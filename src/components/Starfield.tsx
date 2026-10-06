import { useEffect, useRef } from "react";
import { useGame } from "../store/game";
import { rankFromLevel } from "../data";
import { getPath } from "../data/monarchPaths";

function glowSprite(color: string, haze = false) {
  const sprite = document.createElement("canvas");
  const size = haze ? 256 : 48;
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext("2d");
  if (!ctx) return sprite;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(haze ? 0.1 : 0.14, `${color}${haze ? "b0" : "e0"}`);
  gradient.addColorStop(haze ? 0.55 : 0.42, `${color}${haze ? "35" : "30"}`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

/** Cached glow sprites retain the three-layer mana atmosphere without live shadows. */
export function Starfield({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const syncRef = useRef<(() => void) | null>(null);
  const color = useGame((s) => getPath(s.monarchPath)?.color ?? rankFromLevel(s.level).color);
  const nearCount = useGame((s) => Math.min(16, 10 + Math.floor(s.level / 10)));
  const inLockdown = useGame((s) => s.inLockdown);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const aura = inLockdown ? "#ff3b52" : color;
    const base = inLockdown ? "#2a0812" : "#0a2740";
    let w = window.innerWidth;
    let h = window.innerHeight;
    let raf = 0;
    let lastDraw = 0;
    let time = 0;

    const spriteFar = glowSprite(base);
    const spriteMid = glowSprite("#3f6f9a");
    const spriteNear = glowSprite(aura);
    const hazeAura = glowSprite(aura, true);
    const hazeBase = glowSprite(base, true);

    const makeLayer = (count: number, minZ: number, maxZ: number, radius: number, sprite: HTMLCanvasElement) => ({
      sprite,
      motes: Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: minZ + Math.random() * (maxZ - minZ),
        r: radius * (0.6 + Math.random() * 0.6),
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.14,
      })),
    });
    const layers = [
      makeLayer(35, 0.08, 0.3, 0.8, spriteFar),
      makeLayer(22, 0.25, 0.55, 1.5, spriteMid),
      makeLayer(nearCount, 0.5, 0.9, 2.4, spriteNear),
    ];

    const draw = (now: number) => {
      if (document.hidden || pausedRef.current) return;
      if (lastDraw === 0 || now - lastDraw >= 1000 / 30) {
        const dt = lastDraw === 0 ? 1 : Math.min(3, (now - lastDraw) / (1000 / 60));
        lastDraw = now;
        time += dt;
        ctx.clearRect(0, 0, w, h);
        const radius = Math.max(w, h);
        const sway = Math.sin(time * 0.0022);

        ctx.globalAlpha = 0.05;
        ctx.drawImage(hazeAura, w * (0.22 + sway * 0.03) - radius / 2, h * 0.2 - radius / 2, radius, radius);
        ctx.globalAlpha = 0.1;
        ctx.drawImage(hazeBase, w * (0.8 - sway * 0.03) - radius / 2, h * 0.82 - radius / 2, radius, radius);

        for (const layer of layers) {
          for (const mote of layer.motes) {
            if (!reducedMotion.matches) {
              mote.y -= mote.z * 0.28 * dt;
              mote.x += mote.drift * mote.z * dt;
              if (mote.y < -8) { mote.y = h + 8; mote.x = Math.random() * w; }
              if (mote.x < -8) mote.x = w + 8;
              if (mote.x > w + 8) mote.x = -8;
            }
            const twinkle = Math.sin(time * 0.021 + mote.phase) * 0.3 + 0.7;
            ctx.globalAlpha = mote.z * twinkle * 0.8;
            const size = mote.r * 8;
            ctx.drawImage(layer.sprite, mote.x - size / 2, mote.y - size / 2, size, size);
          }
        }
        ctx.globalAlpha = 1;
      }
      if (!reducedMotion.matches) raf = requestAnimationFrame(draw);
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      lastDraw = 0;
      if (!document.hidden && !pausedRef.current) raf = requestAnimationFrame(draw);
    };
    const resize = () => {
      const oldW = w;
      const oldH = h;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const layer of layers) {
        for (const mote of layer.motes) {
          mote.x *= w / oldW;
          mote.y *= h / oldH;
        }
      }
      sync();
    };

    syncRef.current = sync;
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(raf);
      syncRef.current = null;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, [color, nearCount, inLockdown]);

  useEffect(() => { syncRef.current?.(); }, [paused]);
  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}