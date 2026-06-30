# VHS tape for the Engram quickstart GIF.
#
# To record:  vhs docs/quickstart.tape
# To preview: vhs docs/quickstart.tape --preview
# To install vhs:  brew install vhs
#
# Output lands at docs/quickstart.gif. Once recorded, embed in README under
# the headline (placeholder marker is already in place).

Output docs/quickstart.gif

Require engram

Set Shell "bash"
Set FontSize 16
Set FontFamily "JetBrains Mono"
Set Width 1000
Set Height 600
Set Padding 20
Set TypingSpeed 35ms
Set PlaybackSpeed 1.0
Set Theme "Catppuccin Mocha"

# ── Setup (hidden) ──
# Wrap `engram` so its diagnostic stderr (INFO logs, the embedding spinner) is
# hidden during recording — the demo then shows only the command results, which
# print to stdout. This keeps the shell prompt intact (unlike `exec 2>/dev/null`,
# which would also swallow PS1). Functionality is unaffected.
Hide
Type 'engram() { command engram "$@" 2>/dev/null; }'
Enter
# Shim `npm install` to a fast, representative success line. The real global
# install rebuilds native modules and takes far longer than any reasonable
# on-camera pause, so recording it live just produces noise and races the
# commands that follow. The demo shows the exact command a user runs; only the
# multi-second build is elided.
Type 'npm() { echo; echo "added 142 packages in 9s"; echo; }'
Enter
Type "clear"
Enter
Show
Sleep 800ms

# ── Pitch line ──
Type "# Give your AI agent persistent memory in under a minute."
Sleep 1500ms
Enter
Sleep 600ms

# ── Install ──
Type "npm install -g @hbarefoot/engram"
Sleep 500ms
Enter
Sleep 1800ms

# ── Store memories ──
# Sleeps are generous on purpose: each `engram` invocation is a fresh process
# that loads the embedding model from cache (~1s warm, longer on the very first
# call), and the output must finish rendering before the next line is typed.
Type "engram remember 'I prefer Fastify over Express for Node APIs' -c preference"
Sleep 400ms
Enter
Sleep 4s

Type "engram remember 'Production database is PostgreSQL 15' -c fact"
Sleep 400ms
Enter
Sleep 4s

# ── Recall ──
Type "engram recall 'what web framework do I use?'"
Sleep 400ms
Enter
Sleep 4500ms

# ── Outro ──
Type "# That's it. Memories persist across sessions, restarts, and AI clients."
Sleep 1500ms
Enter
Sleep 1500ms
