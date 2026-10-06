import { useEffect, useRef, useState } from "react";

/**
 * SystemWindow — the signature Solo Leveling system frame.
 *
 * Anatomy (matches the manhwa/anime windows):
 *   ┌ wings ─ outer glowing frame ─────────────┐
 *   │  corner ticks                            │
 *   │   ┌ inner hairline border ──────────┐    │
 *   │   │  [ BOXED TITLE ]                │    │
 *   │   │  body…                          │    │
 *   │   └─────────────────────────────────┘    │
 *   └──────────────────────────────────────────┘
 *
 * The "roll open from within" materialization plays on mount: the window
 * snaps to a hairline of light, the beam fires along it, then it unrolls
 * vertically from the centre and the content resolves in.
 */
export function SystemWindow({
  children,
  title,
  icon,
  wings = true,
  animate = true,
  className = "",
  bodyClass = "",
  accent,
  titleSize = "md",
  headAlign = "center",
}: {
  children: React.ReactNode;
  title?: string;
  icon?: string;
  wings?: boolean;
  animate?: boolean;
  className?: string;
  bodyClass?: string;
  accent?: string;
  titleSize?: "sm" | "md";
  headAlign?: "center" | "left";
}) {
  const [opening, setOpening] = useState(animate);
  const done = useRef(false);

  useEffect(() => {
    if (!animate || done.current) return;
    const t = setTimeout(() => {
      setOpening(false);
      done.current = true;
    }, 640);
    return () => clearTimeout(t);
  }, [animate]);

  const accentStyle = accent
    ? ({
        ["--cyan" as any]: accent,
        ["--cyan-dim" as any]: `${accent}40`,
        ["--cyan-glow" as any]: `${accent}1c`,
        ["--cyan-bright" as any]: accent,
        ["--cyan-edge" as any]: accent,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={`sys-win ${opening ? "opening" : ""} ${className}`}
      style={accentStyle}
    >
      {opening && <span className="win-beam" />}
      {wings && (
        <>
          <span className="win-wing l" />
          <span className="win-wing r" />
        </>
      )}
      <div className="win-frame">
        <span className="win-corner tl" />
        <span className="win-corner tr" />
        <span className="win-corner bl" />
        <span className="win-corner br" />

        {title && (
          <div className={`win-head ${headAlign === "left" ? "left" : ""}`}>
            {icon && <span className="sys-icon">{icon}</span>}
            <span className={`win-title ${titleSize === "sm" ? "sm" : "text-[15px]"}`}>
              {title}
            </span>
          </div>
        )}

        <div className="win-inner">
          <div className={`win-body ${bodyClass}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Thin horizontal rule used inside windows */
export function WinRule({ className = "" }: { className?: string }) {
  return <div className={`win-rule ${className}`} />;
}

/** Key/value data row — the "First Name : Jin-woo" style rows */
export function DataRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="data-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
