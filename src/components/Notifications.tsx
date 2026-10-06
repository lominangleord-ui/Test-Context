import { useGame } from "../store/game";
import { SystemWindow } from "./SystemWindow";
import { RunicText, Smoke } from "./common";

function accentFor(type: string) {
  if (/alert|emergency/i.test(type)) return "#ff3b52";
  if (/system/i.test(type)) return "#ffc53d";
  if (/anticheat/i.test(type)) return "#a855ff";
  return undefined;
}

export function Notifications() {
  const queue = useGame((s) => s.notifications);
  const dismiss = useGame((s) => s.dismissNotify);
  const n = queue[0];
  if (!n) return null;

  return (
    <div className="fixed inset-0 z-[80] sys-backdrop flex items-center justify-center p-5" onClick={dismiss}>
      <Smoke />
      <div className="w-full max-w-[400px] relative" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="NOTIFICATION" titleSize="sm" icon="!" headAlign="left" accent={accentFor(n.type)}>
          <div className="font-sys text-[14px] font-600 tracking-[0.06em] text-[color:var(--text-bright)] mb-1.5">
            <RunicText text={n.title} />
          </div>
          <div
            className="text-[13px] text-[color:var(--text-mid)] leading-relaxed [&_b]:text-[color:var(--cyan-bright)] [&_b]:font-600"
            dangerouslySetInnerHTML={{ __html: n.message }}
          />
          <div className="flex justify-center gap-3 mt-4">
            <button className="sl-btn px-10 py-2" onClick={dismiss}>
              CONFIRM
            </button>
          </div>
        </SystemWindow>
      </div>
    </div>
  );
}
