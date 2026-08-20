/**
 * Vendors the MediaPipe vision runtime into `public/` so face tracking runs
 * entirely from this origin — no third-party CDN, no frames leaving the device.
 *
 * - WASM runtime: copied out of node_modules (always available after install).
 * - Landmark model: fetched once and cached on disk. If the network is
 *   unavailable the app falls back to the public CDN at runtime.
 *
 * Runs on `postinstall`; safe to re-run.
 */
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WASM_SRC = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const WASM_DEST = resolve(root, "public/mediapipe/wasm");
const MODEL_DEST = resolve(root, "public/mediapipe/models/face_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MODEL_MIN_BYTES = 1_000_000;

const log = (msg) => console.log(`[vision-assets] ${msg}`);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyWasmRuntime() {
  if (!(await exists(WASM_SRC))) {
    log("skipped WASM copy — @mediapipe/tasks-vision is not installed yet.");
    return;
  }
  await mkdir(dirname(WASM_DEST), { recursive: true });
  await cp(WASM_SRC, WASM_DEST, { recursive: true, force: true });
  log("WASM runtime vendored to public/mediapipe/wasm");
}

async function downloadModel() {
  if (await exists(MODEL_DEST)) {
    const { size } = await stat(MODEL_DEST);
    if (size > MODEL_MIN_BYTES) {
      log("landmark model already cached — skipping download.");
      return;
    }
    await rm(MODEL_DEST, { force: true });
  }

  await mkdir(dirname(MODEL_DEST), { recursive: true });
  log("downloading face landmark model (~3.7 MB)…");

  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(MODEL_DEST));
    log("landmark model cached to public/mediapipe/models");
  } catch (error) {
    await rm(MODEL_DEST, { force: true });
    log(
      `could not download the model (${error instanceof Error ? error.message : error}). ` +
        "The app will load it from the MediaPipe CDN instead.",
    );
  }
}

await copyWasmRuntime();
await downloadModel();
