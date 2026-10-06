import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGame, isSaveFile } from "../store/game";
import { useUi } from "../store/ui";
import { SystemWindow } from "./SystemWindow";
import { download, SAVE_KEY } from "../lib/utils";
import { voice } from "../lib/audio";
import { disableBackgroundReminders, enableRemindersFromGesture, notificationsSupported, sendReminderTest } from "../lib/reminders";

function Toggle({
  on,
  onClick,
  label,
  desc,
  color = "var(--cyan)",
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  desc: string;
  color?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-2.5 border border-[#ffffff12] bg-[#04101d66]">
      <div className="flex-1 min-w-0">
        <div className="font-sys text-[12px] font-600 tracking-[0.08em] text-[color:var(--text-bright)]">
          {label}
        </div>
        <div className="text-[10.5px] text-[color:var(--text)] mt-0.5 leading-relaxed">{desc}</div>
      </div>
      <button
        onClick={onClick}
        className="shrink-0 w-12 h-6 border relative transition-all"
        style={{ borderColor: on ? color : "var(--text-faint)", background: on ? `color-mix(in srgb, ${color} 10%, transparent)` : "transparent" }}
        role="switch"
        aria-checked={on}
        aria-label={label}
      >
        <span
          className="absolute top-[3px] w-[16px] h-[16px] transition-all"
          style={{
            left: on ? "26px" : "3px",
            background: on ? color : "var(--text-dim)",
            boxShadow: on ? `0 0 10px ${color}` : "none",
          }}
        />
      </button>
    </div>
  );
}

export function SettingsModal() {
  const open = useUi((s) => s.settingsOpen);
  const closeAll = useUi((s) => s.closeAll);
  const s = useGame(useShallow((state) => ({
    settings: state.settings,
    toggleAdaptive: state.toggleAdaptive, toggleHardcore: state.toggleHardcore,
    toggleVoice: state.toggleVoice, toggleShake: state.toggleShake,
    toggleFloaters: state.toggleFloaters,
    toggleFastMode: state.toggleFastMode,
    setRemindersEnabled: state.setRemindersEnabled,
  })));
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmHc, setConfirmHc] = useState(false);
  const [testingReminder, setTestingReminder] = useState(false);

  if (!open) return null;

  const doImport = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result));
        const data = parsed.state ?? parsed;
        if (!isSaveFile(data)) {
          alert("Invalid save file shape.");
          return;
        }
        if (confirm("Overwrite current save with imported data?")) {
          useGame.getState().importState(data);
          location.reload();
        }
      } catch {
        alert("Could not parse save file.");
      }
    };
    r.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[65] sys-backdrop flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-[480px] max-h-[88vh] overflow-y-auto">
        <SystemWindow title="SYSTEM SETTINGS">
          <div className="flex justify-end mb-2.5">
            <button onClick={closeAll} className="sl-btn px-3 py-1 text-[10px]">
              CLOSE
            </button>
          </div>

          <div className="space-y-1.5">
            <Toggle
              on={s.settings.fastMode}
              onClick={s.toggleFastMode}
              label="Fast Mode"
              desc="Low-end mode: pauses the mana canvas and removes decorative motion, blur, scan sweeps, glow-heavy transitions and screen effects. Workouts, camera counting, battles and progression still work."
              color="var(--green)"
            />
            <Toggle
              on={s.settings.adaptiveMode}
              onClick={s.toggleAdaptive}
              label="Adaptive Mode"
              desc="Scales daily targets to body state (Recovery / Overdrive). OFF = Classic."
            />
            <Toggle
              on={s.settings.hardcoreMode}
              onClick={() => (s.settings.hardcoreMode ? s.toggleHardcore() : setConfirmHc(true))}
              label="Hardcore Mode"
              desc="Death applies a temporary stat debuff that heals over 3 levels."
              color="var(--red)"
            />
            <Toggle
              on={s.settings.voiceCounting}
              onClick={() => {
                s.toggleVoice();
                if (!s.settings.voiceCounting && voice.supported()) voice.say("Voice counting enabled");
              }}
              label="Voice Rep Counting"
              desc="Speaks rep numbers aloud during camera verification."
            />
            <Toggle
              on={s.settings.screenShake}
              onClick={s.toggleShake}
              label="Screen Shake & Impact"
              desc="Camera shake and colour flashes on damage, clears and level-ups."
            />
            <Toggle
              on={s.settings.floatingNumbers}
              onClick={s.toggleFloaters}
              label="Floating Combat Text"
              desc="Damage, XP and gold numbers pop off the screen as you play."
            />
            <Toggle
              on={s.settings.remindersEnabled}
              onClick={() => {
                if (s.settings.remindersEnabled) {
                  s.setRemindersEnabled(false);
                  void disableBackgroundReminders();
                }
                else void enableRemindersFromGesture();
              }}
              label="Enable Reminders"
              desc="System notifications for incomplete dailies. Requires permission; open-tab checks work everywhere, closed-app checks are best-effort on some installed PWAs."
            />
          </div>

          <div className="mt-3 text-[12px] leading-relaxed text-[color:var(--text-mid)]">
            Reopen reminders work across browsers. Installed Chromium PWAs may receive best-effort checks while closed, but the browser controls timing and may delay or skip them; exact six-hour delivery after closing the app requires a push server, which this app does not use. iOS requires a supported Home Screen app.
          </div>
          {s.settings.remindersEnabled && <div className="mt-2">
            <div className="font-mono text-[10px] text-[color:var(--text)] mb-2">
              PERMISSION: {notificationsSupported() ? Notification.permission.toUpperCase() : "UNAVAILABLE"}
            </div>
            <button className="sl-btn w-full text-[10px]" disabled={testingReminder} onClick={async () => {
              setTestingReminder(true);
              try { await sendReminderTest(); }
              finally { setTestingReminder(false); }
            }}>{testingReminder ? "SENDING TEST..." : "SEND TEST NOTIFICATION"}</button>
          </div>}

          {confirmHc && (
            <div className="mt-2.5 p-3 border border-[color:var(--red)] bg-[#ff3b520a] space-y-2.5">
              <p className="font-sys text-[11px] tracking-[0.1em] text-[color:var(--red)]">
                ⚠ This makes death meaningfully harder. Are you sure?
              </p>
              <div className="flex gap-2">
                <button
                  className="sl-btn sl-btn-danger flex-1 py-1.5 text-[10px]"
                  onClick={() => {
                    s.toggleHardcore();
                    setConfirmHc(false);
                  }}
                >
                  YES, ENABLE
                </button>
                <button className="sl-btn flex-1 py-1.5 text-[10px]" onClick={() => setConfirmHc(false)}>
                  CANCEL
                </button>
              </div>
            </div>
          )}

          <div className="font-sys text-[9px] tracking-[0.3em] text-[color:var(--text-dim)] uppercase mt-4 mb-2">
            Save Data
          </div>
          <div className="flex gap-2">
            <button
              className="sl-btn flex-1 py-2 text-[10px]"
              onClick={() => download(`the-system-${Date.now()}.json`, localStorage.getItem(SAVE_KEY) ?? "{}")}
            >
              ⬇ EXPORT
            </button>
            <button className="sl-btn flex-1 py-2 text-[10px]" onClick={() => fileRef.current?.click()}>
              ⬆ IMPORT
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
          <button
            className="sl-btn sl-btn-danger w-full py-2 mt-2 text-[10px]"
            onClick={() => {
              if (confirm("Erase this hunter and all training progress? The local pact ledger is kept.")) {
                useGame.getState().hardReset();
                location.reload();
              }
            }}
          >
            ⚠ RESET CHARACTER
          </button>

          <p className="text-center font-sys text-[8.5px] tracking-[0.24em] text-[color:var(--text-faint)] uppercase mt-4">
            The System · 100% client-side · fan project
          </p>
        </SystemWindow>
      </div>
    </div>
  );
}
