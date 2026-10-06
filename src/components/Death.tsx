import { useGame } from "../store/game";
import { RunicText, Smoke } from "./common";

export function Death() {
  const dead = useGame((s) => s.dead);
  const confirm = useGame((s) => s.deathConfirm);
  const cause = useGame((s) => s.deathCause);
  const avatar = useGame((s) => s.avatar);
  const pact = useGame((s) => s.pact);
  const resurrect = useGame((s) => s.resurrect);
  const requestOblivion = useGame((s) => s.requestOblivion);

  if (!dead) return null;
  const ironVow = pact.active && pact.stake === "ironvow";

  return (
    <div className="fixed inset-0 z-[90] bg-black flex items-center justify-center p-6" style={{ animation: "fadeIn 1.2s ease both" }}>
      <Smoke />
      <div className="text-center max-w-[460px] w-full space-y-6 relative">
        <div className="pfp-frame w-[92px] h-[112px] mx-auto grayscale opacity-45">
          <img src={avatar} alt="" />
        </div>

        <div>
          <div className="death-title text-[38px] sm:text-[52px]">YOU HAVE DIED</div>
          <div className="font-mono text-[10.5px] text-[color:#ff8b9c] mt-1.5 tracking-wider">
            {cause.toUpperCase() || "HUNTER DEFEATED"}
          </div>
        </div>

        <div className="mx-auto w-40 h-px bg-gradient-to-r from-transparent via-[color:var(--red)] to-transparent" />

        <p className="font-body text-[17px] text-[color:var(--text-mid)] italic leading-relaxed px-2">
          <RunicText
            text="The System asks one final question: 'Do you wish to arise again?'"
            duration={1600}
          />
        </p>

        {ironVow && (
          <div className="p-3 border border-[color:var(--blood)] bg-[#c8143214] text-left">
            <div className="font-head text-[13px] font-800 italic tracking-[0.06em] text-[color:#ff7a8c]">
              🩸 IRON VOW IN EFFECT
            </div>
            <p className="text-[11.5px] text-[color:var(--text-mid)] leading-relaxed mt-1">
              You swore to <b className="text-[color:var(--text-bright)]">{pact.witness}</b> that
              death would be final. Arising will{" "}
              <b className="text-[color:#ff7a8c]">permanently erase</b> this hunter — every level,
              item and Monarch path. The local pact ledger is kept.
            </p>
          </div>
        )}

        {!confirm ? (
          <div className="space-y-2.5 pt-1">
            <button
              className={`sl-btn w-full py-4 text-base font-head tracking-[0.42em] ${
                ironVow ? "sl-btn-blood" : "sl-btn-solid"
              }`}
              onClick={() => {
                if (
                  ironVow &&
                  !window.confirm(
                    "IRON VOW: this permanently deletes your hunter and everything earned. Continue?",
                  )
                )
                  return;
                resurrect();
              }}
            >
              {ironVow ? "ACCEPT ERASURE" : "YES — ARISE AGAIN"}
            </button>
            <button className="sl-btn sl-btn-danger w-full py-3.5 font-head tracking-[0.34em]" onClick={requestOblivion}>
              NO — ACCEPT OBLIVION
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            <p className="font-sys text-[11px] tracking-[0.18em] text-[color:var(--red)]">
              ⚠ OBLIVION IS PERMANENT FOR THIS HUNTER
            </p>
            <button className="sl-btn sl-btn-danger w-full py-4 font-head tracking-[0.34em]" onClick={requestOblivion}>
              CONFIRM OBLIVION
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
