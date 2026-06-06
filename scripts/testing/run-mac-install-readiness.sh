#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"

echo "UNUVAULT_MAC_INSTALL_READINESS status=running check=service_management_link"

swift -e 'import ServiceManagement
_ = SMAppService.mainApp.status
print("UNUVAULT_MAC_INSTALL_READINESS service_management=available")'

echo "UNUVAULT_MAC_INSTALL_READINESS status=running check=CompanionLaunchAtLoginTests"

swift test \
  --package-path "$mac_package" \
  --filter CompanionLaunchAtLoginTests

echo "UNUVAULT_MAC_INSTALL_READINESS status=ready claim=launch_at_login_code_boundary unclaimed=notarization,physical_iphone,touch_id_prompt_screenshot"
