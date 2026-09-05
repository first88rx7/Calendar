#!/usr/bin/env bash
# Chromium/Cog kiosk launcher for Raspberry Pi OS or Armbian.
set -euo pipefail

URL="${HOUSEHOLD_URL:-http://127.0.0.1:3847}"
BROWSER="${HOUSEHOLD_BROWSER:-chromium}"

export DISPLAY="${DISPLAY:-:0}"
xset s off || true
xset -dpms || true
xset s noblank || true
unclutter -idle 3 -root >/dev/null 2>&1 &

if command -v "$BROWSER" >/dev/null 2>&1; then
  exec "$BROWSER" \
    --kiosk \
    --app="$URL" \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-notifications \
    --disable-sync \
    --disable-background-networking \
    --disable-dev-shm-usage \
    --disable-gpu \
    --disable-software-rasterizer \
    --memory-pressure-off \
    --check-for-update-interval=31536000 \
    --start-maximized \
    --hide-scrollbars \
    --autoplay-policy=no-user-gesture-required \
    --no-first-run \
    "$URL"
fi

if command -v chromium-browser >/dev/null 2>&1; then
  BROWSER=chromium-browser
  exec "$BROWSER" --kiosk --app="$URL" --disable-dev-shm-usage --disable-gpu --noerrdialogs --disable-infobars "$URL"
fi

if command -v cog >/dev/null 2>&1; then
  exec cog "$URL"
fi

echo "No kiosk browser found (chromium, chromium-browser, or cog)." >&2
exit 1
