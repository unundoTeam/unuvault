#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"
preflight_reasons=()

record_preflight_blocker() {
  local reason="$1"
  shift

  preflight_reasons+=("$reason")
  echo "UNUVAULT_MAC_SECURITY_PREFLIGHT status=blocked reason=$reason $*"
}

record_preflight_ok() {
  echo "UNUVAULT_MAC_SECURITY_PREFLIGHT status=ok $*"
}

record_preflight_warning() {
  echo "UNUVAULT_MAC_SECURITY_PREFLIGHT status=warning $*"
}

check_required_command() {
  local command_name="$1"
  local help_text="$2"

  if command -v "$command_name" >/dev/null 2>&1; then
    record_preflight_ok "check=$command_name path=$(command -v "$command_name")"
    return 0
  fi

  record_preflight_blocker "missing_$command_name" "$help_text"
  return 1
}

check_macos_platform() {
  local system_name
  system_name="$(uname -s 2>/dev/null || true)"

  if [[ "$system_name" != "Darwin" ]]; then
    record_preflight_blocker "not_macos" "system=${system_name:-unknown} help=\"Run this on macOS; the Mac companion depends on Keychain and LocalAuthentication.\""
    return
  fi

  record_preflight_ok "check=platform system=Darwin"

  if command -v sw_vers >/dev/null 2>&1; then
    local product_version
    product_version="$(sw_vers -productVersion 2>/dev/null || true)"
    local major_version="${product_version%%.*}"

    if [[ -n "$major_version" && "$major_version" =~ ^[0-9]+$ && "$major_version" -lt 14 ]]; then
      record_preflight_blocker "macos_too_old" "version=$product_version help=\"The Mac companion package declares macOS 14 or newer.\""
      return
    fi

    record_preflight_ok "check=macos_version version=${product_version:-unknown}"
  else
    record_preflight_warning "check=macos_version note=sw_vers_unavailable"
  fi
}

check_keychain_cli() {
  if ! check_required_command "security" "help=\"Install or repair macOS Security command-line tools.\""; then
    return
  fi

  if security list-keychains >/dev/null 2>&1; then
    record_preflight_ok "check=keychain_cli command=list-keychains"
  else
    record_preflight_blocker "keychain_cli_unavailable" "help=\"Unlock the login keychain or repair Keychain access before relying on the Mac local vault key.\""
  fi
}

check_swift_toolchain() {
  if ! check_required_command "swift" "help=\"Install Xcode command-line tools before running Mac companion proof commands.\""; then
    return
  fi

  if swift package describe --package-path "$mac_package" >/dev/null 2>&1; then
    record_preflight_ok "check=swift_package package=apps/macos/App"
  else
    record_preflight_blocker "swift_package_unavailable" "package=apps/macos/App help=\"Run xcode-select or fix the Swift package before Mac companion proof commands.\""
  fi
}

check_local_auth_framework() {
  if ! command -v swift >/dev/null 2>&1; then
    record_preflight_warning "check=local_auth_framework note=swift_unavailable"
    return
  fi

  local output
  if output="$(swift -e 'import LocalAuthentication
var error: NSError?
let context = LAContext()
if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
    print("local_auth=available biometrics=available")
} else {
    print("local_auth=available biometrics=unavailable reason=\(error?.code ?? 0)")
}
' 2>/dev/null)"; then
    if [[ "$output" == *"biometrics=available"* ]]; then
      record_preflight_ok "check=local_auth_framework biometrics=available"
    else
      record_preflight_warning "check=local_auth_framework ${output:-biometrics=unknown}"
    fi
  else
    record_preflight_blocker "local_auth_framework_unavailable" "help=\"LocalAuthentication must link before Touch ID readiness can be evaluated.\""
  fi
}

check_vault_directory() {
  local vault_directory="${UNUVAULT_MAC_SECURITY_PREFLIGHT_VAULT_DIR:-$HOME/Library/Application Support/UnuVault/MacCompanion}"
  local check_directory="$vault_directory"

  if [[ ! -d "$check_directory" ]]; then
    check_directory="$(dirname "$vault_directory")"
    while [[ ! -d "$check_directory" && "$check_directory" != "/" ]]; do
      check_directory="$(dirname "$check_directory")"
    done
  fi

  if [[ -z "$check_directory" || ! -d "$check_directory" ]]; then
    record_preflight_blocker "vault_directory_parent_missing" "path=\"$vault_directory\""
    return
  fi

  if [[ -w "$check_directory" ]]; then
    record_preflight_ok "check=vault_directory path=\"$vault_directory\" writable_parent=\"$check_directory\""
  else
    record_preflight_blocker "vault_directory_not_writable" "path=\"$vault_directory\" writable_parent=\"$check_directory\""
  fi
}

check_package_security_sources() {
  local store_source="$mac_package/Sources/MacCompanionCore/LocalCompanionVaultStore.swift"

  if [[ ! -f "$store_source" ]]; then
    record_preflight_blocker "local_vault_store_missing" "path=\"$store_source\""
    return
  fi

  if grep -q "KeychainCompanionVaultKeyProvider" "$store_source" &&
     grep -q "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly" "$store_source" &&
     grep -q "AES-GCM-256" "$store_source"; then
    record_preflight_ok "check=local_vault_store keychain=this_device_only algorithm=AES-GCM-256"
  else
    record_preflight_blocker "local_vault_store_contract_missing" "path=\"$store_source\""
  fi
}

check_macos_platform
check_swift_toolchain
check_keychain_cli
check_local_auth_framework
check_vault_directory
check_package_security_sources

if [[ "${#preflight_reasons[@]}" -gt 0 ]]; then
  echo "UNUVAULT_MAC_SECURITY_PREFLIGHT status=blocked reason=${preflight_reasons[0]}"
  exit 1
fi

echo "UNUVAULT_MAC_SECURITY_PREFLIGHT status=ready package=apps/macos/App"
