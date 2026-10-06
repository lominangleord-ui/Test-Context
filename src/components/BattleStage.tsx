import { useState } from "react";
import { RunicText } from "./common";

/**
 * The presentational half of a battle: silhouettes, segmented bars, the message
 * box and the move grid. Both the story fights and the Gate fights drive it with
 * their own rules, so the two screens cannot drift apart visually.
 */

/**
 * Art with a graceful fallback: if a piece has not been generated or fails to
 * load, the silhouette (or nothing) takes its place instead of a broken image.
 */
export function ArtImage({ src, className, alt = "", fallback = null }: { src: string; className?: string; alt?: string; fallback?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}

export function HunterSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" className="battle-silhouette" style={{ color }} aria-hidden="true">
      <circle cx="32" cy="18" r="10" fill="currentColor" />
      <path d="M12 58c0-12 9-21 20-21s20 9 20 21Z" fill="currentColor" />
    </svg>
  );
}

export function BossSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" className="battle-silhouette" style={{ color }} aria-hidden="true">
      <path d="M32 4 20 16 8 12l6 14-6 10 12-2 12 12 12-12 12 2-6-10 6-14-12 4Z" fill="currentColor" />
      <path d="M8 58c0-13 11-22 24-22s24 9 24 22Z" fill="currentColor" />
    </svg>
  );
}

/** Thick, segmented, colour-shifting bar: the single biggest "real RPG" cue. */
export function BattleBar({ value, max, tone }: { value: number; max: number; tone: "player" | "boss" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = pct <= 20 ? "#ff3b52" : pct <= 50 ? "#ffc53d" : tone === "player" ? "#2fe08a" : "#ff8a5b";
  return (
    <div className="battle-bar">
      <div className="battle-bar-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="battle-bar-seg" aria-hidden="true" />
      <span className="battle-bar-text">{Math.max(0, Math.round(value))} / {Math.round(max)}</span>
    </div>
  );
}

export interface Anim {
  hunterLunge: boolean;
  bossLunge: boolean;
  hunterHit: boolean;
  bossHit: boolean;
  bossGuard: boolean;
}

export const NO_ANIM: Anim = { hunterLunge: false, bossLunge: false, hunterHit: false, bossHit: false, bossGuard: false };

export interface StageMove {
  move: { id: string; name: string; role: string };
  unlocked: boolean;
  effect: string;
  tagLabel: string;
  tagColor: string;
  lockReason?: string;
  spent?: boolean;
}

export interface BattleStageProps {
  accent: string;
  /** Enemy box, upper right. */
  enemyName: string;
  enemySubtitle: string;
  enemyHP: number;
  enemyMaxHP: number;
  enemyStats: { atk: number; def: number };
  enemyArt?: string;
  /** Player box, lower left. */
  playerName: string;
  playerHP: number;
  playerMaxHP: number;
  playerStats: { atk: number; def: number; crit: number };
  anim: Anim;
  enemyRef: React.RefObject<HTMLDivElement | null>;
  hunterRef: React.RefObject<HTMLDivElement | null>;
  /** "busy" shows the message box, "menu" the move grid, the rest the result panel. */
  phase: "busy" | "menu" | "victory" | "defeat";
  message: string;
  onAdvance: () => void;
  moves: StageMove[];
  onMove: (id: string) => void;
  legend: { label: string; color: string }[];
  onFinish?: () => void;
  finishLabel?: string;
  children?: React.ReactNode;
}

export function BattleStage(props: BattleStageProps) {
  const { anim, phase } = props;
  return (
    <>
      {/* ── Arena: enemy upper-right, hunter lower-left ── */}
      <div className="battle-arena">
        <div ref={props.enemyRef} className={`battle-side boss ${anim.bossLunge ? "lunge" : ""} ${anim.bossHit ? "hit" : ""} ${anim.bossGuard ? "guard" : ""}`}>
          {props.enemyArt ? (
            <ArtImage className="battle-art" src={props.enemyArt} fallback={<BossSilhouette color={props.accent} />} />
          ) : (
            <BossSilhouette color={props.accent} />
          )}
          <div className="battle-infobox">
            <div className="battle-name" style={{ color: "var(--red)" }}>{props.enemyName}</div>
            <BattleBar value={props.enemyHP} max={props.enemyMaxHP} tone="boss" />
            <div className="battle-stat-row">
              <span>{props.enemySubtitle}</span>
              <span>ATK {props.enemyStats.atk}</span><span>DEF {props.enemyStats.def}</span>
            </div>
          </div>
        </div>

        <div ref={props.hunterRef} className={`battle-side hunter ${anim.hunterLunge ? "lunge" : ""} ${anim.hunterHit ? "hit" : ""}`}>
          <HunterSilhouette color="var(--cyan-bright)" />
          <div className="battle-infobox">
            <div className="battle-name">{props.playerName}</div>
            <BattleBar value={props.playerHP} max={props.playerMaxHP} tone="player" />
            <div className="battle-stat-row">
              <span>ATK {props.playerStats.atk}</span><span>DEF {props.playerStats.def}</span><span>CRIT {props.playerStats.crit}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Message box, then the move grid, then the result ── */}
      {phase === "victory" || phase === "defeat" ? (
        <div className="space-y-3 mt-3">
          <div className={`battle-result ${phase}`}>{phase === "victory" ? "VICTORY" : "DEFEAT"}</div>
          {props.children}
          {props.onFinish && (
            <button className="sl-btn sl-btn-solid w-full" onClick={props.onFinish}>{props.finishLabel ?? "CONTINUE"}</button>
          )}
        </div>
      ) : phase === "menu" ? (
        <div className="battle-messagebox">
          <div className="battle-message-prompt">
            <span className="font-mono text-[9px] tracking-[0.2em] text-[color:var(--text-dim)]">CHOOSE A MOVE</span>
            <span className="battle-cursor" aria-hidden="true">▼</span>
          </div>
          <div className="battle-movegrid" role="group" aria-label="Moves">
            {props.moves.map((entry) => (
              <button
                key={entry.move.id}
                className={`battle-move ${entry.unlocked && !entry.spent ? "" : "locked"}`}
                disabled={!entry.unlocked || entry.spent}
                title={entry.unlocked ? entry.lockReason : entry.lockReason}
                onClick={() => props.onMove(entry.move.id)}
              >
                <span className="battle-move-head">
                  <span className="battle-move-name">
                    {entry.unlocked ? entry.spent ? `✓ ${entry.move.name}` : entry.move.name : `🔒 ${entry.move.name}`}
                  </span>
                  <span className="battle-move-tag" style={{ color: entry.tagColor, borderColor: `${entry.tagColor}66` }}>
                    {entry.tagLabel}
                  </span>
                </span>
                <span className="battle-move-effect">{entry.effect}</span>
              </button>
            ))}
          </div>
          {props.legend.length > 0 && (
            <div className="battle-legend" aria-hidden="true">
              {props.legend.map((entry) => (
                <span key={entry.label} style={{ color: entry.color }}>{entry.label}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button className="battle-messagebox dialogue" onClick={props.onAdvance} type="button">
          <span className="font-mono text-[11.5px] leading-relaxed" aria-live="polite">
            <span className="text-[color:var(--text-faint)]">&gt;&nbsp;</span>
            <RunicText text={props.message} duration={300} />
          </span>
          <span className="battle-cursor" aria-hidden="true">▼</span>
          <span className="battle-tap-hint font-mono text-[8.5px] tracking-[0.2em] text-[color:var(--text-faint)]">TAP TO CONTINUE</span>
        </button>
      )}
    </>
  );
}
