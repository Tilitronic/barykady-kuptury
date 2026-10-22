#!/usr/bin/env bash
# D-40 — Rebuild the self-hosted FreeSerif woff2 subsets (see PROVENANCE.md
# in public/fonts/ for license + hash provenance, and the header of
# scripts/fonts/build_freefont.py for the hard-gate contract).
#
# The job needs fontTools + brotli, which are deliberately NOT app dependencies
# (they are build-time-only for a checked-in artifact). uv provides them in an
# ephemeral environment; a venv fallback keeps the script usable on machines
# without uv.
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v uv >/dev/null 2>&1; then
  exec uv run --quiet --with fonttools==4.67.0 --with brotli==1.2.0 \
    python scripts/fonts/build_freefont.py "$@"
fi

VENV="scripts/fonts/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/python" -m pip install --quiet --upgrade pip
  "$VENV/bin/python" -m pip install --quiet fonttools==4.67.0 brotli==1.2.0
fi
exec "$VENV/bin/python" scripts/fonts/build_freefont.py "$@"
