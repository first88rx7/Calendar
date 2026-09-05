#!/usr/bin/env bash
# Install a lightweight always-on kiosk on a Raspberry Pi Zero 2 W or Banana Pi M2 Zero.
# Run on the Pi, not on the home server.
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this as the desktop/auto-login user, not root."
  exit 1
fi

HOUSEHOLD_URL="${1:-${HOUSEHOLD_URL:-http://192.168.1.10:3847}}"
KIOSK_DIR="${HOME}/household-kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "${KIOSK_DIR}"
install -m 0755 "${SCRIPT_DIR}/kiosk.sh" "${KIOSK_DIR}/kiosk.sh"

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    xserver-xorg x11-xserver-utils xinit openbox unclutter \
    chromium chromium-browser fonts-noto-color-emoji || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y cog || true
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

mkdir -p "${HOME}/.config/systemd/user"
cat > "${HOME}/.config/systemd/user/household-kiosk.service" <<EOF
[Unit]
Description=Household kiosk browser
After=graphical-session.target

[Service]
Environment=HOUSEHOLD_URL=${HOUSEHOLD_URL}
Environment=DISPLAY=:0
ExecStart=${KIOSK_DIR}/kiosk.sh
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

cat > "${HOME}/.xinitrc" <<'EOF'
exec openbox-session
EOF

if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_boot_behaviour B4 || true
fi

systemctl --user daemon-reload || true
systemctl --user enable household-kiosk.service || true

echo
echo "Kiosk installed."
echo "  Dashboard URL: ${HOUSEHOLD_URL}"
echo "  Launcher:      ${KIOSK_DIR}/kiosk.sh"
echo
echo "Reboot the Pi. It should boot to the household week view."
echo "If Chromium is too heavy on a Zero, install cog (WPE WebKit) and rerun."
echo
echo "Banana Pi M2 Zero: use Armbian, attach the Wi-Fi antenna, and keep the"
echo "15.6-inch panel on its own power supply. Mini-HDMI carries video;"
echo "touch needs a micro-USB OTG adapter and a powered hub."
