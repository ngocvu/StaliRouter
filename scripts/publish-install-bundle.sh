#!/usr/bin/env bash
# Build stalirouter npm tarball and publish to api.stali.vn/install/ for one-line install.
#
#   bash scripts/publish-install-bundle.sh
#
# Output:
#   public/install/stalirouter-bundle.tgz  (latest)
#   public/install/stalirouter-<version>.tgz

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${STALIROUTER_INSTALL_DIR:-/home/api.stali.vn/public/install}"
CLI_DIR="$ROOT/cli"

cd "$ROOT"

run_pack() {
  npm run cli:pack
}

echo "==> npm install (root)"
npm install --no-audit --no-fund
# Stub package for webpack resolve (native binary installed at runtime via cli hooks)
npm install better-sqlite3@12.6.2 --ignore-scripts --no-audit --no-fund 2>/dev/null || true

echo "==> Building CLI pack"
if ! run_pack; then
  echo "==> Local build failed — retrying in Docker (node:20-bookworm)…"
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not available"; exit 1
  fi
  docker run --rm \
    -v "$ROOT:/work" \
    -w /work \
    -e NEXT_TRACING_ROOT_MODE=workspace \
    node:20-bookworm \
    bash -lc "npm install --no-audit --no-fund && npm install better-sqlite3@12.6.2 --ignore-scripts --no-audit --no-fund 2>/dev/null || true && npm run cli:pack"
fi

TGZ="$(ls -1 "$ROOT"/stalirouter-*.tgz "$ROOT/../stalirouter-*.tgz" 2>/dev/null | sort -V | tail -1)"
[[ -f "$TGZ" ]] || { echo "Missing stalirouter-*.tgz after pack (checked $ROOT and parent)"; exit 1; }

VERSION="$(basename "$TGZ" .tgz | sed 's/stalirouter-//')"
DEST_VERSION="$INSTALL_DIR/stalirouter-${VERSION}.tgz"
DEST_LATEST="$INSTALL_DIR/stalirouter-bundle.tgz"

mkdir -p "$INSTALL_DIR"
cp -f "$TGZ" "$DEST_VERSION"
cp -f "$TGZ" "$DEST_LATEST"
chmod 644 "$DEST_VERSION" "$DEST_LATEST"

echo ""
echo "✅ Published install bundles:"
echo "   $DEST_LATEST"
echo "   $DEST_VERSION"
echo ""
echo "One-line install:"
echo "   npm install -g https://api.stali.vn/install/stalirouter-bundle.tgz"
echo "   curl -fsSL https://api.stali.vn/install/stalirouter.sh | bash"
