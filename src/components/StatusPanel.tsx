import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store/game";
import { rankFromLevel, TITLES, ARCHETYPES } from "../data";
import { getPath, getTier } from "../data/monarchPaths";
import { pathTitle } from "../lib/monarch";
import { SystemWindow, DataRow } from "./SystemWindow";
import { Bar, CountUp } from "./common";
import { useUi } from "../store/ui";
import type { StatKey } from "../types";

/* ── Inline SVG stat glyphs (crisp, not emoji) ── */
const Glyph = {
  str: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 9v6M20 9v6M7 7v10M17 7v10M7 12h10" />
    </svg>
  ),
  agi: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  ),
  vit: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 21s-7.5-4.6-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12c-1.8 4.4-9.3 9-9.3 9Z" />
    </svg>
  ),
  pwr: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="m12 2 3 6 6 1-4.5 4.3 1.1 6.2L12 16.6 6.4 19.5 7.5 13.3 3 9l6-1 3-6Z" />
    </svg>
  ),
  ftg: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  hp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  mp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 2c3.5 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6 6-11Z" />
    </svg>
  ),
};

function StatCell({
  ico,
  label,
  value,
  onPlus,
  canPlus,
}: {
  ico: React.ReactNode;
  label: string;
  value: React.ReactNode;
  onPlus?: () => void;
  canPlus?: boolean;
}) {
  return (
    <div className="stat-cell">
      <span className="stat-ico">{ico}</span>
      <span className="stat-key">{label}</span>
      <span className="stat-colon">:</span>
      <span className="stat-val">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </span>
      {canPlus && onPlus && (
        <button className="stat-plus" onClick={onPlus} aria-label={`Increase ${label}`}>
          +
        </button>
      )}
    </div>
  );
}

function hpStatus(hp: number, hpMax: number) {
  const r = hpMax > 0 ? hp / hpMax : 0;
  if (r <= 0) return { t: "CRITICAL", c: "var(--red)" };
  if (r <= 0.3) return { t: "DANGER", c: "var(--red)" };
  if (r <= 0.6) return { t: "CAUTION", c: "var(--gold)" };
  return { t: "STABLE", c: "var(--green)" };
}

/* ══════════ PROFILE WINDOW (PFP + identity) ══════════ */
export function ProfileWindow() {
  const s = useGame(useShallow((state) => ({
    name: state.name, avatar: state.avatar, level: state.level,
    archetype: state.archetype, equippedTitle: state.equippedTitle,
    monarchPath: state.monarchPath, clearedGates: state.clearedGates,
    hp: state.hp, hpMax: state.hpMax, streak: state.streak, pact: state.pact,
    gold: state.gold, potions: state.potions, relapseTokens: state.relapseTokens,
    staminaDrafts: state.staminaDrafts,
  })));
  const openAvatar = useUi((u) => u.openAvatar);
  const { id: rank, name: rankName, color } = rankFromLevel(s.level);
  const path = getPath(s.monarchPath);
  const pathTitleParts = typeof s.equippedTitle === "string" ? s.equippedTitle.split(":") : [];
  const title = typeof s.equippedTitle === "number"
    ? TITLES.find((t) => t.id === s.equippedTitle)
    : path && pathTitleParts[1] === path.id && s.clearedGates.includes(Number(pathTitleParts[2]) as 1 | 2 | 3 | 4 | 5)
      ? pathTitle(path.id, Number(pathTitleParts[2]) as 1 | 2 | 3 | 4 | 5)
      : null;
  const arch = ARCHETYPES[s.archetype];
  const status = hpStatus(s.hp, s.hpMax);

  return (
    <SystemWindow title="HUNTER PROFILE" titleSize="sm">
      <div className="flex gap-3.5">
        {/* Portrait */}
        <button
          onClick={openAvatar}
          className="pfp-frame w-[104px] h-[128px] sm:w-[116px] sm:h-[142px] group"
          title="Change portrait"
        >
          <span className="pfp-scan" />
          <img src={s.avatar} alt="Hunter portrait" />
          <span className="absolute inset-x-0 bottom-0 z-[3] py-1 text-center font-sys text-[8.5px] tracking-[0.2em] text-[color:var(--cyan-bright)] opacity-0 group-hover:opacity-100 transition-opacity bg-[#020a14dd]">
            CHANGE
          </span>
          {/* rank chip over portrait */}
          <span
            className="rank-badge absolute top-1.5 left-1.5 z-[3] w-7 h-7 text-base"
            style={{ color }}
          >
            {rank}
          </span>
        </button>

        {/* Identity data */}
        <div className="flex-1 min-w-0">
          <div className="font-head text-[26px] leading-none font-bold tracking-[0.06em] text-[color:var(--text-bright)] truncate"
               style={{ textShadow: "0 0 18px var(--cyan-glow)" }}>
            {s.name}
          </div>
          {title && (
            <div className="font-sys text-[10.5px] text-[color:var(--gold)] tracking-[0.12em] mt-0.5 truncate">
              【 {title.icon} {title.name} 】
            </div>
          )}
          <div className="mt-2 space-y-0">
            <DataRow k="Class" v={<span style={{ color }}>{rankName}</span>} />
            <DataRow k="Archetype" v={`${arch.icon} ${arch.name}`} />
            {path && <DataRow k="Job" v={<span style={{ color: path.color }}>{path.jobClass} · {path.name}</span>} />}
            {path && <DataRow k="Tier" v={`${getTier(s.level)} · ${["", "Nascent", "Ascendant", "Dominion", "Sovereign", "Transcendent"][getTier(s.level)]}`} />}
            <DataRow k="Status" v={<span style={{ color: status.c }}>{status.t}</span>} />
            <DataRow k="Streak" v={`${s.streak} day${s.streak === 1 ? "" : "s"}`} />
            {s.pact.active && (
              <DataRow
                k="Pact"
                v={
                  <span style={{ color: "#ff7a8c" }}>
                    🩸{" "}
                    {s.pact.stake === "ironvow"
                      ? "IRON VOW"
                      : s.pact.stake === "forfeit"
                        ? "FORFEIT"
                        : "WITNESSED"}
                  </span>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Currency strip */}
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        {[
          { l: "GOLD", v: s.gold, c: "var(--gold)" },
          { l: "POTION", v: s.potions, c: "var(--green)" },
          { l: "TOKEN", v: s.relapseTokens, c: "var(--purple)" },
          { l: "DRAFT", v: s.staminaDrafts, c: "var(--cyan-bright)" },
        ].map((x) => (
          <div key={x.l} className="text-center border border-[#ffffff12] bg-[#04101d80] py-1.5">
            <div className="font-mono text-[15px] leading-none" style={{ color: x.c, textShadow: `0 0 10px ${x.c}` }}>
              {x.v}
            </div>
            <div className="font-sys text-[8px] tracking-[0.18em] text-[color:var(--text-dim)] mt-1">
              {x.l}
            </div>
          </div>
        ))}
      </div>
    </SystemWindow>
  );
}

/* ══════════ STATUS WINDOW (the classic stat sheet) ══════════ */
export function StatusPanel() {
  const s = useGame(useShallow((state) => ({
    level: state.level, pts: state.pts,
    str: state.str, agi: state.agi, vit: state.vit,
    hp: state.hp, hpMax: state.hpMax, mp: state.mp, mpMax: state.mpMax,
    xp: state.xp, xpMax: state.xpMax, fatigueLevel: state.fatigueLevel,
    inLockdown: state.inLockdown, resurrectDebuff: state.resurrectDebuff,
  })));
  const { id: rank, name: rankName, color } = rankFromLevel(s.level);
  const power = (s.str + s.agi + s.vit) * s.level;
  const alloc = (stat: StatKey) => useGame.getState().allocateStat(stat);
  const canPlus = s.pts > 0 && !s.inLockdown;

  return (
    <SystemWindow title="STATUS">
      {/* LEVEL / RANK / TITLE header row — exactly like the reference */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="font-sys text-[9px] tracking-[0.24em] text-[color:var(--text-dim)]">LEVEL</div>
          <div className="font-head text-[34px] leading-[1] font-black italic text-[color:var(--text-bright)]"
               style={{ textShadow: "0 0 20px var(--cyan)" }}>
            <CountUp value={s.level} />
          </div>
        </div>
        <div className="text-center">
          <div className="font-sys text-[9px] tracking-[0.24em] text-[color:var(--text-dim)]">RANK</div>
          <div className="font-head text-[34px] leading-[1] font-black" style={{ color, textShadow: `0 0 20px ${color}` }}>
            {rank}
          </div>
          <div className="font-sys text-[8px] tracking-wide leading-tight mt-1" style={{ color }}>{rankName}</div>
        </div>
        <div className="text-center">
          <div className="font-sys text-[9px] tracking-[0.24em] text-[color:var(--text-dim)]">POINTS</div>
          <div
            className="font-head text-[34px] leading-[1] font-black"
            style={{
              color: s.pts > 0 ? "var(--gold)" : "var(--text-dim)",
              textShadow: s.pts > 0 ? "0 0 20px var(--gold)" : "none",
            }}
          >
            {s.pts}
          </div>
        </div>
      </div>

      {/* HP / MP block */}
      <div className="border border-[#ffffff12] bg-[#04101d66] p-2.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="stat-ico" style={{ color: "var(--red)" }}>{Glyph.hp}</span>
          <div className="flex-1">
            <Bar value={s.hp} max={s.hpMax} color="var(--red)" label="HP" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="stat-ico" style={{ color: "var(--blue)" }}>{Glyph.mp}</span>
          <div className="flex-1">
            <Bar value={s.mp} max={s.mpMax} color="var(--blue)" label="MP" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="stat-ico">{Glyph.pwr}</span>
          <div className="flex-1">
            <Bar value={s.xp} max={s.xpMax} color="var(--cyan)" label="EXP" />
          </div>
        </div>
      </div>

      {/* Stat grid — 2 columns, icon : value (reference layout) */}
      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
        <StatCell ico={Glyph.str} label="STR" value={s.str} canPlus={canPlus} onPlus={() => alloc("str")} />
        <StatCell ico={Glyph.vit} label="VIT" value={s.vit} canPlus={canPlus} onPlus={() => alloc("vit")} />
        <StatCell ico={Glyph.agi} label="AGI" value={s.agi} canPlus={canPlus} onPlus={() => alloc("agi")} />
        <StatCell ico={Glyph.pwr} label="PWR" value={power} />
        <StatCell ico={Glyph.ftg} label="FTG" value={`${Math.round(s.fatigueLevel)}%`} />
      </div>

      {s.pts > 0 && (
        <div className="text-center font-sys text-[10px] tracking-[0.22em] text-[color:var(--gold)] mt-2.5 animate-pulse">
          {s.pts} POINT{s.pts > 1 ? "S" : ""} AVAILABLE
        </div>
      )}

      {s.resurrectDebuff > 0 && (
        <div className="mt-2 border border-[color:var(--red-dim)] bg-[#ff3b520a] p-2 text-center font-sys text-[10px] tracking-[0.14em] text-[color:var(--red)]">
          RESURRECTION: -1 STR / AGI / VIT. {s.resurrectDebuff} LEVELS TO RECOVER.
        </div>
      )}
    </SystemWindow>
  );
}
