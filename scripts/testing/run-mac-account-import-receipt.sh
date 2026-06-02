#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"

echo "UNUVAULT_MAC_ACCOUNT_IMPORT_RECEIPT status=running check=CompanionWebAccountImportReceiptTests"

swift test \
  --package-path "$mac_package" \
  --filter CompanionWebAccountImportReceiptTests

echo "UNUVAULT_MAC_ACCOUNT_IMPORT_RECEIPT status=ready claim=web_account_to_mac_local_vault_receipt unclaimed=cloud_sync_daemon,server_plaintext_recovery,physical_iphone"
