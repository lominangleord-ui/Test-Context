export interface KP {
  x: number;
  y: number;
  score: number;
  name: string;
}

export interface PoseDetector {
  estimatePoses(input: HTMLVideoElement | HTMLCanvasElement): Promise<{ keypoints: KP[] }[]>;
  reset?: () => void;
  dispose?: () => void;
}

declare global {
  interface Window {
    tf?: {
      ready: () => Promise<void>;
      setBackend: (name: string) => Promise<boolean>;
    };
    poseDetection?: {
      createDetector: (model: unknown, config: Record<string, unknown>) => Promise<PoseDetector>;
      SupportedModels: { MoveNet: unknown };
      movenet: { modelType: { SINGLEPOSE_LIGHTNING: string } };
    };
  }
}

const CDN = {
  tf: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
  pose: "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
};
const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const pending = scripts.get(src);
  if (pending) return pending;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => fail(), 20000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      reject(new Error("The pose model could not download. Check your connection and retry."));
    }
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  scripts.set(src, promise);
  void promise.catch(() => scripts.delete(src));
  return promise;
}

let detectorPromise: Promise<PoseDetector> | null = null;
let inferenceQueue: Promise<unknown> = Promise.resolve();

/** Camera sessions share one model but never run concurrent inference on it. */
function serialize<T>(task: () => Promise<T> | T): Promise<T> {
  const result = inferenceQueue.then(task, task);
  inferenceQueue = result.catch(() => undefined);
  return result;
}

export function loadDetector(): Promise<PoseDetector> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    if (!window.tf) await loadScript(CDN.tf);
    if (!window.poseDetection) await loadScript(CDN.pose);
    const tf = window.tf;
    const pose = window.poseDetection;
    if (!tf || !pose) throw new Error("Pose detection is unavailable. Please retry.");
    try {
      if (!await tf.setBackend("webgl")) await tf.setBackend("cpu");
    } catch {
      await tf.setBackend("cpu");
    }
    await tf.ready();
    const pending = pose.createDetector(pose.SupportedModels.MoveNet, {
      modelType: pose.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: false, // Coordinates are EMA-filtered once, by this app.
      minPoseScore: 0.15,
    });
    let timeoutId = 0;
    let expired = false;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        expired = true;
        reject(new Error("The pose model download timed out. Check your connection and retry."));
      }, 45000);
    });
    void pending.then((detector) => { if (expired) detector.dispose?.(); }, () => undefined);
    let detector: PoseDetector;
    try { detector = await Promise.race([pending, timeout]); }
    finally { clearTimeout(timeoutId); }

    // Compile the first inference before the player taps CAM.
    const warmFrame = document.createElement("canvas");
    warmFrame.width = warmFrame.height = 192;
    try {
      await serialize(() => detector.estimatePoses(warmFrame));
      detector.reset?.();
    } catch {
      detector.dispose?.();
      throw new Error("Pose detection could not start on this device. Try again or use manual logging.");
    }
    return detector;
  })();
  void detectorPromise.catch(() => { detectorPromise = null; });
  return detectorPromise;
}

export async function beginPoseSession() {
  const detector = await loadDetector();
  await serialize(() => detector.reset?.());
  return detector;
}

export function estimateVideo(detector: PoseDetector, video: HTMLVideoElement) {
  return serialize(() => detector.estimatePoses(video));
}

export class Smoother {
  private previous = new Map<string, { x: number; y: number }>();
  smooth(points: KP[]): KP[] {
    return points.map((point) => {
      if (point.score < 0.2 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        this.previous.delete(point.name);
        return point;
      }
      const previous = this.previous.get(point.name);
      const x = previous ? 0.3 * point.x + 0.7 * previous.x : point.x;
      const y = previous ? 0.3 * point.y + 0.7 * previous.y : point.y;
      this.previous.set(point.name, { x, y });
      return { ...point, x, y }; // Confidence remains raw.
    });
  }
  reset() { this.previous.clear(); }
}

export function angle(a: KP, b: KP, c: KP): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const length = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (length < 16) return Number.NaN;
  const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / length));
  return Math.acos(cosine) * 180 / Math.PI;
}

export function kpByName(points: KP[], name: string) {
  return points.find((point) => point.name === name);
}

export const SKELETON_PAIRS: [string, string][] = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"], ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
];