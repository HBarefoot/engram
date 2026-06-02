#!/usr/bin/env bash
# track-downloads.sh — append a one-row snapshot of npm download stats to stats/downloads.csv
#
# Designed to be wired to a daily cron later. Run manually for now:
#   bash scripts/track-downloads.sh
#
# Output CSV columns: timestamp, package, downloads_last_week, downloads_last_day, latest_version
# Header is written automatically on first run.

set -euo pipefail

PACKAGE="${1:-@hbarefoot/engram}"
STATS_DIR="$(cd "$(dirname "$0")/.." && pwd)/stats"
CSV="$STATS_DIR/downloads.csv"

mkdir -p "$STATS_DIR"

# Write header if file is empty or missing
if [[ ! -f "$CSV" || ! -s "$CSV" ]]; then
  echo "timestamp,package,downloads_last_week,downloads_last_day,latest_version" > "$CSV"
fi

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Use the npmjs downloads API — separate calls for week and day windows
WEEK_JSON="$(curl -fsS "https://api.npmjs.org/downloads/point/last-week/${PACKAGE}" || echo '{"downloads":0}')"
DAY_JSON="$(curl -fsS "https://api.npmjs.org/downloads/point/last-day/${PACKAGE}" || echo '{"downloads":0}')"

WEEK="$(echo "$WEEK_JSON" | sed -E 's/.*"downloads":([0-9]+).*/\1/')"
DAY="$(echo "$DAY_JSON" | sed -E 's/.*"downloads":([0-9]+).*/\1/')"

# Latest version from npm registry
VERSION="$(npm view "$PACKAGE" version 2>/dev/null || echo "unknown")"

echo "${TIMESTAMP},${PACKAGE},${WEEK},${DAY},${VERSION}" >> "$CSV"
echo "Recorded ${PACKAGE} @ ${TIMESTAMP}: week=${WEEK}, day=${DAY}, version=${VERSION}"
