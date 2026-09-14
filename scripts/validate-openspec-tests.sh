#!/usr/bin/env bash
set -euo pipefail

CHANGE_DIR="${1:?Usage: validate-openspec-tests.sh <change-dir>}"

VALIDATION_FILE="$CHANGE_DIR/test-validation.md"
SUITE_FILE="$CHANGE_DIR/test-suite.md"

echo "=== OpenSpec Test Gate ==="

if [[ ! -f "$VALIDATION_FILE" ]]; then
    echo "FAIL: test-validation.md does not exist"
    exit 1
fi

if [[ ! -f "$SUITE_FILE" ]]; then
    echo "FAIL: test-suite.md does not exist"
    exit 1
fi

if ! grep -q '^VERDICT: PASS$' "$VALIDATION_FILE"; then
    echo "FAIL: test validation verdict is not PASS"
    exit 1
fi

echo "PASS: test-validation verdict"

echo
echo "Test gate passed."
