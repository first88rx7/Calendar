#!/usr/bin/env bash
# Install a fullscreen kiosk on a Raspberry Pi Zero 2 / Zero 2 W (or Banana Pi M2 Zero).
# Run on the Pi as the auto-login user, not as root, and not on the home server.
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this as the auto-login user, not root."
  exit 1
fi

KIOSK_DIR="${HOME}/household-kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEM_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
LOW_RAM=0
if [[ "${MEM_KB}" -lt 900000 ]]; then
  LOW_RAM=1
fi

mkdir -p "${KIOSK_DIR}"
install -m 0755 "${SCRIPT_DIR}/kiosk.sh" "${KIOSK_DIR}/kiosk.sh"

# Keep a URL already on disk unless this run passes one explicitly.
if [[ -n "${1:-}" ]]; then
  HOUSEHOLD_URL="$1"
elif [[ -z "${HOUSEHOLD_URL:-}" && -f "${KIOSK_DIR}/url" ]]; then
  HOUSEHOLD_URL="$(tr -d '[:space:]' < "${KIOSK_DIR}/url")"
fi
HOUSEHOLD_URL="${HOUSEHOLD_URL:-http://192.168.1.10:3847}"
printf '%s\n' "${HOUSEHOLD_URL}" > "${KIOSK_DIR}/url"

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    fonts-noto-color-emoji \
    xserver-xorg x11-xserver-utils xinit openbox unclutter || true
  # Cog is the 512MB browser. Chromium on a Zero 2 often OOMs on reload
  # and --platform=fdo will not paint under X11 (blank Openbox).
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y cog \
    || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    libwpebackend-fdo-1.0-1 libwpe-1.0-1 \
    || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y cage \
    || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y epiphany-browser \
    || true
  if [[ "${LOW_RAM}" -eq 0 ]]; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium \
      || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium-browser \
      || true
  fi
fi

if ! command -v cog >/dev/null 2>&1 \
  && ! command -v chromium >/dev/null 2>&1 \
  && ! command -v chromium-browser >/dev/null 2>&1 \
  && ! command -v epiphany >/dev/null 2>&1; then
  echo "Could not install Cog, Chromium, or Epiphany. Check apt sources and try again." >&2
  exit 1
fi

if [[ "${LOW_RAM}" -eq 1 ]] && command -v cog >/dev/null 2>&1; then
  printf 'cog\n' > "${KIOSK_DIR}/browser"
elif command -v chromium >/dev/null 2>&1; then
  printf 'chromium\n' > "${KIOSK_DIR}/browser"
elif command -v chromium-browser >/dev/null 2>&1; then
  printf 'chromium-browser\n' > "${KIOSK_DIR}/browser"
elif command -v cog >/dev/null 2>&1; then
  printf 'cog\n' > "${KIOSK_DIR}/browser"
else
  printf 'epiphany\n' > "${KIOSK_DIR}/browser"
fi

sudo usermod -aG video,render,input "${USER}" 2>/dev/null || true

if [[ ! -f /swapfile ]] && [[ "${MEM_KB}" -lt 750000 ]]; then
  echo "Creating a 512MB swap file for 512MB boards..."
  sudo fallocate -l 512M /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=512
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
fi

mkdir -p "${HOME}/.config/openbox"
SAVED_URL="$(tr -d '[:space:]' < "${KIOSK_DIR}/url")"
cat > "${HOME}/.config/openbox/autostart" <<EOF
export HOUSEHOLD_URL="${SAVED_URL}"
"${KIOSK_DIR}/kiosk.sh" &
EOF

# No taskbar, no right-click desktop menu — only the dashboard.
cat > "${HOME}/.config/openbox/rc.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <resistance><strength>0</strength><screen_edge_strength>0</screen_edge_strength></resistance>
  <focus><focusNew>yes</focusNew><followMouse>no</followMouse></focus>
  <keyboard/>
  <mouse>
    <context name="Root">
      <mousebind button="Left" action="Press"/>
      <mousebind button="Right" action="Press"/>
      <mousebind button="Middle" action="Press"/>
    </context>
  </mouse>
</openbox_config>
EOF

cat > "${HOME}/.xinitrc" <<'EOF'
#!/bin/sh
xset s off
xset -dpms
xset s noblank
exec openbox-session
EOF
chmod +x "${HOME}/.xinitrc"

# Console autologin on Lite; desktop autologin only if a display manager exists.
if command -v raspi-config >/dev/null 2>&1; then
  if systemctl list-unit-files 2>/dev/null | grep -q '^lightdm\.service'; then
    sudo raspi-config nonint do_boot_behaviour B4 || true
  else
    sudo raspi-config nonint do_boot_behaviour B2 || true
  fi
  sudo raspi-config nonint do_blanking 1 || true
fi

# Lite: tty1 runs the launcher. Cog uses DRM on the VT (no X). Chromium still
# starts X from kiosk.sh. SSH is not tty1, so it stays a shell.
KIOSK_SNIPPET='
# Household kiosk: launch on the attached display only.
if [ -z "${DISPLAY:-}" ] && [ "$(tty 2>/dev/null)" = "/dev/tty1" ]; then
  exec "${HOME}/household-kiosk/kiosk.sh"
fi
'

if [[ -f "${HOME}/.bash_profile" ]]; then
  PROFILE_FILE="${HOME}/.bash_profile"
elif [[ -f "${HOME}/.profile" ]]; then
  PROFILE_FILE="${HOME}/.profile"
else
  PROFILE_FILE="${HOME}/.profile"
  : > "${PROFILE_FILE}"
fi

# Drop the previous startx-on-tty1 snippet so Cog is not trapped under X11.
if grep -q 'Household kiosk:' "${PROFILE_FILE}"; then
  tmp="$(mktemp)"
  awk '
    /Household kiosk:/ {skip=1}
    skip && /^fi$/ {skip=0; next}
    skip {next}
    {print}
  ' "${PROFILE_FILE}" > "${tmp}"
  mv "${tmp}" "${PROFILE_FILE}"
fi
printf '\n%s\n' "${KIOSK_SNIPPET}" >> "${PROFILE_FILE}"

# Older installs enabled a user unit that could launch a second browser. Drop it.
systemctl --user disable --now household-kiosk.service 2>/dev/null || true
rm -f "${HOME}/.config/systemd/user/household-kiosk.service"

# Keep HDMI alive if the panel is slow to wake.
for config in /boot/firmware/config.txt /boot/config.txt; do
  if [[ -f "${config}" ]] && ! grep -q '^hdmi_force_hotplug=1' "${config}"; then
    printf '\n# Household kiosk display\nhdmi_force_hotplug=1\n' | sudo tee -a "${config}" >/dev/null
    break
  fi
done

BROWSER_NAME="$(tr -d '[:space:]' < "${KIOSK_DIR}/browser")"
echo
echo "Kiosk installed."
echo "  Dashboard URL: $(tr -d '[:space:]' < "${KIOSK_DIR}/url")"
echo "  Browser:       ${BROWSER_NAME}"
echo "  Change URL:    echo 'http://<server-ip>:3847' > ${KIOSK_DIR}/url && sudo reboot"
echo "  Logs:          ${KIOSK_DIR}/kiosk.log"
echo
if [[ "${BROWSER_NAME}" == "cog" ]]; then
  echo "Cog draws on the HDMI VT (no X, no address bar). A blank screen after"
  echo "only removing Chromium was the old Wayland Cog flag under X11 — this"
  echo "install replaces that. Reboot when ready."
else
  echo "Reboot the Pi. It should boot straight into the household week view:"
  echo "  no desktop, no address bar, no taskbar."
fi
echo
echo "Do not run Docker or Node for this app on the Pi. The home server hosts it."
