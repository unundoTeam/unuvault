#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
host_root="$repo_root/apps/ios/HostApp"
mac_log="$(mktemp)"
device_json="$(mktemp)"
console_log="$(mktemp)"
derived_data="${UNUVAULT_IOS_PHYSICAL_RECEIPT_DERIVED_DATA:-$repo_root/.derived-data/ios-physical-receipt}"
bundle_id="${UNUVAULT_IOS_HOST_BUNDLE_ID:-com.unuvault.ioshost}"
mac_pid=""
launch_pid=""

cleanup() {
  if [[ -n "$launch_pid" ]]; then
    kill "$launch_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$mac_pid" ]]; then
    kill "$mac_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$mac_log" "$device_json" "$console_log"
}
trap cleanup EXIT

resolve_lan_host() {
  if [[ -n "${UNUVAULT_PAIRING_LAN_HOST:-}" ]]; then
    printf '%s\n' "$UNUVAULT_PAIRING_LAN_HOST"
    return
  fi

  if command -v ipconfig >/dev/null 2>&1; then
    for interface in en0 en1 en2; do
      if host="$(ipconfig getifaddr "$interface" 2>/dev/null)"; then
        if [[ -n "$host" ]]; then
          printf '%s\n' "$host"
          return
        fi
      fi
    done
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '
      $1 == "inet" &&
      $2 !~ /^127\./ &&
      $2 !~ /^169\.254\./ &&
      $2 !~ /^198\.18\./ {
        print $2
        exit
      }
    '
  fi
}

resolve_device_id() {
  if [[ -n "${UNUVAULT_IOS_DEVICE_ID:-}" ]]; then
    printf '%s\n' "$UNUVAULT_IOS_DEVICE_ID"
    return
  fi

  xcrun devicectl list devices --json-output "$device_json" >/dev/null

  node - "$device_json" <<'NODE'
const { readFileSync } = require("node:fs");
const payload = JSON.parse(readFileSync(process.argv[2], "utf8"));
const devices = payload?.result?.devices ?? [];
const device = devices.find((candidate) => {
  const platform = JSON.stringify(candidate.platform ?? candidate.deviceProperties?.platform ?? "");
  const name = String(candidate.name ?? candidate.deviceProperties?.name ?? "");
  return /iOS|iPhone/i.test(platform) || /iPhone/i.test(name);
});
const identifier =
  device?.identifier ??
  device?.deviceProperties?.identifier ??
  device?.deviceProperties?.udid ??
  device?.hardwareProperties?.udid ??
  device?.udid ??
  device?.ecid ??
  device?.serialNumber ??
  "";
if (identifier) {
  process.stdout.write(identifier);
}
NODE
}

wait_for_log_line() {
  local pattern="$1"
  local file="$2"
  local timeout_seconds="$3"

  for _ in $(seq 1 "$timeout_seconds"); do
    if grep -q "$pattern" "$file"; then
      return 0
    fi
    sleep 1
  done

  return 1
}

lan_host="$(resolve_lan_host)"

if [[ -z "$lan_host" ]]; then
  echo "Unable to resolve a non-loopback LAN IPv4 address. Set UNUVAULT_PAIRING_LAN_HOST." >&2
  exit 1
fi

case "$lan_host" in
  127.*|localhost|::1)
    echo "UNUVAULT_PAIRING_LAN_HOST must be a non-loopback LAN address, got $lan_host." >&2
    exit 1
    ;;
esac

device_id="$(resolve_device_id)"

if [[ -z "$device_id" ]]; then
  echo "No physical iPhone found. Connect, unlock, and trust an iPhone, or set UNUVAULT_IOS_DEVICE_ID." >&2
  exit 1
fi

lan_port="${UNUVAULT_PAIRING_LAN_PORT:-17670}"
receipt_timeout="${UNUVAULT_PAIRING_RECEIPT_TIMEOUT_SECONDS:-120}"

echo "Building MacPairingReceiptHost at http://$lan_host:$lan_port"

UNUVAULT_PAIRING_LAN_HOST="$lan_host" \
UNUVAULT_PAIRING_LAN_PORT="$lan_port" \
UNUVAULT_PAIRING_RECEIPT_TIMEOUT_SECONDS="$receipt_timeout" \
swift run \
  --package-path "$repo_root/apps/macos/App" \
  MacPairingReceiptHost >"$mac_log" 2>&1 &
mac_pid="$!"

if ! wait_for_log_line "UNUVAULT_PAIRING_RECEIPT_DEEPLINK" "$mac_log" 30; then
  echo "MacPairingReceiptHost did not emit a pairing deep link." >&2
  cat "$mac_log" >&2
  exit 1
fi

deep_link="$(awk '/UNUVAULT_PAIRING_RECEIPT_DEEPLINK/ {print $2; exit}' "$mac_log")"

echo "Building UnuVaultIOSHost for physical iPhone $device_id"
xcodegen --quiet --spec "$host_root/project.yml" --project "$host_root"

build_args=(
  -project "$host_root/UnuVaultIOSHost.xcodeproj"
  -scheme UnuVaultIOSHost
  -configuration Debug
  -destination "generic/platform=iOS"
  -derivedDataPath "$derived_data"
)

if [[ -n "${UNUVAULT_IOS_DEVELOPMENT_TEAM:-}" ]]; then
  build_args+=(DEVELOPMENT_TEAM="$UNUVAULT_IOS_DEVELOPMENT_TEAM")
fi

if [[ "${UNUVAULT_IOS_ALLOW_PROVISIONING_UPDATES:-0}" == "1" ]]; then
  build_args+=(-allowProvisioningUpdates)
fi

build_args+=(build)

xcodebuild "${build_args[@]}"

app_path="$derived_data/Build/Products/Debug-iphoneos/UnuVaultIOSHost.app"

xcrun devicectl device install app --device "$device_id" "$app_path"

echo "Launching UnuVaultIOSHost with pairing payload URL"
xcrun devicectl device process launch \
  --device "$device_id" \
  --terminate-existing \
  --payload-url "$deep_link" \
  --console \
  "$bundle_id" >"$console_log" 2>&1 &
launch_pid="$!"

if wait_for_log_line "UNUVAULT_IOS_PAIRING_RECEIPT paired" "$console_log" "$receipt_timeout"; then
  grep "UNUVAULT_IOS_PAIRING_RECEIPT paired" "$console_log" | tail -1
  exit 0
fi

if grep -q "UNUVAULT_IOS_PAIRING_RECEIPT failed" "$console_log"; then
  grep "UNUVAULT_IOS_PAIRING_RECEIPT failed" "$console_log" >&2
else
  echo "Timed out waiting for UNUVAULT_IOS_PAIRING_RECEIPT paired." >&2
fi

echo "--- MacPairingReceiptHost log ---" >&2
cat "$mac_log" >&2
echo "--- iOS console log ---" >&2
cat "$console_log" >&2
exit 1
