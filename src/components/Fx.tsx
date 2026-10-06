import { useEffect, useState } from "react";
import { useGame } from "../store/game";
import { rankFromLevel } from "../data";
import { RunicText } from "./common";
import { SystemWindow } from "./SystemWindow";
import { audio } from "../lib/audio";
import { getPath, PATH_TIERS } from "../data/monarchPaths";

export function LevelUpFx() {
  const show = useGame((s) => s.levelUpFx);
  const level = useGame((s) => s.level);
  const clear = useGame((s) => s.clearLevelUpFx);
  const fastMode = useGame((s) => s.settings.fastMode);

  useEffect(() => {
    if (show) {
      audio.levelUp();
      const id = setTimeout(clear, fastMode ? 300 : 2000);
      return () => clearTimeout(id);
    }
  }, [show, clear, fastMode]);

  if (!show) return null;
  const particles = Array.from({ length: 44 }, (_, i) => {
    const a = (i / 44) * Math.PI * 2;
    const d = 160 + Math.random() * 200;
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d };
  });

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center pointer-events-none">
      <div className="relative">
        {particles.map((p, i) => (
          <span key={i} className="lp-particle" style={{ ["--dx" as any]: `${p.dx}px`, ["--dy" as any]: `${p.dy}px` }} />
        ))}
        <div className="w-[280px]">
          <SystemWindow title="NOTIFICATION" titleSize="sm" icon="!" headAlign="left">
            <div className="text-center py-1">
              <div className="font-head text-[30px] font-black tracking-[0.2em] text-[color:var(--cyan-bright)] glow-text">
                <RunicText text="LEVEL UP!" duration={520} />
              </div>
              <div className="font-mono text-[15px] text-[color:var(--text-bright)] mt-1">LV {level}</div>
            </div>
          </SystemWindow>
        </div>
      </div>
    </div>
  );
}

export function RankUpFx() {
  const rank = useGame((s) => s.rankUpFx);
  const level = useGame((s) => s.level);
  const clear = useGame((s) => s.clearRankUpFx);
  const fastMode = useGame((s) => s.settings.fastMode);

  useEffect(() => {
    if (rank) {
      audio.rankUp();
      const id = setTimeout(clear, fastMode ? 350 : 3200);
      return () => clearTimeout(id);
    }
  }, [rank, clear, fastMode]);

  if (!rank) return null;
  const { color, name } = rankFromLevel(level);

  return (
    <div className="fixed inset-0 z-[76] grid place-items-center pointer-events-none">
      <div className="text-center space-y-4" style={{ animation: "fadeIn 400ms ease both" }}>
        <div className="rank-badge w-[132px] h-[132px] text-[80px] mx-auto" style={{ color }}>
          {rank}
        </div>
        <div className="font-head text-[30px] sm:text-[38px] font-black tracking-[0.36em]" style={{ color, textShadow: `0 0 40px ${color}` }}>
          <RunicText text={`RANK ${rank}`} duration={700} />
        </div>
        <div className="font-sys text-[10px] tracking-[0.2em] text-[color:var(--text-dim)]">{name.toUpperCase()} ATTAINED</div>
      </div>
    </div>
  );
}

/**
 * The Tier-5 ascension. Learning the ultimate retires the job class name and
 * replaces it with the Monarch title everywhere, so it reuses the Awaken
 * sequence's typed-line rhythm rather than a plain notification.
 */
export function AscensionFx() {
  const show = useGame((s) => s.ascensionFx);
  const monarchPath = useGame((s) => s.monarchPath);
  const clear = useGame((s) => s.clearAscensionFx);
  const fastMode = useGame((s) => s.settings.fastMode);
  const [lines, setLines] = useState(0);
  const path = getPath(monarchPath);

  const script = path
    ? ["The Nascent trials end here.", `You are no longer ${path.jobClass}.`, `Rise, ${path.monarchTitle}.`]
    : [];

  useEffect(() => {
    if (!show) return;
    setLines(fastMode ? 3 : 0);
    if (fastMode) {
      const quick = window.setTimeout(clear, 400);
      return () => window.clearTimeout(quick);
    }
    const timers: number[] = [];
    script.forEach((_, index) => {
      timers.push(window.setTimeout(() => { setLines(index + 1); audio.repBeep(); }, 900 + index * 950));
    });
    timers.push(window.setTimeout(() => audio.levelUp(), 900 + script.length * 950));
    timers.push(window.setTimeout(clear, 900 + script.length * 950 + 2600));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, fastMode, monarchPath]);

  if (!show || !path) return null;

  return (
    <div className="gate-clear-overlay fixed inset-0 z-[78] sys-backdrop flex items-center justify-center p-5" role="dialog" aria-label="Ascension">
      <div className="gate-portal" style={{ ["--cyan" as string]: path.color }} aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <span key={index} className="gate-ring" />)}
      </div>
      <div className="w-full max-w-[560px] relative z-[1]">
        <SystemWindow title="ASCENSION" accent={path.color}>
          <div className="text-center py-4">
            <div className="font-kr text-[34px]" style={{ color: path.color, textShadow: `0 0 30px ${path.color}` }}>
              <RunicText text="각성" duration={700} />
            </div>
            <p className="font-mono text-[9.5px] tracking-[.24em] text-[color:var(--text-dim)] mt-2">
              TIER 5 · {PATH_TIERS[4].name.toUpperCase()} · LEVEL {PATH_TIERS[4].min}+
            </p>
          </div>
          <div className="min-h-[112px] flex flex-col justify-center gap-2.5 font-mono text-[12.5px] sm:text-[14px] tracking-wider">
            {script.slice(0, lines).map((line, index) => (
              <div key={line} className="slide-up">
                <span className="text-[color:var(--text-faint)]">&gt;&nbsp;</span>
                <RunicText
                  text={line}
                  duration={420}
                  className={index === script.length - 1 ? "typing-caret" : undefined}
                  style={index === script.length - 1 ? { color: path.color } : { color: "var(--cyan-bright)" }}
                />
              </div>
            ))}
          </div>
          <div className="win-rule" />
          <button className="sl-btn sl-btn-solid w-full" onClick={clear}>
            CONTINUE
          </button>
        </SystemWindow>
      </div>
    </div>
  );
}

export function GateClearFx() {
  const scene = useGame((s) => s.gateClearFx);
  const clear = useGame((s) => s.clearGateFx);
  const fastMode = useGame((s) => s.settings.fastMode);

  useEffect(() => {
    if (!scene) return;
    const timer = window.setTimeout(clear, fastMode ? 400 : 3000);
    return () => window.clearTimeout(timer);
  }, [scene, clear, fastMode]);

  if (!scene) return null;
  const path = getPath(scene.path);
  if (!path) return null;
  const extracted = path.id === "shadows" && scene.tier === 1;

  return <div className="gate-clear-overlay fixed inset-0 z-[77] sys-backdrop flex items-center justify-center p-5" role="dialog" aria-label="Monarch Gate cleared">
    <div className="gate-portal" style={{ ["--cyan" as string]: path.color }} aria-hidden="true">
      {[0, 1, 2].map((index) => <span key={index} className="gate-ring" />)}
    </div>
    <div className="w-full max-w-[480px] relative z-[1]" style={{ ["--path-color" as string]: path.color }}>
      <SystemWindow title={extracted ? "SHADOW EXTRACTION" : "GATE CLEARED"} accent={path.color}>
        <div className="text-center py-5 space-y-3">
          <div className="font-kr text-[38px]" style={{ color: path.color, textShadow: `0 0 30px ${path.color}` }}>
            <RunicText text={extracted ? "추출" : path.icon} duration={600} />
          </div>
          <p className="font-mono text-[10px] tracking-[.2em] text-[color:var(--text-dim)]">TIER {scene.tier} · {PATH_TIERS[scene.tier - 1].name.toUpperCase()}</p>
          <h2 className="font-head text-[25px] sm:text-[30px]" style={{ color: path.color, textShadow: `0 0 22px ${path.color}` }}>
            {extracted ? "IGRIS · ARISE" : path.tiers[scene.tier - 1].gateName}
          </h2>
          <p className="text-[12px] text-[color:var(--text-mid)]">{extracted ? "Your first shadow answers the call. No passive XP bonus." : `Title unlocked: ${path.tiers[scene.tier - 1].title}`}</p>
          <button className="sl-btn w-full mt-3" onClick={clear}>CONTINUE</button>
        </div>
      </SystemWindow>
    </div>
  </div>;
}

