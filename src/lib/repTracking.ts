import { POSE_THRESHOLDS, SQUAT_FALLBACK } from "../data";
import type { CameraExercise } from "../types";
import { angle, kpByName, type KP } from "./pose";

export const POSE_CONFIDENCE = 0.2;
export const CALIBRATION_FRAMES = 20;
export type BodySide = "left" | "right";
export interface Measurement {
  angle: number;
  down: number;
  up: number;
  side: BodySide;
  fallback: boolean;
}

function visible(point: KP | undefined): point is KP {
  return !!point && point.score >= POSE_CONFIDENCE && Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** Never combine a left hip with a right knee or wrist. */
export function measurePose(points: KP[], exercise: CameraExercise, preferred?: BodySide): Measurement | null {
  const thresholds = POSE_THRESHOLDS[exercise];
  const candidates: (Measurement & { confidence: number })[] = [];
  for (const side of ["left", "right"] as const) {
    const [first, middle, last] = thresholds.joints.map((joint) => kpByName(points, `${side}_${joint}`));
    if (visible(first) && visible(middle) && visible(last)) {
      const measured = angle(first, middle, last);
      if (Number.isFinite(measured)) {
        candidates.push({
          angle: measured, down: thresholds.down, up: thresholds.up,
          side, fallback: false, confidence: Math.min(first.score, middle.score, last.score),
        });
      }
    }
  }

  if (exercise === "squat" && candidates.length === 0) {
    for (const side of ["left", "right"] as const) {
      const hip = kpByName(points, `${side}_hip`);
      const knee = kpByName(points, `${side}_knee`);
      if (!visible(hip) || !visible(knee)) continue;
      const anchor: KP = { x: knee.x, y: knee.y + 100, name: "vertical", score: 1 };
      const measured = angle(hip, knee, anchor);
      if (Number.isFinite(measured)) {
        candidates.push({ ...SQUAT_FALLBACK, angle: measured, side, fallback: true, confidence: Math.min(hip.score, knee.score) });
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  if (!best) return null;
  const previous = candidates.find((candidate) => candidate.side === preferred);
  return previous && previous.confidence >= best.confidence - 0.15 ? previous : best;
}

export function calibrationStatus(points: KP[], exercise: CameraExercise) {
  const measurement = measurePose(points, exercise);
  if (!measurement) {
    const labels = {
      push: "Show one shoulder, elbow and wrist. Move the phone further back.",
      sit: "Keep one shoulder, hip and knee in frame.",
      squat: "Keep your hips and knees in frame. Include ankles if possible.",
    };
    return { good: false, message: labels[exercise] };
  }
  const left = kpByName(points, "left_shoulder");
  const right = kpByName(points, "right_shoulder");
  const hip = kpByName(points, `${measurement.side}_hip`);
  if (visible(left) && visible(right) && visible(hip)) {
    // Euclidean torso length also works when the body is horizontal in push-ups.
    const torso = Math.hypot((left.x + right.x) / 2 - hip.x, (left.y + right.y) / 2 - hip.y);
    const separation = Math.hypot(left.x - right.x, left.y - right.y);
    if (torso > 8 && separation / torso > 1.4) {
      return { good: false, message: "Turn a little more sideways so the joints are clear." };
    }
  }
  return { good: true, message: measurement.fallback
    ? "Hold still. Ankles are cropped; reduced-accuracy tracking is available."
    : "Good position. Hold steady for a moment." };
}

/** Two stable frames at each end + a full angle cycle reject jitter, not imperfect form. */
export class RepTracker {
  count = 0;
  private mode = "";
  private ready = false;
  private lowered = false;
  private highFrames = 0;
  private lowFrames = 0;
  private lastVisible = 0;
  private lastRep = Number.NEGATIVE_INFINITY;

  resetCycle() {
    this.ready = this.lowered = false;
    this.highFrames = this.lowFrames = 0;
  }

  update(measurement: Measurement | null, now: number): boolean {
    if (!measurement || !Number.isFinite(measurement.angle)) {
      if (now - this.lastVisible > 800) this.resetCycle();
      this.highFrames = this.lowFrames = 0;
      return false;
    }
    this.lastVisible = now;
    const mode = `${measurement.side}:${measurement.fallback}`;
    if (mode !== this.mode) { this.resetCycle(); this.mode = mode; }

    if (measurement.angle > measurement.up) {
      this.highFrames += 1;
      this.lowFrames = 0;
      if (this.highFrames >= 2) {
        if (this.lowered && now - this.lastRep >= 350) {
          this.count += 1;
          this.lastRep = now;
          this.lowered = false;
          this.ready = true;
          return true;
        }
        this.ready = true;
      }
    } else if (measurement.angle < measurement.down) {
      this.lowFrames += 1;
      this.highFrames = 0;
      if (this.lowFrames >= 2 && this.ready) this.lowered = true;
    } else {
      this.highFrames = this.lowFrames = 0;
    }
    return false;
  }
}