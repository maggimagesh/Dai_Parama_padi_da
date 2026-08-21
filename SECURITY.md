# Security notes

This app holds a live webcam stream, which raises the stakes on everything
below: a script running here is a script with access to a camera. These are the
controls that exist, and the findings behind them.

## Camera data never leaves the machine

The app makes exactly two network requests of its own: `/api/bundled-videos`
(a directory listing) and a `HEAD` on the local model file. There is no
telemetry, no analytics, no upload path, and no WebSocket. Frames go from
`getUserMedia` into a WASM landmarker and are discarded.

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
ALLOW_VISION_CDN=1 NEXT_PUBLIC_ALLOW_VISION_CDN=1 npm run dev
```

Both variables are needed — one widens the CSP, the other unlocks the code path.
Without them a missing model raises a clear error instead of silently reaching
out to a CDN.

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
