#!/usr/bin/env bash
# Lightweight DESIGN.md guardrails. Allowlisted paths are intentional exceptions.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
FAIL=0

check() {
  local label="$1"
  local pattern="$2"
  local path="$3"
  local hits
  hits=$(grep -rnE "$pattern" "$path" --include='*.tsx' --include='*.ts' --include='*.css' 2>/dev/null \
    | grep -vE 'AnnouncementBodyField|bg-ocid-blue|text-ocid-foreground|ocid-blue|OpenCampusConnect|ConnectOCID' \
    || true)
  if [[ -n "$hits" ]]; then
    echo "== $label =="
    echo "$hits"
    FAIL=1
  fi
}

check "shadow-lg on cards (use shadow-card)" 'shadow-lg' "$SRC"
check "shadow-2xl on panels (use shadow-card)" 'shadow-2xl' "$SRC"
check "arbitrary hex bg (use tokens)" 'bg-\[#' "$SRC"
check "text-white (use text-foreground or ocid-foreground)" 'text-white' "$SRC"

if [[ "$FAIL" -ne 0 ]]; then
  echo "Design system check failed. See docs/DESIGN.md"
  exit 1
fi
echo "Design system check passed."
