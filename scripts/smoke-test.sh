#!/usr/bin/env bash
set -euo pipefail

# Static smoke test for config/status-cell hardening.
rg -n "statusCell:\s*buildDefaultStatusCell_\(DEFAULT_HEADER\)" Config.gs >/dev/null
rg -n "function buildDefaultStatusCell_\(" Config.gs >/dev/null
rg -n "function readConfigSettingValue_\(" Config.gs >/dev/null
rg -n "statusCellOverride && statusCellOverride !== 'n/a'" Config.gs >/dev/null
rg -n "assertA1CellReference_\(config.statusCell" Config.gs >/dev/null
rg -n "function writeStatusCellMessage_\(" Ui.gs >/dev/null

echo "smoke-test: PASS"
