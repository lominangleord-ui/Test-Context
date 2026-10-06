import { useGame } from "../store/game";
import { SystemWindow } from "./SystemWindow";

export function LogTab() {
  const history = useGame((s) => s.history);

  return (
    <div className="space-y-4">
      <SystemWindow title="COMBAT LOG">
        {history.length === 0 ? (
          <p className="font-sys text-[11px] tracking-[0.1em] text-[color:var(--text-dim)] text-center py-6">
            NO ENTRIES YET
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-1">
            {history.map((h, i) => (
              <div key={i} className="quest-item p-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[11px] text-[color:var(--cyan-bright)]">{h.date}</span>
                  <span className="font-mono text-[11px] text-[color:var(--green)]">+{h.xpGain} XP</span>
                </div>
                <div className="text-[10px] text-[color:var(--text-dim)] mt-1 font-sys tracking-[0.06em]">
                  {h.items.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </SystemWindow>

    </div>
  );
}
