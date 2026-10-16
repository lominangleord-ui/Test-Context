import { useEffect, useRef, useState } from "react";
import { AshenGame } from "../game/view";
import type { GameKey } from "../game/core";

/**
 * The Ashenveil dungeon — a self-contained 640×480 pixel game mounted on a
 * canvas. Keyboard works directly; on touch the d-pad buttons forward to the
 * same Input bus. Game state (route flags, position) persists in its own save;
 * battle rewards flow into the fitness store through useGame actions only.
 */
export function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AshenGame | null>(null);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new AshenGame(canvasRef.current);
    gameRef.current = g;
    g.start();
    setReady(true);
    return () => {
      g.destroy();
      gameRef.current = null;
    };
  }, []);

  const press = (k: GameKey, down: boolean) => gameRef.current?.virtual(k, down);
  const holdProps = (k: GameKey) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); press(k, true); },
    onPointerUp: () => press(k, false),
    onPointerLeave: () => press(k, false),
    onPointerCancel: () => press(k, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const btn = "select-none touch-none active:bg-[#1d2c44] rounded-md border border-[#2c4a66] bg-[#0d1626] text-[#9fb4d8] flex items-center justify-center font-mono";

  return (
    <div className="flex flex-col items-center gap-3 pb-4" style={{ minHeight: "calc(100dvh - 96px)" }}>
      <div className="w-full max-w-[860px] flex items-center justify-between px-1">
        <span className="font-mono text-[11px] tracking-[0.3em] text-[#59708f]">EXPEDITION // BLOCK 9 — FIVE FLOORS</span>
        <button
          className="font-mono text-[11px] text-[#7fe7ff] border border-[#2c4a66] rounded px-2 py-0.5"
          onClick={() => { gameRef.current?.toggleMute(); setMuted((m) => !m); }}
          disabled={!ready}
        >
          {muted ? "♪ OFF" : "♪ ON"}
        </button>
      </div>
      <div
        className="relative w-full max-w-[1120px]"
        style={{ aspectRatio: "16 / 9", maxHeight: "calc(100dvh - 240px)", background: "#000", border: "1px solid #1d2c44", boxShadow: "0 0 40px rgba(11,17,32,0.9), inset 0 0 0 1px rgba(127,231,255,0.08)" }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }}
        />
      </div>
      {/* touch controls — harmless on desktop, necessary on phones */}
      <div className="w-full max-w-[860px] flex items-center justify-between px-2 select-none">
        <div className="grid grid-cols-3 grid-rows-3 gap-1" style={{ width: 132, height: 132 }}>
          <span />
          <button className={btn} style={{ gridArea: "1 / 2" }} {...holdProps("up")}>▲</button>
          <span />
          <button className={btn} style={{ gridArea: "2 / 1" }} {...holdProps("left")}>◀</button>
          <span />
          <button className={btn} style={{ gridArea: "2 / 3" }} {...holdProps("right")}>▶</button>
          <span />
          <button className={btn} style={{ gridArea: "3 / 2" }} {...holdProps("down")}>▼</button>
          <span />
        </div>
        <div className="flex items-center gap-3">
          <button className={btn} style={{ width: 56, height: 56, borderRadius: "50%" }} {...holdProps("menu")}>
            <span className="text-[10px]">SHIFT</span>
          </button>
          <div className="flex flex-col items-center gap-2">
            <button className={btn} style={{ width: 64, height: 64, borderRadius: "50%", color: "#7fff9e" }} {...holdProps("confirm")}>
              Z
            </button>
            <button className={btn} style={{ width: 50, height: 50, borderRadius: "50%", color: "#ff9a9a" }} {...holdProps("cancel")}>
              X
            </button>
          </div>
        </div>
      </div>
      <p className="font-mono text-[10px] text-[#44597a] text-center max-w-[560px] px-3">
        ARROWS/WASD move · Z confirm · X cancel / status · SHIFT dash (LV 5+). Levels come from your real dailies;
        the dungeon pays in skill points. Save at the obelisk.
      </p>
    </div>
  );
}
