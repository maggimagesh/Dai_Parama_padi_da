import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy.
 *
 * This app holds a camera stream, so the cost of an injected script here is far
 * higher than in an ordinary page: it would be script running with access to a
 * live webcam feed. The policy is therefore nonce-based rather than
 * `unsafe-inline` — Next.js reads the nonce back out of this header and stamps
 * it onto its own bootstrap scripts.
 *
 * The vision runtime is served from this origin (vendored by
 * `scripts/setup-vision-assets.mjs`). Third-party origins are deliberately
 * absent: WASM fetched from a CDN would execute with access to that same camera
 * stream. Set `ALLOW_VISION_CDN=1` to widen the policy for the CDN fallback.
 */

const ALLOW_CDN = process.env.ALLOW_VISION_CDN === "1";

const CDN_ORIGINS = [
  "https://cdn.jsdelivr.net",
  "https://storage.googleapis.com",
];

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Next.js loads further chunks from its own bootstrap; strict-dynamic lets
    // those through on the nonce's authority instead of a blanket host allow.
    "'strict-dynamic'",
    // MediaPipe compiles its vision runtime at load time. Note this is
    // `wasm-unsafe-eval`, which permits WebAssembly *only* — it does not
    // re-enable eval() for JavaScript.
    "'wasm-unsafe-eval'",
    ...(ALLOW_CDN ? CDN_ORIGINS : []),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Inline style attributes are how the animation library applies transforms.
    // Style injection is a far weaker primitive than script injection.
    "style-src 'self' 'unsafe-inline'",
    // data: for generated poster frames, blob: for uploaded clips.
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${ALLOW_CDN ? ` ${CDN_ORIGINS.join(" ")}` : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    // Clickjacking is the sharpest risk for a camera app: framed in an
    // attacker's page, a disguised click could start the camera.
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  const csp = directives.join("; ");

  // Next.js picks the nonce up from this request header.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, which are served without inline script
    // and would only pay the cost of a dynamic response.
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
