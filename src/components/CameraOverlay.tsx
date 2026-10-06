import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUi } from "../store/ui";
import { useGame, voiceRep } from "../store/game";
import type { CameraExercise, CameraPurpose } from "../types";
import { beginPoseSession, estimateVideo, Smoother, SKELETON_PAIRS, kpByName, type KP } from "../lib/pose";
import { CALIBRATION_FRAMES, POSE_CONFIDENCE, calibrationStatus, measurePose, RepTracker, type BodySide, type Measurement } from "../lib/repTracking";
import { audio } from "../lib/audio";
import { SystemWindow } from "./SystemWindow";
import { CameraGuide } from "./CameraGuide";

type Phase = "loading" | "calibrating" | "tracking" | "finished" | "error";

function waitForVideo(video: HTMLVideoElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", ready);
      signal.removeEventListener("abort", aborted);
    };
    const ready = () => { cleanup(); resolve(); };
    const aborted = () => { cleanup(); reject(new DOMException("Camera session closed", "AbortError")); };
    if (signal.aborted) { aborted(); return; }
    if (video.readyState >= 2) { ready(); return; }
    video.addEventListener("loadeddata", ready, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    timer = window.setTimeout(() => { cleanup(); reject(new Error("The video feed timed out. Please retry.")); }, 8000);
  });
}

function drawSkeleton(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, points: KP[]) {
  if (!canvas) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [aName, bName] of SKELETON_PAIRS) {
    const a = kpByName(points, aName);
    const b = kpByName(points, bName);
    if (!a || !b || a.score < POSE_CONFIDENCE || b.score < POSE_CONFIDENCE) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  // Two strokes create a soft-looking outline without recomputing canvas shadows.
  ctx.strokeStyle = "#1e9bff44";
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = "#7fd0ff";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const point of points) {
    if (point.score < POSE_CONFIDENCE || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    ctx.globalAlpha = Math.min(1, point.score + 0.2);
    ctx.fillStyle = "#cbe9ff";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3 + point.score * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGauge(canvas: HTMLCanvasElement | null, measurement: Measurement) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  const cx = canvas.width / 2;
  const cy = canvas.height - 10;
  const radius = cx - 12;
  const map = (degrees: number) => Math.PI + Math.max(0, Math.min(180, degrees)) / 180 * Math.PI;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#172c40";
  ctx.beginPath(); ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#ff3b5266";
  ctx.beginPath(); ctx.arc(cx, cy, radius, map(0), map(measurement.down)); ctx.stroke();
  ctx.strokeStyle = "#2fe08a66";
  ctx.beginPath(); ctx.arc(cx, cy, radius, map(measurement.up), map(180)); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7fd0ff";
  const needle = map(measurement.angle);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(needle) * radius, cy + Math.sin(needle) * radius); ctx.stroke();
  ctx.fillStyle = "#cbe9ff";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(measurement.angle)} deg`, cx, cy - 9);
}

function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was denied. Allow it in your browser's site permissions, then retry.";
  if (name === "NotFoundError") return "No camera found. Connect a camera or use manual logging.";
  if (name === "NotReadableError") return "The camera is busy in another app. Close that app and retry.";
  if (name === "OverconstrainedError") return "This camera could not use those settings. Try another camera or manual logging.";
  return error instanceof Error ? error.message : "Camera verification could not start. Please retry or log manually.";
}

function CameraSession({ exercise, purpose, close }: { exercise: CameraExercise; purpose: CameraPurpose; close: () => void }) {
  const [session] = useState(() => {
    const state = useGame.getState();
    const targets = state.getTargets();
    const penaltyGoal = exercise === "push" || exercise === "sit" ? state.getPenaltyTargets()[exercise] : 0;
    return {
      date: state.questDate,
      target: purpose === "penalty"
        ? Math.max(1, penaltyGoal - (exercise === "push" ? state.penPushDone : state.penSitDone))
        : Math.max(1, Math.ceil(targets[exercise] - state[exercise])),
    };
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const skeletonRef = useRef<HTMLCanvasElement>(null);
  const gaugeRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => undefined);
  const syncRef = useRef<() => void>(() => undefined);
  const commitRef = useRef<() => void>(() => undefined);
  const countRef = useRef(0);
  const endedRef = useRef(false);
  const submittedRef = useRef(false);
  const pausedRef = useRef(false);
  const phaseRef = useRef<Phase>("loading");
  const [phase, setPhase] = useState<Phase>("loading");
  const [feedback, setFeedback] = useState("Requesting camera and preparing the model...");
  const [calibration, setCalibration] = useState(0);
  const [reps, setReps] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState("");
  const [rest, setRest] = useState(0);
  const [manualReps, setManualReps] = useState("");

  const logManual = (amountStr: string) => {
    const val = parseInt(amountStr);
    if (val > 0) {
      countRef.current = val;
      commit();
    }
  };

  const finish = (text: string) => {
    endedRef.current = true;
    stopRef.current();
    phaseRef.current = "finished";
    setPhase("finished");
    setResult(text);
  };

  const commit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const n = countRef.current;
    const state = useGame.getState();
    let message = n ? `${n} camera-counted reps saved.` : "No reps recorded. You can try again or log manually.";
    if (n > 0 && !state.dead) {
      if (purpose === "penalty") {
        if (state.inLockdown && exercise !== "squat") state.addPenaltyProgress(exercise, n);
        else message = "The penalty is no longer active. No progress was changed.";
      } else if (state.questDate === session.date && !state.inLockdown && !state.dailyCompleted) {
        state.logExercise(exercise, n, true);
      } else {
        message = "The daily quest changed or is already clear. No extra rewards were claimed.";
      }
    }
    finish(message);
  };
  commitRef.current = commit;

  useEffect(() => {
    const abort = new AbortController();
    let cancelled = false;
    let failed = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let busy = false;
    let lastFrame = 0;
    let lastVideoTime = -1;
    let calibrationFrames = 0;
    let errorFrames = 0;
    let preferredSide: BodySide | undefined;
    const smoother = new Smoother();
    const tracker = new RepTracker();
    endedRef.current = submittedRef.current = pausedRef.current = false;
    countRef.current = 0;
    phaseRef.current = "loading";
    setPhase("loading"); setReps(0); setCalibration(0); setFallback(false); setPaused(false);
    setFeedback("Requesting camera and preparing the model...");

    const stop = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; }
    };
    stopRef.current = stop;
    const canRun = () => !cancelled && !failed && !endedRef.current && !document.hidden && !pausedRef.current;

    async function startVideo() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera verification needs HTTPS and browser camera support. Vercel provides HTTPS; manual logging remains available.");
      }
      const feed = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: exercise === "push" ? 360 : 480 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      if (cancelled || failed || endedRef.current) {
        feed.getTracks().forEach((track) => track.stop());
        throw new DOMException("Camera session closed", "AbortError");
      }
      stream = feed;
      const video = videoRef.current;
      if (!video) throw new Error("The camera view is no longer open.");
      video.srcObject = feed;
      await video.play();
      await waitForVideo(video, abort.signal);
      return video;
    }

    async function start() {
      try {
        // Model preparation and camera permission happen concurrently, not serially.
        const [video, detector] = await Promise.all([startVideo(), beginPoseSession()]);
        if (cancelled || endedRef.current) return;
        phaseRef.current = "calibrating";
        setPhase("calibrating");

        const frame = async (now: number) => {
          if (!canRun() || busy) return;
          if (now - lastFrame < 50 || lastVideoTime === video.currentTime || video.readyState < 2) {
            raf = requestAnimationFrame(frame);
            return;
          }
          lastFrame = now;
          lastVideoTime = video.currentTime;
          busy = true;
          try {
            const poses = await estimateVideo(detector, video);
            if (!canRun()) return;
            errorFrames = 0;
            const raw = poses[0]?.keypoints ?? [];
            const points = smoother.smooth(raw);
            drawSkeleton(skeletonRef.current, video, points);
            if (phaseRef.current === "calibrating") {
              const status = calibrationStatus(points, exercise);
              calibrationFrames = Math.max(0, Math.min(CALIBRATION_FRAMES, calibrationFrames + (status.good ? 1 : -1)));
              setCalibration(Math.round(calibrationFrames / CALIBRATION_FRAMES * 100));
              setFeedback(status.message);
              if (calibrationFrames >= CALIBRATION_FRAMES) {
                phaseRef.current = "tracking";
                setPhase("tracking");
                setFeedback("Ready. Start extended, bend, then return. Sit-ups: recline, curl, then return.");
                audio.chime();
              }
            } else if (phaseRef.current === "tracking") {
              const measurement = measurePose(points, exercise, preferredSide);
              if (measurement) {
                preferredSide = measurement.side;
                setFallback(measurement.fallback);
                drawGauge(gaugeRef.current, measurement);
                setFeedback(measurement.angle < measurement.down
                  ? "Depth reached. Return to your starting position."
                  : "Move through both ends of the motion. Partial sets are welcome.");
              } else setFeedback("Tracking paused: bring the exercise joints back into view.");
              if (tracker.update(measurement, now)) {
                countRef.current = tracker.count;
                setReps(tracker.count);
                audio.repBeep();
                voiceRep(tracker.count, session.target);
                if (tracker.count >= session.target) commitRef.current();
              }
            }
          } catch (error) {
            if (canRun() && ++errorFrames >= 3) {
              failed = true;
              stop();
              phaseRef.current = "error";
              setPhase("error");
              setFeedback(cameraError(error));
            }
          } finally {
            busy = false;
            if (canRun()) raf = requestAnimationFrame(frame);
          }
        };

        const sync = () => {
          cancelAnimationFrame(raf);
          tracker.resetCycle();
          smoother.reset();
          lastFrame = 0;
          lastVideoTime = -1;
          if (canRun() && !busy) raf = requestAnimationFrame(frame);
        };
        syncRef.current = sync;
        document.addEventListener("visibilitychange", sync);
        abort.signal.addEventListener("abort", () => document.removeEventListener("visibilitychange", sync), { once: true });
        sync();
      } catch (error) {
        if (cancelled || endedRef.current) return;
        failed = true;
        stop();
        phaseRef.current = "error";
        setPhase("error");
        setFeedback(cameraError(error));
      }
    }
    void start();
    return () => {
      cancelled = true;
      abort.abort();
      stop();
      stopRef.current = syncRef.current = () => undefined;
    };
  }, [exercise, session.target, attempt]);

  useEffect(() => {
    if (rest <= 0) return;
    const end = Date.now() + rest * 1000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRest(remaining);
      if (remaining === 0) { clearInterval(timer); audio.chime(); }
    }, 250);
    return () => clearInterval(timer);
    // Keep one absolute deadline instead of accumulating interval drift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest > 0]);

  const saveAndClose = () => {
    if (!submittedRef.current && countRef.current > 0) commitRef.current();
    close();
  };
  const name = { push: "PUSH-UPS", sit: "SIT-UPS", squat: "SQUATS" }[exercise];

  return (
    <div className="fixed inset-0 z-[85] sys-backdrop camera-overlay" role="dialog" aria-modal="true" aria-label={`${name} camera verification`}>
      <div className="camera-shell">
        <header className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-head text-[16px] font-bold tracking-wider text-[color:var(--cyan-bright)]">{name} / {purpose.toUpperCase()}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="sl-btn sl-btn-gold px-2.5 py-1 text-[10px]"
              onClick={() => {
                const entered = prompt(`Camera issue? Enter number of ${name.toLowerCase()} completed:`);
                if (entered) logManual(entered);
              }}
            >
              LOG INSTEAD
            </button>
            <button className="sl-btn sl-btn-danger px-3 py-1 text-[10px]" onClick={saveAndClose}>{reps > 0 && phase !== "finished" ? "SAVE & CLOSE" : "CLOSE"}</button>
          </div>
        </header>

        {phase === "finished" ? (
          <SystemWindow title="SESSION COMPLETE" titleSize="sm" accent="#2fe08a">
            <div className="text-center space-y-3">
              <div className="cam-rep-counter text-[48px]">{reps}</div>
              <div className="font-mono text-[10px] text-[color:var(--text)]">CAMERA-COUNTED REPS</div>
              <p className="text-[13px] text-[color:var(--text-mid)] leading-relaxed">{result}</p>
              {rest > 0 ? <div className="font-mono text-[32px] text-[color:var(--cyan-bright)]">{rest}s REST</div>
                : <button className="sl-btn w-full" onClick={() => setRest(60)}>START REST (60s)</button>}
              <button className="sl-btn sl-btn-solid w-full" onClick={close}>DONE</button>
            </div>
          </SystemWindow>
        ) : phase === "error" ? (
          <SystemWindow title="CAMERA HELP" titleSize="sm" accent="#ff3b52">
            <p className="text-[14px] leading-relaxed text-[color:var(--text-mid)] mb-4">{feedback}</p>
            <CameraGuide exercise={exercise} compact />
            <div className="flex gap-2 mt-4">
              <button className="sl-btn flex-1" onClick={() => setAttempt((value) => value + 1)}>RETRY</button>
              <button className="sl-btn flex-1" onClick={saveAndClose}>{reps ? "SAVE & CLOSE" : "LOG MANUALLY"}</button>
            </div>
          </SystemWindow>
        ) : (
          <div className="camera-layout">
            <div className={`cam-viewbox camera-preview ${phase === "loading" ? "loading" : ""}`}>
              <video ref={videoRef} autoPlay playsInline muted className="camera-media cam-mirror" />
              <canvas ref={skeletonRef} className="camera-media cam-mirror" />
              <span className="cam-bracket win-corner tl" /><span className="cam-bracket win-corner tr" />
              <span className="cam-bracket win-corner bl" /><span className="cam-bracket win-corner br" />
              {phase === "loading" && <div className="camera-loading-guide"><CameraGuide exercise={exercise} /></div>}
              {phase === "tracking" && <div className="absolute top-3 left-3 cam-rep-counter"><span className="text-[44px]">{reps}</span><span className="text-[16px] text-[color:var(--text)]"> / {session.target}</span></div>}
              {fallback && <div className="absolute bottom-2 inset-x-2 text-center font-mono text-[10px] text-[color:var(--gold)] bg-[#02080fe6] p-2">Reduced Accuracy Mode: Ankles Not Visible</div>}
            </div>

            <aside className="camera-controls">
              <div className="font-mono text-[10px] tracking-widest text-[color:var(--cyan-bright)]">{phase.toUpperCase()}{phase === "calibrating" ? ` / ${calibration}%` : ""}</div>
              {phase === "calibrating" && <div className="bar-track mt-2"><div className="bar-fill" style={{ width: `${calibration}%`, background: "var(--cyan)" }} /></div>}
              <p className="text-[13px] text-[color:var(--text-mid)] leading-relaxed mt-3 min-h-[40px]" aria-live="polite">{paused ? "Paused. Take a breath; resume when ready." : feedback}</p>
              {phase === "loading" && <p className="text-[11px] text-[color:var(--text)] mt-2">The first model download needs internet. Your video stays on this device. Camera permission and model preparation run together.</p>}
              {phase === "tracking" && <>
                <canvas ref={gaugeRef} width={132} height={82} className="my-3" />
                <div className="flex gap-2">
                  <button className="sl-btn flex-1 text-[10px]" onClick={() => {
                    pausedRef.current = !pausedRef.current;
                    setPaused(pausedRef.current);
                    syncRef.current();
                  }}>{paused ? "RESUME" : "PAUSE"}</button>
                  <button className="sl-btn sl-btn-solid flex-1 text-[10px]" disabled={reps === 0} onClick={commit}>SAVE {reps} REPS</button>
                </div>
              </>}
              {phase === "calibrating" && <CameraGuide exercise={exercise} compact />}

              <div className="mt-3 pt-2.5 border-t border-[#ffffff14]">
                <div className="font-sys text-[9px] tracking-[0.2em] text-[color:var(--text-dim)] uppercase mb-1.5">
                  Camera not working? Log manually:
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={manualReps}
                    onChange={(e) => setManualReps(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && logManual(manualReps)}
                    placeholder="Enter reps..."
                    className="sl-input py-1 text-xs flex-1 w-0"
                  />
                  <button
                    className="sl-btn sl-btn-gold px-3 py-1 text-[10px] shrink-0"
                    onClick={() => logManual(manualReps)}
                  >
                    LOG
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-[color:var(--text-dim)] mt-2">Guidance, not medical or anti-cheat certification. Manual logging is always available.</p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export function CameraOverlay() {
  const exercise = useUi((s) => s.camExercise);
  const purpose = useUi((s) => s.camPurpose);
  const close = useUi((s) => s.closeCamera);
  if (!exercise) return null;
  // A body portal keeps fixed positioning correct even while the HUD shakes.
  return createPortal(<CameraSession key={`${exercise}:${purpose}`} exercise={exercise} purpose={purpose} close={close} />, document.body);
}