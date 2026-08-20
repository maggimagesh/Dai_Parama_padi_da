# Bundled clips

Drop video files in this folder and they show up in Peripheral's library
automatically — no code change, no rebuild of a manifest.

- **Supported:** `.mp4`, `.m4v`, `.webm`, `.ogv`, `.mov`, `.mkv`
- **Naming:** the filename becomes the display name, so `deep-work-loop.mp4`
  is listed as "Deep Work Loop".
- **Discovery:** handled at request time by `src/app/api/bundled-videos/route.ts`.

For broad browser support prefer H.264 MP4 or VP9 WebM. Large files are worth
keeping out of git history — for anything sizeable, use Git LFS or upload the
clip through the app instead, which stores it locally in your browser.
