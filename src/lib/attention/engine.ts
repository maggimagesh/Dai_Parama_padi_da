import { clamp, smoothTowards } from "@/lib/utils";
import { scoreSample } from "@/lib/attention/gaze";
import type {
  AttentionReading,
  AttentionSettings,
  AttentionState,
  Calibration,
  GazeSample,
} from "@/lib/attention/types";

/**
 * Turns a noisy per-frame gaze score into a stable attention state.
 *
 * Two mechanisms do the work:
 *
 *  1. **Hysteresis** — separate enter/exit thresholds with a dead band between
 *     them, so a score hovering at the boundary can't oscillate.
 *  2. **Dwell timers** — a threshold crossing only *arms* a transition; the
 *     signal has to hold for `awayDelayMs` / `returnDelayMs` before the state
 *     actually flips. Glancing at your keyboard shouldn't start a video.
 *
 * The engine is a plain class with no React or DOM dependencies, so the whole
 * decision path can be reasoned about — and tested — on its own.
 */
export class AttentionEngine {
  private settings: AttentionSettings;
  private calibration: Calibration | null;

  private score = 0;
  private state: AttentionState = "starting";
  private lastTimestamp: number | null = null;

  /** Milliseconds the signal has held on the far side of a threshold. */
  private dwell = 0;
  private missingFaceMs = 0;
  private fps = 0;

  constructor(settings: AttentionSettings, calibration: Calibration | null) {
    this.settings = settings;
    this.calibration = calibration;
  }

  setSettings(settings: AttentionSettings) {
    this.settings = settings;
  }

  setCalibration(calibration: Calibration | null) {
    this.calibration = calibration;
  }

  reset() {
    this.score = 0;
    this.state = "starting";
    this.lastTimestamp = null;
    this.dwell = 0;
    this.missingFaceMs = 0;
    this.fps = 0;
  }

  push(sample: GazeSample): AttentionReading {
    const deltaMs =
      this.lastTimestamp === null
        ? 16
        : clamp(sample.timestamp - this.lastTimestamp, 0, 250);
    this.lastTimestamp = sample.timestamp;

    if (deltaMs > 0) {
      const instantaneous = 1000 / deltaMs;
      this.fps = this.fps === 0 ? instantaneous : this.fps * 0.9 + instantaneous * 0.1;
    }

    const breakdown = scoreSample(sample, this.settings, this.calibration);

    // On the first frame, snap rather than easing up from zero — otherwise the
    // UI shows a phantom "away" moment every time tracking starts.
    this.score =
      this.state === "starting"
        ? breakdown.total
        : smoothTowards(
            this.score,
            breakdown.total,
            deltaMs,
            this.settings.smoothingTau,
          );

    if (sample.faceDetected) {
      this.missingFaceMs = 0;
    } else {
      this.missingFaceMs += deltaMs;
    }

    const next = this.advance(sample, deltaMs);

    return {
      state: next,
      score: this.score,
      rawScore: breakdown.total,
      sample,
      components: {
        head: breakdown.head,
        gaze: breakdown.gaze,
        eyes: breakdown.eyes,
      },
      pendingMs: this.pendingMs(next),
      fps: this.fps,
    };
  }

  private advance(sample: GazeSample, deltaMs: number): AttentionState {
    const { enterThreshold, exitThreshold, faceLostGraceMs } = this.settings;

    // A face that has left the frame is its own case: there is no score to
    // threshold against, only a grace period before we call it.
    if (!sample.faceDetected) {
      if (this.missingFaceMs >= faceLostGraceMs) {
        this.dwell = 0;
        this.state = "no-face";
      }
      // Inside the grace period we hold the previous state — detectors drop the
      // occasional frame, and that is not the same as leaving your desk.
      return this.state;
    }

    if (isAwayState(this.state)) {
      if (this.score >= enterThreshold) {
        this.dwell += deltaMs;
        if (this.dwell >= this.settings.returnDelayMs) {
          this.dwell = 0;
          this.state = "focused";
        }
      } else {
        this.dwell = 0;
        // Back in frame, but still not pointed at the screen.
        this.state = "away";
      }
      return this.state;
    }

    if (this.score <= exitThreshold) {
      this.dwell += deltaMs;
      if (this.dwell >= this.settings.awayDelayMs) {
        this.dwell = 0;
        this.state = "away";
      } else {
        this.state = "drifting";
      }
      return this.state;
    }

    // At or above the dead band — cancel any armed transition.
    this.dwell = 0;
    this.state = "focused";
    return this.state;
  }

  private pendingMs(state: AttentionState) {
    if (state === "drifting") {
      return Math.max(0, this.settings.awayDelayMs - this.dwell);
    }
    if (state === "away" || state === "no-face") {
      return Math.max(0, this.settings.returnDelayMs - this.dwell);
    }
    return 0;
  }
}

/** True when the state should be driving playback. */
export function isAwayState(state: AttentionState) {
  return state === "away" || state === "no-face";
}
