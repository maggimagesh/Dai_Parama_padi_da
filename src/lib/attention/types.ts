/**
 * The attention state machine has five terminal states. `drifting` is the
 * deliberate in-between: the signal has crossed the away threshold but the
 * dwell timer hasn't elapsed, so nothing has been triggered yet. Surfacing it
 * makes the system feel predictable instead of twitchy.
 */
export type AttentionState =
  | "offline"
  | "starting"
  | "focused"
  | "drifting"
  | "away"
  | "no-face";

export type TrackerStatus =
  | "idle"
  | "requesting-permission"
  | "loading-model"
  | "running"
  | "denied"
  | "error";

/** One frame of raw signal, before any smoothing or thresholding. */
export interface GazeSample {
  timestamp: number;
  faceDetected: boolean;
  /** Head rotation in degrees, relative to the camera. */
  yaw: number;
  pitch: number;
  roll: number;
  /** Eyeball direction within the sockets, -1..1 (left/right, down/up). */
  gazeX: number;
  gazeY: number;
  /** 0 = eyes shut, 1 = wide open. */
  eyeOpenness: number;
  /** Normalised head position in frame, 0..1. Used for the framing hint. */
  facePositionX: number;
  facePositionY: number;
  /** Apparent face size, a rough proxy for distance from the camera. */
  faceScale: number;
}

/** The neutral pose captured during calibration. Deviations are measured from here. */
export interface Calibration {
  yaw: number;
  pitch: number;
  gazeX: number;
  gazeY: number;
  capturedAt: number;
}

/** Everything the UI needs to render the current attention reading. */
export interface AttentionReading {
  state: AttentionState;
  /** Smoothed 0..1 confidence that you are looking at the monitor. */
  score: number;
  /** Unsmoothed score, for the live waveform. */
  rawScore: number;
  sample: GazeSample | null;
  /** Component breakdown, so the UI can explain *why* it decided you looked away. */
  components: {
    head: number;
    gaze: number;
    eyes: number;
  };
  /** Milliseconds remaining on the dwell timer before the state flips. */
  pendingMs: number;
  /** Measured detection rate of the tracking loop. */
  fps: number;
}

export interface AttentionSettings {
  /** Degrees of head rotation tolerated before attention starts decaying. */
  headTolerance: number;
  /** Eyeball deviation tolerated, 0..1. */
  gazeTolerance: number;
  /** Score at or above which you are considered focused again. */
  enterThreshold: number;
  /** Score at or below which you are considered to have looked away. */
  exitThreshold: number;
  /** How long the signal must stay low before the video starts. */
  awayDelayMs: number;
  /** How long it must stay high before the video stops. */
  returnDelayMs: number;
  /** Grace period when the face leaves frame entirely. */
  faceLostGraceMs: number;
  /** Smoothing time constant. Higher = steadier but slower. */
  smoothingTau: number;
}

export const DEFAULT_ATTENTION_SETTINGS: AttentionSettings = {
  headTolerance: 22,
  gazeTolerance: 0.42,
  enterThreshold: 0.58,
  exitThreshold: 0.34,
  awayDelayMs: 900,
  returnDelayMs: 350,
  faceLostGraceMs: 1400,
  smoothingTau: 190,
};

export const EMPTY_READING: AttentionReading = {
  state: "offline",
  score: 0,
  rawScore: 0,
  sample: null,
  components: { head: 0, gaze: 0, eyes: 0 },
  pendingMs: 0,
  fps: 0,
};

export const STATE_COPY: Record<
  AttentionState,
  { label: string; detail: string; tone: string }
> = {
  offline: {
    label: "Sensor idle",
    detail: "Attention tracking is switched off.",
    tone: "var(--color-ink-faint)",
  },
  starting: {
    label: "Acquiring",
    detail: "Warming up the camera and landmark model.",
    tone: "var(--color-signal)",
  },
  focused: {
    label: "On screen",
    detail: "You are looking at the monitor. Playback stays paused.",
    tone: "var(--color-focus)",
  },
  drifting: {
    label: "Drifting",
    detail: "Attention is slipping. Holding before triggering playback.",
    tone: "var(--color-drift)",
  },
  away: {
    label: "Looked away",
    detail: "Playback is running until you look back.",
    tone: "var(--color-away)",
  },
  "no-face": {
    label: "Out of frame",
    detail: "No face in view — treating this as looking away.",
    tone: "var(--color-away)",
  },
};
