import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/shell/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Peripheral — attention-aware video playback",
    template: "%s · Peripheral",
  },
  description:
    "Peripheral uses your laptop camera to detect when you look away from the monitor and plays your video until you look back. If you step away entirely, an inactivity fallback takes the screen.",
  applicationName: "Peripheral",
  keywords: [
    "gaze detection",
    "attention tracking",
    "webcam",
    "video player",
    "MediaPipe",
    "Next.js",
  ],
  authors: [{ name: "Peripheral" }],
  openGraph: {
    title: "Peripheral — attention-aware video playback",
    description:
      "Look away and it plays. Look back and it stops. All processing happens on your device.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * Reading the nonce opts this route out of static prerendering, which is what
 * makes the nonce-based CSP in `src/middleware.ts` work at all: a prerendered
 * document is built once and cannot carry a per-request nonce, so every script
 * on it would be refused. Next.js stamps the nonce onto its own bootstrap
 * scripts once the request header is read here.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await headers();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
