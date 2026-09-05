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

step "1/5 git pull"
git pull --ff-only || true

step "2/5 install npm packages (this is lighter than the compile)"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

step "3/5 write .env if missing"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Edit ${ROOT}/.env before you rely on Google / Mealie / PhotoPrism."
fi

step "4/5 production compile (one webpack process, no typecheck)"
rm -rf .next
export NEXT_TELEMETRY_DISABLED=1
npm run build:lxc

step "5/5 drop compile-only packages from node_modules"
npm prune --omit=dev || true

echo
echo "Build finished. Start with:"
echo "  cd ${ROOT} && npm start"
echo
echo "Or install the systemd unit from the README and: systemctl enable --now household"
