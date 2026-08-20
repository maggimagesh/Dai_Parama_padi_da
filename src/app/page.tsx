import { AttentionPanel } from "@/components/attention/attention-panel";
import { TuningPanel } from "@/components/attention/tuning-panel";
import { LibraryPanel } from "@/components/library/library-panel";
import { AmbientPlayer } from "@/components/player/ambient-player";
import { ActivityFeed } from "@/components/shell/activity-feed";
import { AmbientBackdrop } from "@/components/shell/ambient-backdrop";
import { Hero } from "@/components/shell/hero";
import { StatStrip } from "@/components/shell/stat-strip";
import { TopBar } from "@/components/shell/top-bar";

export default function Home() {
  return (
    <>
      <AmbientBackdrop />
      <TopBar />

      <main className="mx-auto w-full max-w-[100rem] flex-1 px-5 pb-20 sm:px-8">
        <Hero />

        <StatStrip className="mt-10" />

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <AttentionPanel />
            <TuningPanel />
          </div>

          <div className="flex flex-col gap-4">
            <LibraryPanel />
            <ActivityFeed className="min-h-72 flex-1" />
          </div>
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[0.6875rem] text-ink-faint sm:px-8">
          <p>
            Face landmarks run locally through MediaPipe Tasks Vision. No frames
            leave this device.
          </p>
          <p>
            Drop clips into{" "}
            <code className="rounded bg-white/8 px-1 py-0.5 font-mono">
              public/videos
            </code>{" "}
            to ship them with the repository.
          </p>
        </div>
      </footer>

      <AmbientPlayer />
    </>
  );
}
