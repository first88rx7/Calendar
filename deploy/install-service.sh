#!/usr/bin/env bash
# Install a systemd unit so the dashboard starts when the LXC boots.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

UNIT=/etc/systemd/system/household.service
sed "s|/opt/calendar|${ROOT}|g" "${ROOT}/deploy/household.service" > "${UNIT}"
systemctl daemon-reload
systemctl enable --now household
systemctl status household --no-pager
echo
echo "The dashboard will start on every LXC boot."
echo "Logs: journalctl -u household -f"
