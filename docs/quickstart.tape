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
Hide
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
# Real install is ~10s of scroll. Skip the scroll, keep the visible cue.
Type "npm install -g @hbarefoot/engram"
Sleep 500ms
Enter
Hide
Sleep 9s
Show
Sleep 600ms

# ── Store memories ──
Type "engram remember 'I prefer Fastify over Express for Node APIs' -c preference"
Sleep 400ms
Enter
Sleep 2500ms

Type "engram remember 'Production database is PostgreSQL 15' -c fact"
Sleep 400ms
Enter
Sleep 2500ms

# ── Recall ──
Type "engram recall 'what web framework do I use?'"
Sleep 400ms
Enter
Sleep 3500ms

# ── Outro ──
Type "# That's it. Memories persist across sessions, restarts, and AI clients."
Sleep 1500ms
Enter
Sleep 1500ms
