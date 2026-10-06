import { useEffect, useRef, useState } from "react";

/** HP/MP/EXP/Fatigue bar with lore-accurate label styling */
export function Bar({
  value,
  max,
  color,
  label,
  showText = true,
  className = "",
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
  showText?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between items-baseline mb-1">
          <span
            className="font-sys text-[9.5px] font-600 tracking-[0.22em]"
            style={{ color }}
          >
            {label}
          </span>
          {showText && (
            <span className="font-mono text-[10.5px] text-[color:var(--text)]">
              {Math.round(value)}
              <span className="text-[color:var(--text-faint)]"> / </span>
              {Math.round(max)}
            </span>
          )}
        </div>
      )}
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 40%, transparent), ${color})`,
            color,
            boxShadow: `0 0 12px color-mix(in srgb, ${color} 50%, transparent), inset 0 0 10px color-mix(in srgb, ${color} 30%, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

const GLYPHS = "가나다라마바사아자차카타파하시스템각격곽궐뇌뭉샴쉼틈흠징◈◇▣▤▥▦▧◐◑⬡⬢";

/** Runic decode text — System speech materializing out of glyphs [E.2] */
export function RunicText({
  text,
  className = "",
  style,
  duration = 420,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
}) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (document.documentElement.classList.contains("fast-mode") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(text);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const revealed = Math.floor(t * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        if (i < revealed || text[i] === " ") out += text[i];
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setDisplay(out);
      if (t < 1) raf = requestAnimationFrame(step);
      else setDisplay(text);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, duration]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}

/** Ambient drifting smoke layer used behind modal windows */
export function Smoke() {
  return <span className="smoke" />;
}

/**
 * Number that animates up/down to its new value instead of snapping —
 * makes stat and currency changes feel earned rather than incidental.
 */
export function CountUp({
  value,
  duration = 620,
  className = "",
  style,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (document.documentElement.classList.contains("fast-mode") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo for a snappy arrival
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const next = from + (value - from) * e;
      fromRef.current = next;
      setShown(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        fromRef.current = value;
        setShown(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const n = Math.round(shown);
  return (
    <span className={className} style={style}>
      {format ? format(n) : n.toLocaleString()}
    </span>
  );
}
