#!/usr/bin/env bash
# Full-screen Chromium/Cog launcher. No desktop, no browser chrome.
set -u

KIOSK_DIR="${HOME}/household-kiosk"
LOG="${KIOSK_DIR}/kiosk.log"
mkdir -p "${KIOSK_DIR}"

if [[ -z "${HOUSEHOLD_URL:-}" && -f "${KIOSK_DIR}/url" ]]; then
  HOUSEHOLD_URL="$(tr -d '[:space:]' < "${KIOSK_DIR}/url")"
fi
URL="${HOUSEHOLD_URL:-http://127.0.0.1:3847}"
BROWSER="${HOUSEHOLD_BROWSER:-}"
if [[ -z "${BROWSER}" && -f "${KIOSK_DIR}/browser" ]]; then
  BROWSER="$(tr -d '[:space:]' < "${KIOSK_DIR}/browser")"
fi

log() {
  printf '%s %s\n' "$(date -Is)" "$*" | tee -a "${LOG}" >/dev/tty1 2>/dev/null || printf '%s %s\n' "$(date -Is)" "$*" >>"${LOG}"
}

ensure_runtime_dir() {
  if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
    export XDG_RUNTIME_DIR="/run/user/$(id -u)"
  fi
  mkdir -p "${XDG_RUNTIME_DIR}" 2>/dev/null || true
  chmod 700 "${XDG_RUNTIME_DIR}" 2>/dev/null || true
}

pick_browser() {
  if [[ -n "${BROWSER}" ]] && command -v "${BROWSER}" >/dev/null 2>&1; then
    echo "${BROWSER}"
    return
  fi
  # Prefer Cog on small boards — Chromium OOMs and hangs on reload.
  local mem
  mem="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 999999)"
  if [[ "${mem}" -lt 900000 ]]; then
    for candidate in cog chromium chromium-browser epiphany midori; do
      if command -v "${candidate}" >/dev/null 2>&1; then
        echo "${candidate}"
        return
      fi
    done
  else
    for candidate in chromium chromium-browser cog epiphany midori; do
      if command -v "${candidate}" >/dev/null 2>&1; then
        echo "${candidate}"
        return
      fi
    done
  fi
  return 1
}

prepare_x11() {
  export DISPLAY="${DISPLAY:-:0}"
  xset s off >/dev/null 2>&1 || true
  xset -dpms >/dev/null 2>&1 || true
  xset s noblank >/dev/null 2>&1 || true
  unclutter -idle 2 -root >/dev/null 2>&1 &
}

run_cog() {
  # WPE can fail to reserve Gigacage on 512MB.
  export GIGACAGE_ENABLED=0
  ensure_runtime_dir
  setterm --blank 0 --powerdown 0 >/dev/null 2>&1 || true

  # Direct KMS — no X, no Wayland compositor. Needs the VT (tty1), not startx.
  if [[ -z "${DISPLAY:-}" ]]; then
    log "cog drm gles ${URL}"
    cog --platform=drm --platform-params=renderer=gles "${URL}" >>"${LOG}" 2>&1 && return 0
    log "cog drm (default renderer) ${URL}"
    cog --platform=drm "${URL}" >>"${LOG}" 2>&1 && return 0
    if command -v cage >/dev/null 2>&1; then
      log "cage + cog ${URL}"
      cage -s -- cog --platform=wl "${URL}" >>"${LOG}" 2>&1 && return 0
      cage -s -- cog --platform=fdo "${URL}" >>"${LOG}" 2>&1 && return 0
    fi
  else
    # Old installs still start X. fdo/Wayland will not paint there.
    log "DISPLAY=${DISPLAY} — trying X11 Cog platforms"
    cog --platform=gtk4 "${URL}" >>"${LOG}" 2>&1 && return 0
    cog --platform=gtk "${URL}" >>"${LOG}" 2>&1 && return 0
    cog --platform=x11 "${URL}" >>"${LOG}" 2>&1 && return 0
  fi
  return 1
}

run_browser() {
  local bin="$1"
  case "${bin}" in
    cog)
      run_cog && return 0
      if command -v epiphany >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
        log "fallback epiphany ${URL}"
        epiphany --application-mode --new-window "${URL}" >>"${LOG}" 2>&1 && return 0
      fi
      log "cog failed to open ${URL}"
      return 1
      ;;
    epiphany)
      prepare_x11
      epiphany --application-mode --new-window "${URL}" >>"${LOG}" 2>&1
      ;;
    midori)
      prepare_x11
      midori -e Fullscreen -a "${URL}" >>"${LOG}" 2>&1
      ;;
    *)
      prepare_x11
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
        --js-flags="--max-old-space-size=96" \
        --check-for-update-interval=31536000 \
        --start-maximized \
        --hide-scrollbars \
        --autoplay-policy=no-user-gesture-required \
        --no-first-run \
        --overscroll-history-navigation=0 \
        "${URL}" >>"${LOG}" 2>&1
      ;;
  esac
}

needs_x11() {
  case "$1" in
    cog) return 1 ;;
    *) return 0 ;;
  esac
}

BROWSER_BIN="$(pick_browser || true)"
if [[ -z "${BROWSER_BIN}" ]]; then
  log "No kiosk browser found (cog, chromium, epiphany)."
  sleep 30
  exit 1
fi

# Chromium/Epiphany need X. Cog DRM must own the VT — do not start X first.
if needs_x11 "${BROWSER_BIN}" && [[ -z "${DISPLAY:-}" ]]; then
  if command -v startx >/dev/null 2>&1; then
    log "starting X for ${BROWSER_BIN}"
    exec startx -- -nocursor
  fi
  log "startx missing; cannot run ${BROWSER_BIN}"
  sleep 30
  exit 1
fi

log "Opening ${URL} in ${BROWSER_BIN} (DISPLAY=${DISPLAY:-none})"
while true; do
  run_browser "${BROWSER_BIN}" || true
  log "${BROWSER_BIN} exited, retrying in 3s"
  sleep 3
done
