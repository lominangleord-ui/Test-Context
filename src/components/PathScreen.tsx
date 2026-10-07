import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store/game";
import { useUi } from "../store/ui";
import { getPath, getTier, PATH_TIERS } from "../data/monarchPaths";
import { rankFromLevel } from "../data";
import { pathBonuses } from "../lib/monarch";
import { deriveBattleStats } from "../lib/battle";
import { canLearnMove, moveEffect, moveUnlockReason, MOVE_ROLE_COLOR, MOVE_ROLE_LABEL, pathDisplayName } from "../lib/moves";
import { todayISO } from "../lib/utils";
import { SystemWindow } from "./SystemWindow";
import { Bar } from "./common";
import { GateChallenge } from "./GateChallenge";
import type { TierNumber } from "../types";

const SHADOW_ARMY = ["Igris", "Iron", "Elite Knight", "Beru", "Ashborn's Guard"];

export function PathScreen() {
  const s = useGame(useShallow((state) => ({
    monarchPath: state.monarchPath, level: state.level,
    str: state.str, agi: state.agi, vit: state.vit, pts: state.pts, sp: state.sp,
    clearedGates: state.clearedGates, learnedMoves: state.learnedMoves, ascended: state.ascended,
    gateClears: state.gateClears,
    shieldCharges: state.shieldCharges,
    signatureUsedDate: state.signatureUsedDate, fatigueLevel: state.fatigueLevel,
    equippedFlourishId: state.equippedFlourishId,
    useSignatureMove: state.useSignatureMove, setTab: state.setTab,
    learnMove: state.learnMove, blocked: state.inLockdown || state.dead,
  })));
  const path = getPath(s.monarchPath);
  if (!path) return null;
  const tierNumber = getTier(s.level);
  const band = PATH_TIERS[Math.max(0, tierNumber - 1)];
  const next = PATH_TIERS.find((item) => item.min > s.level);
  const bonuses = pathBonuses(s);
  const combat = deriveBattleStats(s);
  const rank = rankFromLevel(s.level);
  const displayName = pathDisplayName(path, s.level);
  const ascended = s.level >= PATH_TIERS[4].min && !!path.monarchTitle;
  const canUseMove = !!bonuses.signature && s.signatureUsedDate !== todayISO()
    && (bonuses.signature.action !== "clearFatigue" || s.fatigueLevel > 0);

  return (
    <div className="path-screen space-y-4" style={{ ["--path-color" as string]: path.color }}>
      <SystemWindow title="MONARCH PATH" accent={path.color}>
        <div className="path-hero">
          <div className="path-hero-icon" aria-hidden="true">{path.icon}</div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[.22em] text-[color:var(--text-dim)]">
              {ascended ? "MONARCH TITLE" : "JOB CLASS"} · {displayName.toUpperCase()}
            </p>
            <h1 className="font-head text-[25px] sm:text-[32px] leading-tight tracking-wide" style={{ color: path.color, textShadow: `0 0 20px ${path.color}66` }}>{displayName}</h1>
            <p className="text-[13px] text-[color:var(--text-mid)] leading-relaxed mt-2">{path.flavor}</p>
            {!ascended && <p className="font-mono text-[10px] mt-1.5" style={{ color: path.color }}>ASCENDS TO {path.monarchTitle.toUpperCase()} AT LEVEL {PATH_TIERS[4].min}</p>}
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

      <SystemWindow title="PATH MOVES" accent={path.color}>
        <p className="text-[12px] text-[color:var(--text-mid)] mb-4 leading-relaxed">
          Clearing a Gate unlocks the option to learn its move; learning one spends stat points. Every point
          spent here is a point not spent on STR / AGI / VIT, so moves are a trade, not a free bonus.
          <b className="text-[color:var(--text-bright)]"> Strike</b> is always available and free.
        </p>
        <div className="space-y-2">
          {path.moves.map((move) => {
            const learned = s.learnedMoves.includes(move.id);
            const ready = canLearnMove(s, move);
            const reason = moveUnlockReason(s, move);
            const color = MOVE_ROLE_COLOR[move.role];
            return (
              <div key={move.id} className={`path-move ${learned ? "learned" : ready ? "ready" : "locked"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-sys text-[12px] font-bold tracking-wide text-[color:var(--text-bright)]">
                      {move.name}
                    </span>
                    <span
                      className="font-sys text-[7.5px] tracking-[0.2em] px-1.5 py-0.5 border"
                      style={{ color, borderColor: `${color}66` }}
                    >
                      {MOVE_ROLE_LABEL[move.role]}
                    </span>
                  </div>
                  <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mt-1">
                    TIER {move.tier} · {moveEffect(move)}
                  </p>
                  <p className="font-mono text-[9px] mt-1" style={{ color: learned ? "var(--green)" : ready ? color : "var(--text-dim)" }}>
                    {learned ? "LEARNED" : ready ? `READY TO LEARN · ${move.cost} PTS` : reason?.toUpperCase()}
                  </p>
                </div>
                <button
                  className="sl-btn shrink-0 text-[10px] px-3"
                  style={{ borderColor: learned ? "var(--green-dim)" : undefined }}
                  disabled={learned || !ready || s.blocked}
                  onClick={() => s.learnMove(move.id)}
                >
                  {learned ? "LEARNED" : `LEARN / ${move.cost}`}
                </button>
              </div>
            );
          })}
        </div>
      </SystemWindow>

      {(s.gateClears.length > 0 || s.learnedMoves.length > 0) && <SystemWindow title="GATE LOG" accent={path.color}>
        <p className="font-sys text-[9.5px] tracking-[0.14em] text-[color:var(--text-dim)] mb-2">
          PERMANENT RECORD — EACH TRIAL CLEARED, AND THE MOVE IT OPENED
        </p>
        <div className="space-y-1.5">
          {path.moves.map((move) => {
            const clear = s.gateClears.find((entry) => entry.tier === move.tier);
            const learned = s.learnedMoves.includes(move.id);
            return (
              <div key={move.id} className="p-2.5 border border-[#ffffff12] bg-[#04101d66]">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-sys text-[11px] font-600 tracking-[0.06em] text-[color:var(--text-bright)]">
                    {move.tier}. {path.tiers[move.tier - 1].gateName}
                  </span>
                  <span className="font-mono text-[9.5px] text-[color:var(--text-faint)] shrink-0">
                    {clear ? clear.date : "NOT CLEARED"}
                  </span>
                </div>
                <div className="font-mono text-[9px] mt-1" style={{ color: learned ? "var(--green)" : "var(--text-dim)" }}>
                  {move.name.toUpperCase()} · {learned ? "LEARNED" : clear ? "AVAILABLE TO LEARN" : "STILL SEALED"}
                </div>
              </div>
            );
          })}
        </div>
      </SystemWindow>}

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
            <div className="font-mono text-[9px] tracking-[0.2em] text-[color:var(--text-dim)]">ONCE-PER-DAY PATH ABILITY</div>
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
  const s = useGame(useShallow((state) => ({ monarchPath: state.monarchPath, clearedGates: state.clearedGates, level: state.level })));
  const toggleSkillTree = useUi((u) => u.toggleSkillTree);
  const path = getPath(s.monarchPath);
  if (!path) return null;
  const next = PATH_TIERS.find((tier) => tier.min <= s.level && !s.clearedGates.includes(tier.number));
  return <button className="path-preview" style={{ ["--path-color" as string]: path.color }} onClick={toggleSkillTree}>
    <span className="path-preview-icon" aria-hidden="true">{path.icon}</span>
    <span className="min-w-0 flex-1 text-left">
      <span className="block font-sys text-[12px] text-[color:var(--text-bright)] font-bold">{pathDisplayName(path, s.level)}</span>
      <span className="block font-mono text-[10px] mt-1" style={{ color: path.color }}>{next ? `GATE READY · ${path.tiers[next.number - 1].gateName}` : "OPEN SKILL TREE"}</span>
    </span>
    <span className="font-mono text-[16px]" style={{ color: path.color }}>✦</span>
  </button>;
}