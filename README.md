<div align="center">

# Peripheral

**Your screen notices when you stop watching.**

Peripheral watches your gaze through the laptop camera. Look away from the
monitor and your clip starts playing; look back and it stops mid-frame. Step
away from the machine entirely and an inactivity fallback takes the whole screen
until you close it.

Every frame is processed on-device. Nothing is uploaded, ever.

</div>

---

## How it works

Two independent triggers feed one player.

### 1. The look-away trigger (camera)

A MediaPipe face landmark model runs in WebAssembly against the webcam feed and
produces, per frame, a head rotation matrix and a set of ARKit-style
blendshapes. `src/lib/attention/gaze.ts` turns those into a normalised sample —
head yaw/pitch, eyeball direction, lid openness — and collapses it into a single
0–1 confidence that you are looking at the monitor.

The three terms compose **multiplicatively**, which is the part that matters:

| Term | Can it zero the score? | Why |
| --- | --- | --- |
| Head aim | Yes | Turning to face someone behind you is unambiguously looking away. |
| Eye aim | No — floors at 0.35 | Webcam gaze estimation is noisy; glancing at the edge of a wide monitor should cost confidence, not erase it. |
| Lid openness | No — floors at 0.88 | An ordinary blink must never read as looking away. |

`src/lib/attention/engine.ts` then turns that noisy per-frame number into a
stable state using two mechanisms:

- **Hysteresis** — separate look-away and look-back thresholds with a dead band
  between them, so a score hovering at the boundary cannot oscillate.
- **Dwell timers** — crossing a threshold only *arms* a transition. The signal
  has to hold for the configured delay before the state flips, so glancing at
  your keyboard doesn't start a video.

Because everyone's monitor, camera, and posture differ, deviations are measured
from a **calibrated neutral pose** rather than from zero. Sit normally, look at
the screen, hit *Calibrate*, and the tracker treats that as centre.

### 2. The inactivity fallback (no camera required)

`src/lib/idle/idle-watcher.ts` watches for keyboard, pointer, wheel, scroll, and
touch input. If the machine goes untouched for the timeout — camera on, off, or
denied — the clip plays **fullscreen** and is *sticky*: it stays up until you
dismiss it by hand, even once you start typing again.

Idle outranks gaze and can promote an in-flight look-away session to a sticky
one, so the two triggers never fight over the same player.

## Your videos

Clips come from two places, and they behave differently on purpose.

**Committed to the repository** — drop any video into `public/videos/` and it
appears in the library automatically. `src/app/api/bundled-videos/route.ts`
enumerates the directory at request time, so there is no manifest to update and
no rebuild required. The filename becomes the display name
(`deep-work-loop.mp4` → "Deep Work Loop"). Supported: `.mp4`, `.m4v`, `.webm`,
`.ogv`, `.mov`, `.mkv`.

**Uploaded in the browser** — drag files onto the library panel. They are stored
in IndexedDB on your machine and never sent to a server. This is the right path
for anything large or personal.

**Clips are not committed.** `public/videos/` is gitignored apart from its
README — the repository holds the code, not footage. A fresh clone therefore
starts with an empty library; add a clip either way above and it works
immediately.

When several clips are present the most recently added one is the default
selection, and you can pick a different one in the library at any time. Files
sharing a basename are grouped into a single entry with multiple sources, so
`clip.mp4` alongside `clip.webm` is one library item that plays in browsers
that disagree about codecs.

## Getting started

```bash
npm install     # also vendors the MediaPipe runtime into public/
npm run dev     # http://localhost:3000
```

Then: **Start attention tracking** → allow the camera → **Calibrate** → look away.

> The camera requires a secure context. `localhost` counts; deploying anywhere
> else means serving over HTTPS.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run test` | Unit tests for the gaze scoring and state machine |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run check` | All three of the above |

## Privacy

- The landmark model and its WebAssembly runtime are served from **your own
  origin**, vendored out of `node_modules` by `scripts/setup-vision-assets.mjs`
  on `postinstall`. No CDN request is made when they are present.
- Video frames are read into WebAssembly memory and discarded. No frame,
  landmark, or score leaves the browser.
- Uploaded clips live in IndexedDB; settings and calibration live in
  localStorage. There is no server-side storage and no analytics.
- The camera is released the moment tracking is switched off — the indicator
  light is never on for a feature you disabled.

## Architecture

```
src/
├── app/
│   ├── api/bundled-videos/   Enumerates public/videos at request time
│   ├── layout.tsx            Fonts, metadata, providers
│   └── page.tsx              Dashboard composition
├── components/
│   ├── attention/            Provider (owns camera + engine), orb, canvas, tuning
│   ├── library/              Dropzone, clip cards
│   ├── player/               Playback director + fullscreen overlay player
│   ├── shell/                Top bar, hero, stats, activity feed, backdrop
│   └── ui/                   Button, card, switch, slider, tabs, dialog, tooltip
├── hooks/                    Fullscreen, media library
└── lib/
    ├── attention/            gaze.ts (math) · engine.ts (state machine) · face-tracker.ts (camera + model)
    ├── idle/                 Inactivity watcher
    ├── media/                IndexedDB clip store, thumbnail probe
    └── store/                Persisted settings · transient session state
```

Two React contexts carry the runtime. `AttentionProvider` owns the single
`<video>` element, the tracker, and the state machine; every preview surface
paints from that one element onto its own canvas, so the dashboard and the
in-player thumbnail never fight over the camera. `PlaybackProvider` is the
director — it watches both triggers and decides what the player does about them.

State is split by lifetime: `settings-store` is persisted to localStorage and
gates camera startup on hydration, while `session-store` holds the ~30 Hz
attention reading and is subscribed to with selectors so a new frame doesn't
re-render the whole page.

## Tuning

Every number the state machine uses is exposed in the **Tuning** panel and
persisted. The ones worth reaching for first:

- **Inactivity timeout** — defaults to three minutes before the fullscreen
  fallback takes over.
- **Look-away delay** — raise it if glancing at your keyboard triggers playback.
- **Head tolerance** — widen it for large monitors or close seating.
- **Look-back delay** — keep it short; it is the responsiveness you feel most.
- **Smoothing** — higher is steadier but slower to react.

The live signal trace under the sensor shows the smoothed score against both
thresholds, so you can see the effect of a slider as you drag it.

## Caveats

Gaze estimation from a laptop webcam is an approximation, not eye-tracking
hardware. It degrades in low light, with heavy glasses glare, and at sharp
angles to the camera. Calibration and the sensitivity sliders exist because the
right thresholds genuinely depend on your desk.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Radix UI
primitives · Motion · Zustand · MediaPipe Tasks Vision · Vitest

## Scene puzzle game

Visit `/puzzle-game` (or select **Puzzle game** in the header) to capture a live
camera scene and play a 3 × 3 sliding photo puzzle with eight pieces and one gap.

- Open the camera, allow permission, and capture a detailed scene. Front/back
  camera switching uses the cameras available on the device. Capture uses the
  same centered square crop as the preview and immediately releases the camera.
- Select **Shuffle & start** to begin a solvable puzzle and the timer. Tap/click
  a neighboring tile, or focus the board and use arrow keys to move a tile in
  that direction. The solved gap belongs at the bottom right.
- The timer below the board stops on the final move; switching tabs does not
  pause it. The original image and optional tile numbers help with orientation.
- The ten fastest completed rounds persist in this browser, with gold, silver,
  and bronze medals followed by ranks 4–10. Tied times use fewer moves first.
  This is a personal device-local scoreboard, not a shared online leaderboard.
- Photos remain in memory and are never uploaded or stored with scores. Camera
  access needs HTTPS (or localhost) and is released on capture, cancellation,
  navigation, and when the page is hidden. The attention tracker is unmounted
  on the puzzle route so it cannot compete for the camera.

Validation: `npm test` includes shuffle parity, legal moves, completion timing,
score ranking, invalid storage recovery, and timer formatting. To manually check
camera behavior, use a camera-enabled browser over HTTPS, capture a scene,
complete a puzzle, reload to confirm scores, and test denied permissions,
camera switching, narrow screens, keyboard controls, and leaving the page.
