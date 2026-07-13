#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
if [[ "${UNUVAULT_SHARED_TEST_LOCK_HELD:-0}" != "1" ]]; then
  exec "$repo_root/scripts/testing/run-with-shared-test-lock.sh" "$0" "$@"
fi
project_root="$repo_root/apps/ios/App"

available_simulators="$(xcrun simctl list devices available)"
simulator_name=""

for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if grep -Fq "$candidate" <<<"$available_simulators"; then
    simulator_name="$candidate"
    break
  fi
done

if [[ -z "$simulator_name" ]]; then
  echo "No supported iPhone simulator was found." >&2
  exit 1
fi

echo "Using iOS simulator: $simulator_name"

cd "$project_root"

xcodebuild test \
  -scheme App \
  -destination "platform=iOS Simulator,name=$simulator_name"
