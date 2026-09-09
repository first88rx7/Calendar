#!/usr/bin/env bash
# Low-memory install for a 2 GB Debian LXC. Run inside the container.
# Does not compile TypeScript in the same process as webpack.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

step() {
  echo
  echo "=== $* ==="
}

step "1/6 git pull"
git pull --ff-only || true

step "2/6 install Python PDF parser (school menus)"
if python3 -c "import pymupdf" >/dev/null 2>&1; then
  echo "pymupdf already installed"
else
  if command -v pip3 >/dev/null 2>&1; then
    pip3 install --break-system-packages pymupdf
  else
    apt-get update
    apt-get install -y python3-pip
    pip3 install --break-system-packages pymupdf
  fi
fi
chmod +x "${ROOT}/scripts/parse-school-menu.py" 2>/dev/null || true

step "3/6 install npm packages (this is lighter than the compile)"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

step "4/6 write .env if missing"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Edit ${ROOT}/.env before you rely on Google / Mealie / PhotoPrism."
fi
# systemd EnvironmentFile=.env used to pin Seattle and undo Settings ZIP saves.
if grep -qE '^WEATHER_' .env 2>/dev/null; then
  sed -i.bak -E 's/^WEATHER_/# WEATHER_/' .env
  echo "Commented WEATHER_* in .env so the forecast follows Settings."
fi

step "5/6 production compile (one webpack process, no typecheck)"
rm -rf .next
export NEXT_TELEMETRY_DISABLED=1
npm run build:lxc

step "6/6 drop compile-only packages from node_modules"
npm prune --omit=dev || true

echo
echo "Build finished. Start with:"
echo "  cd ${ROOT} && npm start"
echo
echo "Or install the systemd unit from the README and: systemctl enable --now household"
