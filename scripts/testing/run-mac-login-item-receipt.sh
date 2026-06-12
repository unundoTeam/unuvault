#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"
bundle_id="com.unundo.unuvault.MacLoginItemReceiptHost"
mutate=0

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --mutate)
      mutate=1
      ;;
    --help|-h)
      cat <<'USAGE'
Usage: bash scripts/testing/run-mac-login-item-receipt.sh [--mutate]

Default mode is read-only: build a temporary packaged .app receipt host and
read SMAppService.mainApp.status from inside that bundle.

--mutate attempts SMAppService.mainApp.register(), then unregisters when the
initial state was not enabled. Use only when you want to touch this Mac's login
items for a reversible local receipt.
USAGE
      exit 0
      ;;
    *)
      echo "UNUVAULT_MAC_LOGIN_ITEM_RECEIPT status=failed error=unknown_arg arg=$arg" >&2
      exit 2
      ;;
  esac
done

echo "UNUVAULT_MAC_LOGIN_ITEM_RECEIPT status=running check=build_host"

swift build \
  --package-path "$mac_package" \
  --product MacLoginItemReceiptHost

bin_path="$(swift build --package-path "$mac_package" --show-bin-path)"
host_binary="$bin_path/MacLoginItemReceiptHost"

if [[ ! -x "$host_binary" ]]; then
  echo "UNUVAULT_MAC_LOGIN_ITEM_RECEIPT status=failed error=missing_host_binary path=$host_binary" >&2
  exit 1
fi

receipt_root="$(mktemp -d "${TMPDIR:-/tmp}/unuvault-login-item-receipt.XXXXXX")"
trap 'rm -rf "$receipt_root"' EXIT

app_path="$receipt_root/MacLoginItemReceiptHost.app"
contents_path="$app_path/Contents"
macos_path="$contents_path/MacOS"
mkdir -p "$macos_path"
cp "$host_binary" "$macos_path/MacLoginItemReceiptHost"

cat > "$contents_path/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>MacLoginItemReceiptHost</string>
  <key>CFBundleIdentifier</key>
  <string>$bundle_id</string>
  <key>CFBundleName</key>
  <string>MacLoginItemReceiptHost</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
PLIST

echo "UNUVAULT_MAC_LOGIN_ITEM_RECEIPT status=running check=bundled_status app_path=$app_path"

host_args=(
  "--expected-bundle-id"
  "$bundle_id"
)

if [[ "$mutate" == "1" ]]; then
  host_args+=("--mutate")
fi

"$macos_path/MacLoginItemReceiptHost" "${host_args[@]}"
