import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store/game";
import { getPath, getTier, PATH_TIERS } from "../data/monarchPaths";
import { rankFromLevel } from "../data";
import { pathBonuses } from "../lib/monarch";
import { deriveBattleStats } from "../lib/battle";
import { todayISO } from "../lib/utils";
import { SystemWindow } from "./SystemWindow";
import { Bar } from "./common";
import { GateChallenge } from "./GateChallenge";
import type { TierNumber } from "../types";

const SHADOW_ARMY = ["Igris", "Iron", "Elite Knight", "Beru", "Ashborn's Guard"];

export function PathScreen() {
  const s = useGame(useShallow((state) => ({
    monarchPath: state.monarchPath, level: state.level,
    str: state.str, agi: state.agi, vit: state.vit,
    clearedGates: state.clearedGates, shieldCharges: state.shieldCharges,
    signatureUsedDate: state.signatureUsedDate, fatigueLevel: state.fatigueLevel,
    equippedFlourishId: state.equippedFlourishId,
    useSignatureMove: state.useSignatureMove, setTab: state.setTab,
  })));
  const path = getPath(s.monarchPath);
  if (!path) return null;
  const tierNumber = getTier(s.level);
  const band = PATH_TIERS[Math.max(0, tierNumber - 1)];
  const next = PATH_TIERS.find((item) => item.min > s.level);
  const bonuses = pathBonuses(s);
  const combat = deriveBattleStats(s);
  const rank = rankFromLevel(s.level);
  const canUseMove = !!bonuses.signature && s.signatureUsedDate !== todayISO()
    && (bonuses.signature.action !== "clearFatigue" || s.fatigueLevel > 0);

  return (
    <div className="path-screen space-y-4" style={{ ["--path-color" as string]: path.color }}>
      <SystemWindow title="MONARCH PATH" accent={path.color}>
        <div className="path-hero">
          <div className="path-hero-icon" aria-hidden="true">{path.icon}</div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[.22em] text-[color:var(--text-dim)]">JOB CLASS · {path.jobClass.toUpperCase()}</p>
            <h1 className="font-head text-[25px] sm:text-[32px] leading-tight tracking-wide" style={{ color: path.color, textShadow: `0 0 20px ${path.color}66` }}>{path.name}</h1>
            <p className="text-[13px] text-[color:var(--text-mid)] leading-relaxed mt-2">{path.flavor}</p>
          </div>
        </div>
        <div className="win-rule" />
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono text-[color:var(--text-mid)]">
          <span>CURRENT TIER <b style={{ color: path.color }}>{tierNumber} / {band.name.toUpperCase()}</b></span>
          <span>PUBLIC RANK <b style={{ color: rank.color }}>{rank.name.toUpperCase()}</b></span>
          <span>SIGNATURE <b style={{ color: path.color }}>{path.signatureExercise.toUpperCase()}</b></span>
        </div>
        {next && <p className="text-[11px] text-[color:var(--text-dim)] mt-3">Next tier at level {next.min} · {Math.max(0, next.min - s.level)} levels away. Gates are untimed and retryable.</p>}
        {next && (
          <div className="mt-2">
            <Bar
              value={Math.max(0, s.level - band.min)}
              max={Math.max(1, next.min - band.min)}
              color={path.color}
              label={`TIER ${tierNumber} → ${next.number}`}
              showText={false}
            />
          </div>
        )}
        {!next && <p className="text-[11px] mt-3" style={{ color: path.color }}>TRANSCENDENT · open-ended. There is no level cap past this point.</p>}
        {bonuses.shieldMax > 0 && <p className="text-[11px] text-[color:var(--gold)] mt-2">STREAK SHIELD · {s.shieldCharges} / {bonuses.shieldMax} charges. Recharges every Monday.</p>}
        {s.equippedFlourishId && <p className="font-mono text-[10px] mt-2" style={{ color: path.color }}>PATH SIGIL ACTIVE · PURELY COSMETIC</p>}
      </SystemWindow>

      <SystemWindow title="COMBAT READINESS" accent={combat.readiness.color}>
        <div className="combat-readiness-grid">
          <div className="combat-readiness-status">
            <div className="font-head text-[19px]" style={{ color: combat.readiness.color }}>{combat.readiness.name}</div>
            <p className="text-[11px] text-[color:var(--text-mid)] mt-1">Fatigue {Math.round(s.fatigueLevel)}% · {combat.readiness.description}</p>
          </div>
          {[
            ["BATTLE HP", combat.maxHP, "VIT"],
            ["ATK", combat.atk, "STR"],
            ["DEF", combat.def, "VIT"],
            ["CRIT", `${Math.round(combat.critChance)}%`, "AGI"],
          ].map(([label, value, source]) => <div className="combat-readiness-stat" key={label}>
            <span>{label}</span><strong>{value}</strong><small>FROM {source}</small>
          </div>)}
        </div>
        <p className="font-mono text-[9px] text-[color:var(--text-dim)] mt-3">Gates use earned STR / AGI / VIT. Levels unlock battles; they do not directly deal damage. Recovery changes readiness, never XP.</p>
      </SystemWindow>

      <SystemWindow title="THE FIVE GATES" accent={path.color}>
        <p className="text-[12px] text-[color:var(--text-mid)] mb-4 leading-relaxed">
          Each milestone unlocks one player-initiated turn-based boss battle using your current character stats. Clear it once for its skill, title and loot. No penalty for losing; retry anytime. No bonus XP.
        </p>
        <div className="space-y-2">
          {PATH_TIERS.map((tier) => <GateChallenge
            key={tier.number}
            path={path}
            tier={tier.number as TierNumber}
            level={s.level}
            cleared={s.clearedGates.includes(tier.number)}
          />)}
        </div>
      </SystemWindow>

      {s.monarchPath === "shadows" && <SystemWindow title="SHADOW ARMY" accent={path.color}>
        <p className="text-[11px] text-[color:var(--text-mid)] mb-3">Only this lineage can extract soldiers. Their names mark cleared Gates; bonuses come from the tier skills above, never passive XP.</p>
        <div className="flex flex-wrap gap-2">
          {PATH_TIERS.map((tier, i) => <span key={tier.number} className="path-soldier" style={{ opacity: s.clearedGates.includes(tier.number) ? 1 : .4 }}>
            {s.clearedGates.includes(tier.number) ? "◆" : "◇"} {SHADOW_ARMY[i]}
          </span>)}
        </div>
      </SystemWindow>}

      {bonuses.signature && <SystemWindow title="MONARCH'S WILL" accent={path.color}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <div className="font-head text-[20px]" style={{ color: path.color }}>{bonuses.signature.name}</div>
            <p className="text-[12px] text-[color:var(--text-mid)]">{bonuses.signature.label}. Never grants XP.</p>
          </div>
          <button className="sl-btn sl-btn-solid w-full sm:w-auto" onClick={s.useSignatureMove} disabled={!canUseMove}>
            {s.signatureUsedDate === todayISO() ? "USED TODAY" : "ACTIVATE"}
          </button>
        </div>
      </SystemWindow>}

      {!bonuses.signature && tierNumber === 5 && s.monarchPath === "iron-body" && <p className="text-center text-[11px] text-[color:var(--text-mid)]">Immovable is a permanent second weekly shield charge, not a daily-use button.</p>}
      <button className="sl-btn w-full" onClick={() => s.setTab("quest")}>RETURN TO DAILY QUEST</button>
    </div>
  );
}

export function PathPreview() {
  const s = useGame(useShallow((state) => ({ monarchPath: state.monarchPath, clearedGates: state.clearedGates, level: state.level, setTab: state.setTab })));
  const path = getPath(s.monarchPath);
  if (!path) return null;
  const next = PATH_TIERS.find((tier) => tier.min <= s.level && !s.clearedGates.includes(tier.number));
  return <button className="path-preview" style={{ ["--path-color" as string]: path.color }} onClick={() => s.setTab("path")}>
    <span className="path-preview-icon" aria-hidden="true">{path.icon}</span>
    <span className="min-w-0 flex-1 text-left">
      <span className="block font-sys text-[12px] text-[color:var(--text-bright)] font-bold">{path.name}</span>
      <span className="block font-mono text-[10px] mt-1" style={{ color: path.color }}>{next ? `GATE READY · ${path.tiers[next.number - 1].gateName}` : "VIEW YOUR MONARCH PATH"}</span>
    </span>
    <span className="font-mono text-[16px]" style={{ color: path.color }}>↗</span>
  </button>;
}