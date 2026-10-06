import { useGame } from "../store/game";
import { SystemWindow } from "./SystemWindow";
import { ARCHETYPES } from "../data";

export function SpecialQuestBanner() {
  const active = useGame((s) => s.specialActive);
  const quest = useGame((s) => s.specialQuest);
  const complete = useGame((s) => s.completeSpecial);
  const dismiss = useGame((s) => s.dismissSpecial);
  const archetype = useGame((s) => s.archetype);
  if (!active || !quest) return null;

  return (
    <SystemWindow title="SPECIAL QUEST" titleSize="sm" accent="#ffc53d">
      <div className="font-sys text-[14px] font-600 tracking-[0.08em] text-[color:var(--text-bright)]">
        {quest.name}
      </div>
      <div className="text-[12px] text-[color:var(--text)] mt-1 leading-snug">{quest.desc}</div>
      <div className="font-mono text-[10.5px] text-[color:var(--gold)] mt-2">
        REWARD · +{Math.round(quest.xp * ARCHETYPES[archetype].xpMult)} XP
        {quest.stat ? ` · +${quest.statAmt} ${quest.stat.toUpperCase()}` : ""} · 5% TOKEN DROP ON CLEAR
      </div>
      <div className="flex gap-2 mt-3">
        <button className="sl-btn sl-btn-gold flex-1 py-2" onClick={complete}>
          COMPLETE
        </button>
        <button className="sl-btn sl-btn-danger px-4 py-2" onClick={dismiss}>
          DISMISS
        </button>
      </div>
    </SystemWindow>
  );
}
