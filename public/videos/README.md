# Your clips go here

Drop video files in this folder and they show up in Peripheral's library
automatically — no code change, no rebuild of a manifest.

**Nothing in here is committed.** This folder is gitignored apart from this
README, because the repository is for the code, not for redistributing footage.
If you want a clip to travel with the repo it has to be one you have the right
to publish — and even then, prefer Git LFS for anything sizeable.

The alternative is to skip this folder entirely: drag a file onto the library
panel in the app and it is stored in your browser's IndexedDB, never on disk
here and never in git.

## Conventions

- **Supported:** `.mp4`, `.m4v`, `.webm`, `.ogv`, `.mov`, `.mkv`
- **Naming:** the filename becomes the display name, so `deep-work-loop.mp4`
  is listed as "Deep Work Loop".
- **Alternate encodes:** files sharing a basename become one library entry with
  several sources — `clip.mp4` and `clip.webm` is a single "Clip" the browser
  can play either way. MP4 is offered first.
- **Ordering:** newest-first by file modification time, so the clip you just
  added becomes the default selection.
- **Discovery:** handled at request time by `src/app/api/bundled-videos/route.ts`.

## Encoding

Prefer **H.264 in MP4** or **VP9 in WebM**. Both play essentially everywhere,
and shipping one of each covers browser builds that lack H.264.

Watch out for HEVC and `.mov`: iPhone and macOS recordings are usually HEVC in
a QuickTime container, which Safari plays but Chrome and Firefox generally do
not. Convert before using:

```bash
# H.264 / AAC — the widely hardware-accelerated option
ffmpeg -i input.mov -c:v libx264 -crf 20 -pix_fmt yuv420p \
       -c:a aac -b:a 128k -movflags +faststart clip.mp4

# VP9 / Opus — the fallback for builds without H.264
ffmpeg -i input.mov -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 \
       -pix_fmt yuv420p -c:a libopus -b:a 96k clip.webm
```

Naming both `clip.*` puts them under one library entry.
