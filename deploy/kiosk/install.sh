#!/usr/bin/env bash
# Install a fullscreen kiosk on a Raspberry Pi Zero 2 / Zero 2 W (or Banana Pi M2 Zero).
# Run on the Pi as the auto-login user, not as root, and not on the home server.
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this as the auto-login user, not root."
  exit 1
fi

HOUSEHOLD_URL="${1:-${HOUSEHOLD_URL:-http://192.168.1.10:3847}}"
KIOSK_DIR="${HOME}/household-kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "${KIOSK_DIR}"
install -m 0755 "${SCRIPT_DIR}/kiosk.sh" "${KIOSK_DIR}/kiosk.sh"
printf '%s\n' "${HOUSEHOLD_URL}" > "${KIOSK_DIR}/url"

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    xserver-xorg x11-xserver-utils xinit openbox unclutter fonts-noto-color-emoji
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium \
    || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium-browser \
    || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y cog || true
fi

if ! command -v chromium >/dev/null 2>&1 \
  && ! command -v chromium-browser >/dev/null 2>&1 \
  && ! command -v cog >/dev/null 2>&1; then
  echo "Could not install Chromium or Cog. Check apt sources and try again." >&2
  exit 1
fi

if [[ ! -f /swapfile ]] && [[ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 750000 ]]; then
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
cat > "${HOME}/.config/openbox/autostart" <<EOF
export HOUSEHOLD_URL="${HOUSEHOLD_URL}"
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
fi

# Lite: after console autologin on tty1, start X. SSH is not tty1, so it stays a shell.
STARTX_SNIPPET='
# Household kiosk: start a bare X session on the attached display only.
if [ -z "${DISPLAY:-}" ] && [ "$(tty 2>/dev/null)" = "/dev/tty1" ]; then
  exec startx -- -nocursor
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
if ! grep -q 'Household kiosk: start a bare X session' "${PROFILE_FILE}"; then
  printf '\n%s\n' "${STARTX_SNIPPET}" >> "${PROFILE_FILE}"
fi

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

echo
echo "Kiosk installed."
echo "  Dashboard URL: ${HOUSEHOLD_URL}"
echo "  Change later:  echo 'http://<server-ip>:3847' > ${KIOSK_DIR}/url && sudo reboot"
echo
echo "Reboot the Pi. It should boot straight into the household week view:"
echo "  no desktop, no address bar, no taskbar."
echo
echo "If Chromium is too slow on a Zero, install Cog and reboot:"
echo "  sudo apt-get install -y cog"
echo "  HOUSEHOLD_BROWSER=cog  is used automatically if Chromium is missing."
echo
echo "Do not run Docker or Node for this app on the Pi. The home server hosts it."
