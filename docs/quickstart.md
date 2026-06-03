# Quickstart recording — how to refresh the README GIF

The hero GIF on the README is recorded with [VHS](https://github.com/charmbracelet/vhs). The tape file is at `docs/quickstart.tape`; the output GIF lives at `docs/quickstart.gif` and is embedded under the README headline.

## One-time setup

```bash
brew install vhs ttyd ffmpeg            # macOS
# or follow https://github.com/charmbracelet/vhs#installation
```

Verify your fonts include "JetBrains Mono" (the tape file references it). If not, either install JetBrains Mono or edit `Set FontFamily` in `docs/quickstart.tape`.

## Record

```bash
# Make sure engram is installed globally so the demo commands work
npm install -g @hbarefoot/engram

# Render the GIF (takes ~30 seconds)
vhs docs/quickstart.tape

# Preview before committing
open docs/quickstart.gif
```

## Embed in README

A placeholder marker sits in `README.md` immediately below the install code block:

```html
<!-- TODO: insert GIF here once recorded —
     <p align="center"><img src="docs/quickstart.gif" alt="Engram quickstart demo" width="900"></p>
-->
```

Replace the comment with the uncommented `<p align="center">…</p>` line when the GIF is ready.

## Re-recording

When commands, versions, or visual style change, re-edit `docs/quickstart.tape` and re-run `vhs`. Commit both the tape and the GIF. The tape doubles as the script for any future video — Loom, conference talk slot, asciinema cast — so keep it readable.

## Troubleshooting

- **"Command not found: engram"** during render — install globally first.
- **Output GIF is tiny / huge** — adjust `Set Width` and `Set Height` in the tape.
- **Demo runs too fast / slow** — tune `Set TypingSpeed` (per-keystroke) and the `Sleep` durations between sections.
- **`Require engram` errors** — that directive tells VHS to fail early if the binary isn't on PATH. Install before recording.
