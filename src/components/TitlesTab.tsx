import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store/game";
import { TITLES } from "../data";
import { getPath, PATH_TIERS, gateTitleId } from "../data/monarchPaths";
import { SystemWindow } from "./SystemWindow";

export function TitlesTab() {
  const s = useGame(useShallow((state) => ({
    level: state.level, streak: state.streak,
    notifiedTitles: state.notifiedTitles, equippedTitle: state.equippedTitle,
    monarchPath: state.monarchPath, clearedGates: state.clearedGates,
  })));
  const unlockedIds = s.notifiedTitles;
  const equipTitle = useGame((st) => st.equipTitle);
  const path = getPath(s.monarchPath);

  return (
    <div className="space-y-4">
      <SystemWindow title="TITLES">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {TITLES.map((t) => {
            // LIVE eligibility — mirrors the store's equipTitle() guard, so
            // a streak title whose streak has reset shows as EXPIRED here.
            const currentlyValid =
              (t.level == null || s.level >= t.level) &&
              (t.streak == null || s.streak >= t.streak);
            const everUnlocked = unlockedIds.includes(t.id);
            const expired = everUnlocked && !currentlyValid;
            const equipped = s.equippedTitle === t.id;
            return (
              <button
                key={t.id}
                disabled={!currentlyValid}
                onClick={() => equipTitle(t.id)}
                className="text-left p-2.5 border flex items-center gap-2.5 transition-all"
                style={{
                  borderColor: equipped
                    ? "var(--gold)"
                    : expired
                      ? "var(--red-dim)"
                      : "#ffffff12",
                  background: equipped ? "#ffc53d0d" : expired ? "#ff3b5206" : "#04101d66",
                  opacity: currentlyValid ? 1 : expired ? 0.55 : 0.38,
                  boxShadow: equipped ? "0 0 18px #ffc53d22" : "none",
                  cursor: currentlyValid ? "pointer" : "default",
                }}
              >
                <span className="text-2xl leading-none shrink-0">
                  {currentlyValid || expired ? t.icon : "🔒"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-sys text-[12px] font-600 tracking-[0.1em] text-[color:var(--text-bright)]">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-[color:var(--text)] mt-0.5">{t.desc}</div>
                </div>
                {equipped && (
                  <span className="font-sys text-[8px] tracking-[0.2em] text-[color:var(--gold)] shrink-0">
                    ACTIVE
                  </span>
                )}
                {expired && (
                  <span className="font-sys text-[8px] tracking-[0.2em] text-[color:var(--red)] shrink-0">
                    EXPIRED
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SystemWindow>

      {path && <SystemWindow title="PATH TITLES" accent={path.color}>
        <p className="text-[11px] text-[color:var(--text-mid)] mb-3">A permanent title for each cleared Monarch Gate. Only titles from your chosen path can be equipped.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PATH_TIERS.map((band) => {
            const cleared = s.clearedGates.includes(band.number);
            const id = gateTitleId(path.id, band.number);
            const equipped = s.equippedTitle === id;
            return <button key={band.number} disabled={!cleared} className="p-3 border text-left" onClick={() => equipTitle(id)} style={{ borderColor: equipped ? path.color : "#ffffff20", opacity: cleared ? 1 : .45 }}>
              <div className="font-sys text-[12px] font-bold text-[color:var(--text-bright)]">{path.icon} Cleared: {path.tiers[band.number - 1].gateName}</div>
              <div className="font-mono text-[9px] mt-1" style={{ color: cleared ? path.color : "var(--text-dim)" }}>{equipped ? "EQUIPPED" : cleared ? `${band.name.toUpperCase()} · TAP TO EQUIP` : `LOCKED · TIER ${band.number}`}</div>
            </button>;
          })}
        </div>
      </SystemWindow>}

    </div>
  );
}
