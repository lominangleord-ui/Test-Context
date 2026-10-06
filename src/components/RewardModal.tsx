import { useState } from "react";
import { useGame } from "../store/game";
import { SystemWindow } from "./SystemWindow";
import { RunicText, Smoke } from "./common";
import type { StatKey } from "../types";

export function RewardModal() {
  const pending = useGame((s) => s.rewardChoicePending);
  const inLockdown = useGame((s) => s.inLockdown);
  const claim = useGame((s) => s.claimReward);
  const fastMode = useGame((s) => s.settings.fastMode);
  const [statPick, setStatPick] = useState(false);
  const [rolling, setRolling] = useState(false);

  if (!pending || inLockdown) return null;

  const doLoot = () => {
    if (fastMode) {
      claim("loot");
      return;
    }
    setRolling(true);
    setTimeout(() => {
      claim("loot");
      setRolling(false);
    }, 2000);
  };

  const options = [
    { k: "status" as const, ico: "💚", t: "Status Recovery", d: "Full HP / MP restore + fatigue cleared." },
    { k: "stat" as const, ico: "💪", t: "Stat Points", d: "+3 to a stat of your choosing." },
    { k: "loot" as const, ico: "🎁", t: "Loot Box", d: "Recovery, rare tokens, gold, themes or Monarch sigils. No XP gear." },
  ];

  return (
    <div className="fixed inset-0 z-[70] sys-backdrop flex items-center justify-center p-4">
      <Smoke />
      {rolling && (
        <div className="gate-portal">
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
          <span className="gate-ring" />
        </div>
      )}

      <div className="w-full max-w-[400px] relative">
        <SystemWindow title="CHOOSE YOUR REWARD" titleSize="sm" accent="#ffc53d">
          {rolling ? (
            <div className="text-center py-10">
              <div className="text-6xl loot-reveal inline-block">🎁</div>
              <div className="font-head text-xl tracking-[0.4em] text-[color:var(--gold)] mt-4 animate-pulse">
                ROLLING
              </div>
            </div>
          ) : statPick ? (
            <div className="space-y-3">
              <p className="text-center font-sys text-[10px] tracking-[0.24em] text-[color:var(--text-dim)] uppercase">
                Select attribute
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["str", "agi", "vit"] as StatKey[]).map((st) => (
                  <button
                    key={st}
                    className="sl-btn py-4 uppercase tracking-[0.2em] text-sm"
                    onClick={() => {
                      claim("stat", st);
                      setStatPick(false);
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <button className="sl-btn w-full py-2 text-[10px]" onClick={() => setStatPick(false)}>
                BACK
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((o) => (
                <button
                  key={o.k}
                  onClick={() => (o.k === "stat" ? setStatPick(true) : o.k === "loot" ? doLoot() : claim("status"))}
                  className="w-full text-left p-3 border border-[#ffffff12] bg-[#04101d80] flex items-center gap-3 transition-all hover:border-[color:var(--gold)] hover:bg-[#ffc53d0d] hover:shadow-[0_0_18px_#ffc53d22]"
                >
                  <span className="text-2xl leading-none shrink-0">{o.ico}</span>
                  <div>
                    <div className="font-sys text-[13px] font-600 tracking-[0.08em] text-[color:var(--text-bright)]">
                      {o.t}
                    </div>
                    <div className="text-[11px] text-[color:var(--text)]">{o.d}</div>
                  </div>
                </button>
              ))}
              <div className="text-center font-sys text-[9px] tracking-[0.2em] text-[color:var(--text-faint)] pt-1">
                <RunicText text="THE SYSTEM AWAITS YOUR DECISION" duration={700} />
              </div>
            </div>
          )}
        </SystemWindow>
      </div>
    </div>
  );
}
