import { useUi } from "../store/ui";
import { PATH_TIERS, GATE_BOSS_STATS, TIER_TO_KEY } from "../data/monarchPaths";
import type { MonarchPath, TierNumber } from "../types";

export function GateChallenge({
  path,
  tier,
  level,
  cleared,
}: {
  path: MonarchPath;
  tier: TierNumber;
  level: number;
  cleared: boolean;
}) {
  const openGateBattle = useUi((state) => state.openGateBattle);
  const band = PATH_TIERS[tier - 1];
  const unlocked = level >= band.min;
  const bossKey = TIER_TO_KEY[tier];
  const boss = GATE_BOSS_STATS[bossKey];

  return (
    <div className={`path-gate ${cleared ? "cleared" : unlocked ? "available" : "locked"}`}>
      <div className="path-gate-number">{String(tier).padStart(2, "0")}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-x-3 items-center">
          <span className="font-sys text-[12px] font-bold tracking-wide text-[color:var(--text-bright)]">
            {path.tiers[tier - 1].gateName}
          </span>
          <span
            className="font-mono text-[9px]"
            style={{ color: cleared ? "var(--green)" : unlocked ? "var(--path-color)" : "var(--text-dim)" }}
          >
            {cleared ? "CLEARED" : unlocked ? "READY" : `UNLOCKS LV ${band.min}`}
          </span>
        </div>
        <p className="text-[11px] text-[color:var(--text-mid)] mt-1">
          {band.name} · Boss: HP {boss.hp} · ATK {boss.atk} · DEF {boss.def}
        </p>
        {path.tiers[tier - 1].skills.map((skill) => (
          <p key={skill.label} className="text-[10px] mt-1.5" style={{ color: cleared ? "var(--green)" : "var(--text)" }}>
            {skill.label}
          </p>
        ))}
        <p className="font-mono text-[9px] text-[color:var(--text-dim)] mt-1">TITLE: {path.tiers[tier - 1].title}</p>
      </div>
      {unlocked && (
        <button className="sl-btn path-gate-action animate-pulse" onClick={() => openGateBattle(tier)}>
          {cleared ? "REPLAY" : "BATTLE"}
        </button>
      )}
    </div>
  );
}
