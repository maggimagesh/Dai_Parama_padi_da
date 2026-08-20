"use client";

import * as React from "react";

/**
 * Fullscreen control with the vendor-prefixed WebKit path Safari still needs.
 * Requests can be rejected (no user gesture, embedded frame), so callers get a
 * boolean back rather than an exception.
 */
export function useFullscreen(target: React.RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const enter = React.useCallback(async () => {
    const element = target.current;
    if (!element || document.fullscreenElement) return false;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen({ navigationUI: "hide" });
      } else {
        const webkit = element as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        };
        if (!webkit.webkitRequestFullscreen) return false;
        await webkit.webkitRequestFullscreen();
      }
      return true;
    } catch {
      // Browsers refuse fullscreen without a user gesture. The overlay still
      // covers the viewport, so this is a graceful degradation, not a failure.
      return false;
    }
  }, [target]);

  const exit = React.useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      /* Already exited, or the document lost focus. */
    }
  }, []);

  return { isFullscreen, enter, exit };
}
