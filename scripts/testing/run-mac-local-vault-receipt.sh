#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"
receipt_failures=()

record_receipt_ok() {
  echo "UNUVAULT_MAC_LOCAL_VAULT_RECEIPT status=ok $*"
}

record_receipt_blocker() {
  local check="$1"
  shift

  receipt_failures+=("$check")
  echo "UNUVAULT_MAC_LOCAL_VAULT_RECEIPT status=blocked check=$check $*"
}

run_swift_receipt_check() {
  local check="$1"
  local filter="$2"

  echo "UNUVAULT_MAC_LOCAL_VAULT_RECEIPT status=running check=$check filter=$filter"

  if swift test --package-path "$mac_package" --filter "$filter"; then
    record_receipt_ok "check=$check"
    return 0
  fi

  record_receipt_blocker "$check" "filter=$filter"
  return 1
}

if ! command -v swift >/dev/null 2>&1; then
  record_receipt_blocker "swift" "help=\"Install Xcode command-line tools before running Mac local vault receipt proof.\""
  echo "UNUVAULT_MAC_LOCAL_VAULT_RECEIPT status=blocked reason=swift"
  exit 1
fi

run_swift_receipt_check \
  "LocalCompanionVaultStoreTests" \
  "LocalCompanionVaultStoreTests" || true
run_swift_receipt_check \
  "CompanionVaultSessionTests" \
  "CompanionVaultSessionTests" || true
run_swift_receipt_check \
  "RecoveryBoundaryTests" \
  "RecoveryBoundaryTests" || true
run_swift_receipt_check \
  "LoopbackHTTPServerTests/testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim" \
  "LoopbackHTTPServerTests/testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim" || true

if [[ "${#receipt_failures[@]}" -gt 0 ]]; then
  echo "UNUVAULT_MAC_LOCAL_VAULT_RECEIPT status=blocked reason=${receipt_failures[0]}"
  exit 1
fi

echo "UNUVAULT_MAC_LOCAL_VAULT_RECEIPT status=ready claims=encrypted_save,local_unlock_session,recovery_boundary,one_time_native_approval_claim unclaimed=touch_id,physical_iphone"
