#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
if [[ "${UNUVAULT_SHARED_TEST_LOCK_HELD:-0}" != "1" ]]; then
  exec "$repo_root/scripts/testing/run-with-shared-test-lock.sh" "$0" "$@"
fi

cd "$repo_root"

bash scripts/testing/run-ios.sh
swift test --package-path apps/macos/App --filter Pairing
