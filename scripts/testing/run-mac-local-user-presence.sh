#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"

echo "UNUVAULT_MAC_LOCAL_USER_PRESENCE status=running check=CompanionViewModelLocalUserPresenceTests"

swift test \
  --package-path "$mac_package" \
  --filter CompanionViewModelLocalUserPresenceTests

echo "UNUVAULT_MAC_LOCAL_USER_PRESENCE status=ready claim=save_and_unlock_code_boundary unclaimed=touch_id_prompt_screenshot,notarization,physical_iphone"
