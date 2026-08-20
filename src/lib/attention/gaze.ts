import type { FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";

import { clamp, falloff } from "@/lib/utils";
import type {
  AttentionSettings,
  Calibration,
  GazeSample,
} from "@/lib/attention/types";

/* -------------------------------------------------------------------------- */
/*  Landmark indices from the MediaPipe canonical face mesh.                   */
/*  "left"/"right" here follow MediaPipe's convention: sides of the *image*.   */
/* -------------------------------------------------------------------------- */

const IRIS_L = 468;
const IRIS_R = 473;
const EYE_L_OUTER = 33;
const EYE_L_INNER = 133;
const EYE_R_INNER = 362;
const EYE_R_OUTER = 263;
const LID_L_UPPER = 159;
const LID_L_LOWER = 145;
const LID_R_UPPER = 386;
const LID_R_LOWER = 374;
const NOSE_TIP = 1;
const CHEEK_L = 234;
const CHEEK_R = 454;
const FOREHEAD = 10;
const CHIN = 152;

const DEG = 180 / Math.PI;

function blendshapeMap(result: FaceLandmarkerResult): Map<string, number> {
  const map = new Map<string, number>();
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories) return map;
  for (const category of categories) {
    if (category.categoryName) map.set(category.categoryName, category.score);
  }
  return map;
}

/**
 * Pulls Tait-Bryan angles out of MediaPipe's 4x4 facial transformation matrix.
 * The buffer is column-major, and we decompose as Ry * Rx * Rz — the order that
 * matches how a head actually moves (turn, then nod, then tilt).
 */
function eulerFromMatrix(data: number[] | Float32Array) {
  // Column-major accessor: element at row r, column c.
  const at = (r: number, c: number) => data[c * 4 + r];

  const pitch = Math.asin(clamp(-at(1, 2), -1, 1));
  const yaw = Math.atan2(at(0, 2), at(2, 2));
  const roll = Math.atan2(at(1, 0), at(1, 1));

  return { yaw: yaw * DEG, pitch: pitch * DEG, roll: roll * DEG };
}

/**
 * Rough head orientation straight from landmark geometry. Used when the
 * transformation matrix is unavailable — less precise, but it keeps the
 * tracker useful rather than blind.
 */
function eulerFromLandmarks(points: NormalizedLandmark[]) {
  const nose = points[NOSE_TIP];
  const left = points[CHEEK_L];
  const right = points[CHEEK_R];
  const brow = points[FOREHEAD];
  const chin = points[CHIN];
  if (!nose || !left || !right || !brow || !chin) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // A centred head sits equidistant from both cheek edges; asymmetry is yaw.
  const span = right.x - left.x || 1e-6;
  const yawRatio = (nose.x - (left.x + right.x) / 2) / (span / 2);

  const height = chin.y - brow.y || 1e-6;
  const pitchRatio = (nose.y - (brow.y + chin.y) / 2) / (height / 2);

  const roll = Math.atan2(right.y - left.y, right.x - left.x) * DEG;

  // The ratios saturate near ±1, so ~60° of usable range each way.
  return {
    yaw: clamp(yawRatio, -1, 1) * 60,
    pitch: clamp(pitchRatio, -1, 1) * 45,
    roll,
  };
}

/** Eyeball direction from ARKit-style blendshapes, normalised to -1..1. */
function gazeFromBlendshapes(shapes: Map<string, number>) {
  const get = (name: string) => shapes.get(name) ?? 0;

  // Looking to the subject's right means their right eye rotates outward and
  // their left eye rotates inward — and vice versa.
  const toRight = get("eyeLookOutRight") + get("eyeLookInLeft");
  const toLeft = get("eyeLookOutLeft") + get("eyeLookInRight");
  const up = get("eyeLookUpLeft") + get("eyeLookUpRight");
  const down = get("eyeLookDownLeft") + get("eyeLookDownRight");

  const blink = (get("eyeBlinkLeft") + get("eyeBlinkRight")) / 2;

  return {
    gazeX: clamp((toRight - toLeft) / 2, -1, 1),
    gazeY: clamp((up - down) / 2, -1, 1),
    eyeOpenness: clamp(1 - blink),
  };
}

/** Iris position within the eye opening — the fallback gaze estimate. */
function gazeFromIris(points: NormalizedLandmark[]) {
  const irisL = points[IRIS_L];
  const irisR = points[IRIS_R];
  if (!irisL || !irisR) return { gazeX: 0, gazeY: 0, eyeOpenness: 1 };

  const horizontal = (
    iris: NormalizedLandmark,
    outer: NormalizedLandmark,
    inner: NormalizedLandmark,
  ) => {
    const width = inner.x - outer.x || 1e-6;
    // 0 at the outer corner, 1 at the inner corner; 0.5 is centred.
    return clamp(((iris.x - outer.x) / width - 0.5) * 2, -1, 1);
  };

  const openness = (upper?: NormalizedLandmark, lower?: NormalizedLandmark) => {
    if (!upper || !lower) return 1;
    // Lid gap scaled by eye width, so it survives moving nearer or further away.
    const eyeWidth =
      Math.abs(points[EYE_R_OUTER].x - points[EYE_L_OUTER].x) || 1e-6;
    return clamp((Math.abs(lower.y - upper.y) / eyeWidth) * 12);
  };

  const xLeft = horizontal(irisL, points[EYE_L_OUTER], points[EYE_L_INNER]);
  const xRight = horizontal(irisR, points[EYE_R_OUTER], points[EYE_R_INNER]);

  const centreY = (points[LID_L_UPPER].y + points[LID_L_LOWER].y) / 2;
  const lidGap = points[LID_L_LOWER].y - points[LID_L_UPPER].y || 1e-6;

  return {
    // Image-left corresponds to the subject's right, hence the negation.
    gazeX: clamp(-(xLeft + xRight) / 2, -1, 1),
    gazeY: clamp(((centreY - irisL.y) / lidGap) * 2, -1, 1),
    eyeOpenness: clamp(
      (openness(points[LID_L_UPPER], points[LID_L_LOWER]) +
        openness(points[LID_R_UPPER], points[LID_R_LOWER])) /
        2,
    ),
  };
}

/** Turns one MediaPipe result into a normalised, source-agnostic sample. */
export function toGazeSample(
  result: FaceLandmarkerResult,
  timestamp: number,
): GazeSample {
  const points = result.faceLandmarks?.[0];

  if (!points || points.length === 0) {
    return {
      timestamp,
      faceDetected: false,
      yaw: 0,
      pitch: 0,
      roll: 0,
      gazeX: 0,
      gazeY: 0,
      eyeOpenness: 0,
      facePositionX: 0.5,
      facePositionY: 0.5,
      faceScale: 0,
    };
  }

  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  const orientation =
    matrix && matrix.length >= 16
      ? eulerFromMatrix(matrix)
      : eulerFromLandmarks(points);

  const shapes = blendshapeMap(result);
  // Blendshapes are the better signal; iris geometry covers models built
  // without them.
  const eyes =
    shapes.size > 0
      ? gazeFromBlendshapes(shapes)
      : points.length > IRIS_R
        ? gazeFromIris(points)
        : { gazeX: 0, gazeY: 0, eyeOpenness: 1 };

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  return {
    timestamp,
    faceDetected: true,
    yaw: orientation.yaw,
    pitch: orientation.pitch,
    roll: orientation.roll,
    gazeX: eyes.gazeX,
    gazeY: eyes.gazeY,
    eyeOpenness: eyes.eyeOpenness,
    facePositionX: (minX + maxX) / 2,
    facePositionY: (minY + maxY) / 2,
    faceScale: Math.max(maxX - minX, maxY - minY),
  };
}

export interface ScoreBreakdown {
  head: number;
  gaze: number;
  eyes: number;
  total: number;
}

/**
 * Collapses a sample into a single 0..1 "looking at the monitor" confidence.
 *
 * The three terms compose multiplicatively rather than as a weighted sum, which
 * matters more than it sounds:
 *
 *  - **Head aim** can drive the result to zero on its own. Turning to face
 *    someone behind you is unambiguously looking away, whatever your eyes do.
 *  - **Eye aim** can only attenuate — down to a floor — because a webcam's
 *    estimate of eyeball direction is far noisier than its estimate of head
 *    pose. Glancing to the edge of a wide monitor should cost confidence, not
 *    erase it.
 *  - **Lid openness** barely moves the number at all, so an ordinary blink can
 *    never be mistaken for looking away.
 *
 * An additive model gets this wrong in a way that is easy to miss: with the
 * head fully turned, the untouched eye and lid terms hold the total above the
 * away threshold and playback never triggers.
 */

/** How far eye aim alone may pull the score down. */
const EYE_AIM_FLOOR = 0.35;
/** How far lid closure alone may pull the score down. */
const LID_FLOOR = 0.88;

export function scoreSample(
  sample: GazeSample,
  settings: AttentionSettings,
  calibration: Calibration | null,
): ScoreBreakdown {
  if (!sample.faceDetected) {
    return { head: 0, gaze: 0, eyes: 0, total: 0 };
  }

  const yawDeviation = Math.abs(sample.yaw - (calibration?.yaw ?? 0));
  const pitchDeviation = Math.abs(sample.pitch - (calibration?.pitch ?? 0));
  const gazeXDeviation = Math.abs(sample.gazeX - (calibration?.gazeX ?? 0));
  const gazeYDeviation = Math.abs(sample.gazeY - (calibration?.gazeY ?? 0));

  // Vertical tolerance is looser in both terms: monitors are wider than they
  // are tall, and people sit above or below the camera line as a matter of course.
  const head =
    falloff(yawDeviation, settings.headTolerance) *
    falloff(pitchDeviation, settings.headTolerance * 1.35);

  const gaze =
    falloff(gazeXDeviation, settings.gazeTolerance) *
    falloff(gazeYDeviation, settings.gazeTolerance * 1.3);

  const eyes = clamp(sample.eyeOpenness);

  const total = clamp(
    head *
      (EYE_AIM_FLOOR + (1 - EYE_AIM_FLOOR) * gaze) *
      (LID_FLOOR + (1 - LID_FLOOR) * eyes),
  );

  return { head, gaze, eyes, total };
}

export function captureCalibration(samples: GazeSample[]): Calibration | null {
  const valid = samples.filter((sample) => sample.faceDetected);
  if (valid.length < 3) return null;

  // Median rather than mean — one bad frame shouldn't skew the neutral pose.
  const median = (pick: (sample: GazeSample) => number) => {
    const sorted = valid.map(pick).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  return {
    yaw: median((sample) => sample.yaw),
    pitch: median((sample) => sample.pitch),
    gazeX: median((sample) => sample.gazeX),
    gazeY: median((sample) => sample.gazeY),
    capturedAt: Date.now(),
  };
}
