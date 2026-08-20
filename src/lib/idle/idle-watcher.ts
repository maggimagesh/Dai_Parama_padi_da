/**
 * Fallback trigger: watches for real user input and reports when the machine
 * has gone untouched for long enough.
 *
 * This is deliberately independent of the camera. If the webcam is off, denied,
 * or simply can't see you, inactivity still starts playback — which is the
 * behaviour the product promises.
 */

const ACTIVITY_EVENTS = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

export interface IdleWatcherOptions {
  timeoutMs: number;
  onIdle: () => void;
  onActive: () => void;
  /** Polling cadence for the deadline check. */
  tickMs?: number;
}

export class IdleWatcher {
  private options: IdleWatcherOptions;
  private lastActivity = Date.now();
  private idle = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private attached = false;

  constructor(options: IdleWatcherOptions) {
    this.options = options;
  }

  get idleMs() {
    return Date.now() - this.lastActivity;
  }

  get isIdle() {
    return this.idle;
  }

  setTimeoutMs(timeoutMs: number) {
    this.options.timeoutMs = timeoutMs;
  }

  private handleActivity = () => {
    this.lastActivity = Date.now();
    if (this.idle) {
      this.idle = false;
      this.options.onActive();
    }
  };

  private tick = () => {
    if (this.idle) return;
    if (this.idleMs >= this.options.timeoutMs) {
      this.idle = true;
      this.options.onIdle();
    }
  };

  private handleVisibility = () => {
    // Returning to the tab counts as activity; leaving it does not, so walking
    // away with the window backgrounded still trips the timer.
    if (document.visibilityState === "visible") this.handleActivity();
  };

  start() {
    if (this.attached || typeof window === "undefined") return;
    this.attached = true;
    this.lastActivity = Date.now();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, this.handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", this.handleVisibility);

    this.timer = setInterval(this.tick, this.options.tickMs ?? 500);
  }

  /** Marks the user active without needing a real input event. */
  nudge() {
    this.handleActivity();
  }

  stop() {
    if (!this.attached) return;
    this.attached = false;
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, this.handleActivity);
    }
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.idle = false;
  }
}
