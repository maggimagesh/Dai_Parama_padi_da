import type { NextConfig } from "next";

/**
 * Response headers.
 *
 * The Content-Security-Policy is not here — it is per-request and nonce-based,
 * so it lives in `src/middleware.ts`. These are the static counterparts.
 */
const securityHeaders = [
  // This app asks for a webcam. Permissions-Policy keeps that capability on
  // this origin and denies every other powerful feature outright, so an
  // embedded frame cannot ask for the camera on the page's behalf.
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "display-capture=()",
      "usb=()",
      "payment=()",
      "interest-cohort=()",
    ].join(", "),
  },
  // Belt-and-braces alongside the CSP's frame-ancestors, for anything that
  // still honours only the older header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  // Keep the camera stream out of reach of cross-origin documents.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework and its version.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
