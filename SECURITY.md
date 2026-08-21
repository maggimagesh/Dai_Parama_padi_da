# Security notes

This app holds a live webcam stream, which raises the stakes on everything
below: a script running here is a script with access to a camera. These are the
controls that exist, and the findings behind them.

## Camera data never leaves the machine

In the default configuration the app makes exactly two network requests of its
own: `/api/bundled-videos` (a directory listing) and a `HEAD` on the local model
file. There is no telemetry, no analytics, no upload path, and no WebSocket.
Frames go from `getUserMedia` into a WASM landmarker and are discarded.

Opting into the CDN fallback below adds requests for the runtime and model to
third-party origins. Those requests carry no camera data — they fetch assets —
but they do disclose to that origin that you are running this app, and the code
they return then executes with access to the stream.

To verify:

```bash
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon" src/
```

`connect-src 'self'` in the CSP enforces this at the browser level rather than
leaving it to code review.

## Vision runtime is local by default

`scripts/setup-vision-assets.mjs` vendors the MediaPipe WASM and landmark model
into `public/` on `postinstall`. The CDN fallback is **opt-in**, because runtime
fetched from a third party would execute with access to the camera stream.
Enable it only if you accept that:

```bash
# development
NEXT_PUBLIC_ALLOW_VISION_CDN=1 npm run dev

# production — must be set for the BUILD, not the server
NEXT_PUBLIC_ALLOW_VISION_CDN=1 npm run build
```

**This is a `NEXT_PUBLIC_` variable, so its value is inlined at build time** —
in the middleware that sets the CSP as much as in the browser bundle. Setting it
only when starting the server does nothing. Verified by building with it set,
then running that build without it: the CSP still carried the CDN origins.

One switch drives both sides — the CSP that permits the CDN and the code path
that uses it — so they cannot drift into a half-state where the policy allows
what the code refuses. An earlier server-only override was removed for exactly
that reason: being run-time, it widened the policy while the tracker, already
built against the baked-in value, went on refusing the CDN.

Without the flag, missing or incomplete assets raise a clear error instead of
silently reaching out to a third party.

The model and the WASM runtime are vendored by separate steps that fail
independently, so both are probed before the local path is chosen.

## Headers

| Header                                | Value                                 | Why                                                                                            |
| ------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`             | nonce + `strict-dynamic`              | Blocks injected script. Per-request nonce, set in `src/middleware.ts`.                         |
| `Permissions-Policy`                  | `camera=(self)`, everything else `()` | Camera stays on this origin; embedded frames cannot request it.                                |
| `X-Frame-Options` / `frame-ancestors` | `DENY` / `'none'`                     | Clickjacking is the sharpest risk here — framed and disguised, a click could start the camera. |
| `X-Content-Type-Options`              | `nosniff`                             | No MIME sniffing on user-supplied video.                                                       |
| `Referrer-Policy`                     | `no-referrer`                         | Nothing to leak, so leak nothing.                                                              |
| `Cross-Origin-Opener-Policy`          | `same-origin`                         | Severs `window.opener` access to a page holding a camera.                                      |
| `Cross-Origin-Resource-Policy`        | `same-origin`                         | Clips are not embeddable cross-origin.                                                         |

`X-Powered-By` is disabled.

### The CSP needs dynamic rendering

A nonce cannot appear in a statically prerendered document — the HTML is built
once, the nonce changes per request, and every script gets refused. `/` reads
`headers()` in the root layout to opt into dynamic rendering. Removing that call
silently breaks the whole page under CSP, so if you change it, load the app and
check the console for `Refused to…`.

`script-src` includes `'wasm-unsafe-eval'`, which permits WebAssembly
compilation only. It does not re-enable `eval()` for JavaScript.

## Deploying

`public/mediapipe/` is generated, not committed — `postinstall` rebuilds it at
build time. A failed model download does **not** fail the build, so check the
build log for `WARNING:` lines from `[vision-assets]`. Without the model, and
without the CDN opt-in, camera tracking is disabled while the rest of the app
still runs.

`public/videos/` ships empty by design, so a fresh deployment has no clip to
play until one is added through the app.

## Testing performed

- **Dependency audit** — `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities.
- **Injection sinks** — no `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
  `new Function`, `document.write`, or `srcdoc` anywhere in `src/`. Clip names
  reach the DOM as React text nodes, which escape by construction.
- **Path traversal** — encoded, double-encoded, and dot-segment variants against
  `/videos/` and `/api/`, plus direct requests for `.env`, `.git/config`,
  `package.json`, `next.config.ts`. All 404.
- **API surface** — `/api/bundled-videos` accepts no input at all: no path
  params, no query, no body. Query strings are provably ignored (byte-identical
  response). Mutating methods return 405. `TRACE` does not echo request headers,
  so no cross-site tracing.
- **Information disclosure** — the manifest exposes no filesystem paths.
- **Resource cleanup** — object URLs revoked, timers cleared, listeners
  balanced, camera tracks stopped on teardown. Matters because a leaked track
  keeps the camera light on.

## Known limits

- **Not audited for multi-user or hostile-network use.** It is a single-user
  local tool with no authentication. Do not expose it to a network you do not
  control.
- **`getUserMedia` requires a secure context.** `localhost` counts; a bare IP
  over plain HTTP does not. Serving it beyond localhost means real TLS, and
  HSTS belongs in that deployment.
- **Uploaded clips are capped at 750 MB** and held in IndexedDB, unencrypted,
  like any other browser storage. They are readable by anything with access to
  that browser profile.
- **A malicious video file is the browser's problem.** Decoding is delegated to
  the platform's media stack; the app performs no parsing of its own.
