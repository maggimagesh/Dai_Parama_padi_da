import { cn } from "@/lib/utils";

/**
 * An aperture that is also a pupil — the two things the product is about.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-xl border border-hairline-strong bg-linear-160 from-white/12 to-white/[0.02]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-signal)" />
            <stop offset="100%" stopColor="var(--color-signal-deep)" />
          </linearGradient>
        </defs>
        <path
          d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
          fill="none"
          stroke="url(#logo-grad)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3.1" fill="url(#logo-grad)" />
        <circle cx="13.1" cy="10.9" r="0.9" fill="oklch(0.12 0.01 265)" />
      </svg>
    </span>
  );
}
