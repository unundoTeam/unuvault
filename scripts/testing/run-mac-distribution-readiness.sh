#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"
bundle_id="${UNUVAULT_MAC_COMPANION_BUNDLE_ID:-com.unundo.unuvault.maccompanion}"
require_notarization=0
keep_artifacts=0
blocked_reasons=()

usage() {
  cat <<'USAGE'
Usage: bash scripts/testing/run-mac-distribution-readiness.sh [--require-notarization] [--keep-artifacts]

Builds a temporary UnuVaultMacCompanion.app bundle, validates Info.plist shape,
ad-hoc signs it with hardened runtime enabled, and reports Apple Developer
signing/notary prerequisites without submitting anything to Apple.

Options:
  --require-notarization  Exit non-zero when Developer ID or notary
                          prerequisites are missing.
  --keep-artifacts        Keep the temporary .app bundle for local inspection.
  --help                  Show this help.
USAGE
}

record() {
  echo "UNUVAULT_MAC_DISTRIBUTION_READINESS $*"
}

block() {
  local reason="$1"
  shift

  blocked_reasons+=("$reason")
  record "status=blocked reason=$reason $*"
}

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --require-notarization)
      require_notarization=1
      ;;
    --keep-artifacts)
      keep_artifacts=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      record "status=failed error=unknown_arg arg=$arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command_name in swift plutil codesign security xcrun; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    record "status=failed error=missing_command command=$command_name"
    exit 1
  fi
done

record "status=running check=build_product product=UnuVaultMacCompanion"
swift build \
  --package-path "$mac_package" \
  --product UnuVaultMacCompanion

bin_path="$(swift build --package-path "$mac_package" --show-bin-path)"
host_binary="$bin_path/UnuVaultMacCompanion"

if [[ ! -x "$host_binary" ]]; then
  record "status=failed error=missing_product_binary path=$host_binary"
  exit 1
fi

receipt_root="$(mktemp -d "${TMPDIR:-/tmp}/unuvault-mac-distribution.XXXXXX")"

if [[ "$keep_artifacts" == "0" ]]; then
  trap 'rm -rf "$receipt_root"' EXIT
else
  trap 'record "status=artifact path=$receipt_root"' EXIT
fi

app_path="$receipt_root/UnuVaultMacCompanion.app"
contents_path="$app_path/Contents"
macos_path="$contents_path/MacOS"
resources_path="$contents_path/Resources"
entitlements_path="$receipt_root/UnuVaultMacCompanion.entitlements"

mkdir -p "$macos_path" "$resources_path"
cp "$host_binary" "$macos_path/UnuVaultMacCompanion"

find "$bin_path" -maxdepth 1 \
  \( -name 'UnuVaultMacCompanion_*.bundle' -o -name '*.resources' \) \
  -exec cp -R {} "$resources_path/" \;

cat > "$contents_path/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>UnuVault</string>
  <key>CFBundleExecutable</key>
  <string>UnuVaultMacCompanion</string>
  <key>CFBundleIdentifier</key>
  <string>$bundle_id</string>
  <key>CFBundleName</key>
  <string>UnuVaultMacCompanion</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.productivity</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSLocalNetworkUsageDescription</key>
  <string>UnuVault uses the local network only for explicit trusted-device pairing.</string>
</dict>
</plist>
PLIST

cat > "$entitlements_path" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
PLIST

record "status=running check=plist bundle_id=$bundle_id app_path=$app_path"
plutil -lint "$contents_path/Info.plist"

record "status=running check=adhoc_codesign options=runtime entitlements=$entitlements_path"
codesign \
  --force \
  --sign - \
  --timestamp=none \
  --options runtime \
  --entitlements "$entitlements_path" \
  "$app_path"

record "status=running check=codesign_verify app_path=$app_path"
codesign --verify --deep --strict --verbose=2 "$app_path"

codesign_summary="$(codesign -dv --verbose=4 "$app_path" 2>&1 | tr '\n' ';')"
record "status=ok check=adhoc_signed summary=\"$codesign_summary\""

developer_id_identity="$(
  security find-identity -v -p codesigning 2>/dev/null \
    | awk '/Developer ID Application/ {print $0; exit}'
)"

if [[ -z "$developer_id_identity" ]]; then
  block "missing_developer_id_certificate" "help=\"Install an Apple Developer ID Application certificate before release notarization.\""
else
  record "status=ok check=developer_id_certificate identity=\"$developer_id_identity\""
fi

if xcrun notarytool --version >/dev/null 2>&1; then
  record "status=ok check=notarytool path=$(xcrun -f notarytool)"
else
  block "missing_notarytool" "help=\"Install a recent Xcode that includes xcrun notarytool.\""
fi

if [[ -n "${UNUVAULT_NOTARY_PROFILE:-}" ]]; then
  record "status=ok check=notary_credentials source=UNUVAULT_NOTARY_PROFILE profile=$UNUVAULT_NOTARY_PROFILE"
elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  record "status=ok check=notary_credentials source=APPLE_ID_ENV team_id=$APPLE_TEAM_ID"
else
  block "missing_notary_credentials" "help=\"Set UNUVAULT_NOTARY_PROFILE or APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD before notarization.\""
fi

if [[ "${#blocked_reasons[@]}" -gt 0 ]]; then
  blocked_summary="$(IFS=,; echo "${blocked_reasons[*]}")"
  record "status=blocked claim=local_packaged_app_distribution_preflight blocked=$blocked_summary unclaimed=developer_id_signed_notarized_release,stapled_ticket,app_store_distribution"
  if [[ "$require_notarization" == "1" ]]; then
    exit 1
  fi
else
  record "status=ready claim=developer_id_notarization_prerequisites app_path=$app_path unclaimed=notary_submission,stapled_ticket,app_store_distribution"
fi
