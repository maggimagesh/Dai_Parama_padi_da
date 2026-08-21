import type {
  FaceLandmarker as FaceLandmarkerType,
  FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

/**
 * Owns the camera stream and the MediaPipe landmark model, and pumps one
 * detection per animation frame.
 *
 * Assets are served from this origin (vendored by `scripts/setup-vision-assets.mjs`)
 * so no video frame — and no request describing one — ever leaves the machine.
 *
 * The CDN fallback is opt-in. Runtime fetched from a third party would execute
 * with access to the live camera stream, so shipping that as a silent default
 * trades away the privacy guarantee above to paper over a failed install. Set
 * `NEXT_PUBLIC_ALLOW_VISION_CDN=1` to enable it — the middleware reads the same
 * variable to widen the CSP, so the two cannot drift apart. It is inlined at
 * build time, so it must be set before `next build`, not at run time.
 */

const LOCAL_WASM_PATH = "/mediapipe/wasm";
/** The loader `FilesetResolver` fetches first — a proxy for the whole runtime. */
const LOCAL_WASM_PROBE = "/mediapipe/wasm/vision_wasm_internal.js";
const LOCAL_MODEL_PATH = "/mediapipe/models/face_landmarker.task";
const CDN_WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const CDN_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export interface TrackerCallbacks {
  onResult: (result: FaceLandmarkerResult, timestampMs: number) => void;
  onError: (error: Error) => void;
  onPhase: (
    phase: "loading-model" | "requesting-permission" | "running",
  ) => void;
}

const CDN_FALLBACK_ENABLED = process.env.NEXT_PUBLIC_ALLOW_VISION_CDN === "1";

async function resourceExists(path: string) {
  try {
    const response = await fetch(path, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Both halves of the local runtime, checked together.
 *
 * The model and the WASM are vendored by separate steps that can fail
 * independently — the copy comes out of node_modules, the model off the
 * network. Probing only one and using the answer for both means a half-vendored
 * install picks local paths for a file that is not there, and MediaPipe fails
 * with an error that says nothing about the real cause.
 */
async function localAssetsAvailable() {
  const [model, wasm] = await Promise.all([
    resourceExists(LOCAL_MODEL_PATH),
    resourceExists(LOCAL_WASM_PROBE),
  ]);
  return model && wasm;
}

export class FaceTracker {
  private landmarker: FaceLandmarkerType | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private running = false;
  private lastVideoTime = -1;
  private callbacks: TrackerCallbacks;

  constructor(callbacks: TrackerCallbacks) {
    this.callbacks = callbacks;
  }

  get mediaStream() {
    return this.stream;
  }

  async start(video: HTMLVideoElement) {
    if (this.running) return;
    this.running = true;
    this.video = video;

    try {
      this.callbacks.onPhase("requesting-permission");
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });

      if (!this.running) {
        this.releaseStream();
        return;
      }

      video.srcObject = this.stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      this.callbacks.onPhase("loading-model");
      this.landmarker = await this.createLandmarker();

      if (!this.running) {
        this.landmarker?.close();
        this.landmarker = null;
        this.releaseStream();
        return;
      }

      this.callbacks.onPhase("running");
      this.loop();
    } catch (error) {
      this.running = false;
      this.releaseStream();
      this.callbacks.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async createLandmarker() {
    // Imported lazily: the bundle pulls in a WASM loader that has no business
    // running during SSR or on first paint.
    const { FaceLandmarker, FilesetResolver } =
      await import("@mediapipe/tasks-vision");

    const useLocal = await localAssetsAvailable();

    if (!useLocal && !CDN_FALLBACK_ENABLED) {
      throw new Error(
        "Vision assets are missing or incomplete in /public/mediapipe. Run " +
          "`npm install` to vendor them locally, or rebuild with " +
          "NEXT_PUBLIC_ALLOW_VISION_CDN=1 set to load them from a CDN " +
          "(build-time only).",
      );
    }

    const fileset = await FilesetResolver.forVisionTasks(
      useLocal ? LOCAL_WASM_PATH : CDN_WASM_PATH,
    );

    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: useLocal ? LOCAL_MODEL_PATH : CDN_MODEL_PATH,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      // Both extras are what make gaze estimation possible: blendshapes give
      // eyeball direction, the matrix gives head orientation.
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.4,
      minFacePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
  }

  private loop = () => {
    if (!this.running || !this.video || !this.landmarker) return;

    const video = this.video;

    // `detectForVideo` throws if handed the same frame twice, so gate on the
    // element's own clock rather than on rAF ticks.
    if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      const timestampMs = performance.now();
      try {
        const result = this.landmarker.detectForVideo(video, timestampMs);
        this.callbacks.onResult(result, timestampMs);
      } catch (error) {
        this.callbacks.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
        this.stop();
        return;
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private releaseStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.landmarker?.close();
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.releaseStream();
    this.video = null;
  }
}

export function describeCameraError(error: Error) {
  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Allow it in your browser's site settings, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is already in use by another app. Close it and try again.";
    case "OverconstrainedError":
      return "This camera can't provide a usable video stream.";
    default:
      return error.message || "The camera could not be started.";
  }
}
