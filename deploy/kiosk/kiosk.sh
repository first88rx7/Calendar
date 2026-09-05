#!/usr/bin/env bash
# Full-screen Chromium/Cog launcher. No desktop, no browser chrome.
set -euo pipefail

KIOSK_DIR="${HOME}/household-kiosk"
if [[ -z "${HOUSEHOLD_URL:-}" && -f "${KIOSK_DIR}/url" ]]; then
  HOUSEHOLD_URL="$(tr -d '[:space:]' < "${KIOSK_DIR}/url")"
fi
URL="${HOUSEHOLD_URL:-http://127.0.0.1:3847}"
BROWSER="${HOUSEHOLD_BROWSER:-}"

export DISPLAY="${DISPLAY:-:0}"
xset s off || true
xset -dpms || true
xset s noblank || true
unclutter -idle 2 -root >/dev/null 2>&1 &

pick_browser() {
  if [[ -n "${BROWSER}" ]] && command -v "${BROWSER}" >/dev/null 2>&1; then
    echo "${BROWSER}"
    return
  fi
  for candidate in chromium chromium-browser cog; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      echo "${candidate}"
      return
    fi
  done
  return 1
}

run_browser() {
  local bin="$1"
  case "${bin}" in
    cog)
      cog --platform=fdo "${URL}"
      ;;
    *)
      "${bin}" \
        --kiosk \
        --app="${URL}" \
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
        --overscroll-history-navigation=0 \
        "${URL}"
      ;;
  esac
}

BROWSER_BIN="$(pick_browser || true)"
if [[ -z "${BROWSER_BIN}" ]]; then
  echo "No kiosk browser found (chromium, chromium-browser, or cog)." >&2
  exit 1
fi

echo "Opening ${URL} in ${BROWSER_BIN}"
while true; do
  run_browser "${BROWSER_BIN}" || true
  sleep 3
done
