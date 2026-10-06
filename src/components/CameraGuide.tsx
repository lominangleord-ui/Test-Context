import type { CameraExercise } from "../types";

export const CAMERA_GUIDES: Record<CameraExercise, { text: string; distance: string; path: string }> = {
  push: {
    text: "Place the phone side-on, about 2 m away. Keep it low enough to see your arms and torso while you are on the floor. Frame your whole body if possible.",
    distance: "SIDE VIEW / ABOUT 2 M",
    path: "M73 48 96 62 121 70 161 72 M96 62 102 89 123 92 M161 72 183 87 202 92",
  },
  sit: {
    text: "Set the phone low, at hip height, about 1.5 m away and side-on. Keep your shoulder, hip and knee visible through both the curl and the return.",
    distance: "SIDE VIEW / ABOUT 1.5 M",
    path: "M104 42 116 61 151 86 178 70 199 92 M116 61 142 68 159 66",
  },
  squat: {
    text: "Prop the phone upright about 2.5 m away and side-on. Frame your whole body, including your feet. Give your knees and hips room to move in the frame.",
    distance: "SIDE VIEW / ABOUT 2.5 M",
    path: "M144 24 144 41 156 63 133 81 143 100 M144 41 164 47 184 46",
  },
};

export function CameraGuide({ exercise, compact = false }: { exercise: CameraExercise; compact?: boolean }) {
  const guide = CAMERA_GUIDES[exercise];
  return (
    <div className={`camera-guide ${compact ? "compact" : ""}`}>
      {!compact && (
        <svg viewBox="0 0 240 116" className="mx-auto w-full max-w-[240px] h-[100px]" fill="none" aria-hidden="true">
          <path d="M12 105h216" stroke="var(--cyan-dim)" />
          <rect x="24" y="43" width="15" height="32" rx="2" stroke="var(--cyan-bright)" strokeWidth="2" />
          <circle cx="31.5" cy="48" r="1" fill="var(--cyan-bright)" />
          <path d="m40 49 170-33v81L40 70" stroke="var(--cyan-dim)" strokeDasharray="3 5" />
          <path d={guide.path} stroke="var(--cyan-bright)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={exercise === "push" ? 69 : exercise === "sit" ? 99 : 144} cy={exercise === "push" ? 40 : exercise === "sit" ? 34 : 15} r="7" stroke="var(--cyan-bright)" strokeWidth="3" />
        </svg>
      )}
      <div className="font-mono text-[10px] text-[color:var(--cyan-bright)] tracking-wider mb-2">{guide.distance}</div>
      <p className="text-[13px] leading-relaxed text-[color:var(--text-mid)]">{guide.text}</p>
      {!compact && <p className="text-[11px] text-[color:var(--text)] mt-2">You do not need perfect form for a rep to register. Move through both ends of the motion. Stop if anything hurts.</p>}
    </div>
  );
}