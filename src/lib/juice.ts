/**
 * Game-feel layer: screen shake, impact flashes, and floating combat text.
 * Deliberately DOM-driven (not React state) so it never causes re-renders
 * of the game tree and can fire from anywhere — including the store.
 */

import { useGame } from "../store/game";

type FctKind = "xp" | "gold" | "dmg" | "heal" | "crit" | "stat" | "rep" | "hit";

const FCT_STYLE: Record<FctKind, { color: string; size: string; prefix: string }> = {
  xp:   { color: "#7fd0ff", size: "26px", prefix: "+" },
  gold: { color: "#ffc53d", size: "22px", prefix: "+" },
  dmg:  { color: "#ff3b52", size: "34px", prefix: "-" },
  heal: { color: "#2fe08a", size: "24px", prefix: "+" },
  crit: { color: "#ffe08a", size: "40px", prefix: "" },
  stat: { color: "#a855ff", size: "24px", prefix: "+" },
  rep:  { color: "#e9f4ff", size: "30px", prefix: "" },
  hit:  { color: "#7fd0ff", size: "28px", prefix: "" },
};

function enabled(flag: "screenShake" | "floatingNumbers") {
  if (typeof window === "undefined" || typeof document === "undefined" || document.hidden) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const settings = useGame.getState().settings;
    return !settings.fastMode && settings[flag] !== false;
  } catch {
    return true;
  }
}

/** Shake the whole viewport. */
export function shake(power: "sm" | "lg" = "sm") {
  if (!enabled("screenShake")) return;
  const root = document.querySelector<HTMLElement>(".app-shell") ?? document.getElementById("root");
  if (!root) return;
  root.classList.remove("shake-sm", "shake-lg");
  // force reflow so the animation restarts even on rapid repeats
  void root.offsetWidth;
  root.classList.add(power === "lg" ? "shake-lg" : "shake-sm");
  const clear = (event: AnimationEvent) => {
    if (event.target !== root || !["shakeHit", "shakeBig"].includes(event.animationName)) return;
    root.classList.remove("shake-sm", "shake-lg");
    root.removeEventListener("animationend", clear);
  };
  root.addEventListener("animationend", clear);
}

/** Full-screen colour flash (damage, level-up, gate spawn). */
export function flash(color = "#ff3b52", opacity = 0.22) {
  if (!enabled("screenShake")) return;
  const el = document.createElement("div");
  el.className = "impact-flash";
  el.style.background = `radial-gradient(ellipse at center, transparent 30%, ${color} 140%)`;
  el.style.setProperty("--impact-opacity", String(opacity));
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 420);
}

/** Floating combat text at a screen position (defaults to upper-centre). */
export function fct(
  text: string | number,
  kind: FctKind = "xp",
  at?: { x: number; y: number },
) {
  if (!enabled("floatingNumbers")) return;
  const s = FCT_STYLE[kind];
  const el = document.createElement("div");
  el.className = "fct";
  el.textContent = `${s.prefix}${text}`;
  el.style.color = s.color;
  el.style.fontSize = s.size;

  const jitter = (Math.random() - 0.5) * 70;
  el.style.left = `${(at?.x ?? window.innerWidth / 2) + jitter}px`;
  el.style.top = `${at?.y ?? Math.min(window.innerHeight * 0.34, 260)}px`;

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

/** Convenience: fire an FCT from the centre of a DOM element. */
export function fctAt(el: Element | null, text: string | number, kind: FctKind = "xp") {
  if (!el) return fct(text, kind);
  const r = el.getBoundingClientRect();
  fct(text, kind, { x: r.left + r.width / 2, y: r.top });
}

/** Queue several FCTs with a stagger, e.g. +500 XP then +100 GOLD. */
export function fctBurst(items: { text: string | number; kind: FctKind }[], gap = 180) {
  items.forEach((it, i) => setTimeout(() => fct(it.text, it.kind), i * gap));
}
