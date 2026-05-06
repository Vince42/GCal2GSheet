#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v clasp >/dev/null 2>&1; then
  echo "live-sheet-check: FAIL (clasp CLI is not installed)."
  echo "Install with: npm i -g @google/clasp"
  exit 1
fi

if [[ ! -f .clasp.json ]]; then
  echo "live-sheet-check: FAIL (.clasp.json is missing)."
  echo "Link this repo to a test Apps Script project with: clasp clone <scriptId>"
  exit 1
fi

echo "live-sheet-check: running remote onOpen() to verify menu-recovery path is callable..."
clasp run onOpen >/dev/null

echo "live-sheet-check: PASS (onOpen executed remotely without runtime errors)."

if [[ "${RUN_UPDATE_CALENDAR_SHEETS:-0}" == "1" ]]; then
  echo "live-sheet-check: running remote updateCalendarSheets() (writes sheet data)..."
  clasp run updateCalendarSheets >/dev/null
  echo "live-sheet-check: PASS (updateCalendarSheets executed remotely)."
else
  echo "live-sheet-check: skipped updateCalendarSheets(). Set RUN_UPDATE_CALENDAR_SHEETS=1 to enable write test."
fi
