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
preflight_only=0
lan_host=""
device_id=""
preflight_reasons=()

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

usage() {
  cat <<'EOF'
Usage: bash scripts/testing/run-pairing-physical-receipt.sh [--preflight]

Options:
  --preflight   Check local prerequisites and report the first blocker without
                building, installing, launching, or waiting for a receipt.
  --help        Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --preflight)
      preflight_only=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

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

  local timeout_seconds="${UNUVAULT_IOS_DEVICE_LIST_TIMEOUT_SECONDS:-15}"

  case "$timeout_seconds" in
    ''|*[!0-9]*)
      timeout_seconds=15
      ;;
  esac

  if [[ "$timeout_seconds" -lt 1 ]]; then
    timeout_seconds=1
  fi

  xcrun devicectl list devices --json-output "$device_json" >/dev/null 2>&1 &
  local device_list_pid="$!"

  (
    sleep "$timeout_seconds"
    kill "$device_list_pid" >/dev/null 2>&1 || true
  ) >/dev/null 2>&1 &
  local watchdog_pid="$!"

  if ! wait "$device_list_pid" >/dev/null 2>&1; then
    kill "$watchdog_pid" >/dev/null 2>&1 || true
    wait "$watchdog_pid" >/dev/null 2>&1 || true
    return
  fi

  kill "$watchdog_pid" >/dev/null 2>&1 || true
  wait "$watchdog_pid" >/dev/null 2>&1 || true

  if [[ ! -s "$device_json" ]]; then
    return
  fi

  node - "$device_json" <<'NODE'
const { readFileSync } = require("node:fs");
const rawPayload = readFileSync(process.argv[2], "utf8").trim();

if (!rawPayload) {
  process.exit(0);
}

let payload;

try {
  payload = JSON.parse(rawPayload);
} catch {
  process.exit(0);
}

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

record_preflight_blocker() {
  local reason="$1"
  shift

  preflight_reasons+=("$reason")
  echo "UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT status=blocked reason=$reason $*"
}

record_preflight_ok() {
  echo "UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT status=ok $*"
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

check_port_available() {
  local port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    record_preflight_ok "check=port_available port=$port note=lsof_unavailable"
    return 0
  fi

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    record_preflight_blocker "port_in_use" "port=$port help=\"Choose another port with UNUVAULT_PAIRING_LAN_PORT.\""
    return 1
  fi

  record_preflight_ok "check=port_available port=$port"
}

run_preflight() {
  preflight_reasons=()

  check_required_command "node" "help=\"Install Node.js so the device JSON can be parsed.\"" || true
  check_required_command "xcrun" "help=\"Install Xcode command line tools and open Xcode once.\"" || true
  check_required_command "xcodegen" "help=\"Install xcodegen before building the iOS host app.\"" || true
  check_required_command "xcodebuild" "help=\"Install Xcode before building the physical iPhone host app.\"" || true

  lan_host="$(resolve_lan_host)"

  if [[ -z "$lan_host" ]]; then
    record_preflight_blocker "no_lan_host" "help=\"Set UNUVAULT_PAIRING_LAN_HOST to this Mac's non-loopback LAN IPv4 address.\""
  else
    case "$lan_host" in
      127.*|localhost|::1)
        record_preflight_blocker "loopback_lan_host" "lan_host=$lan_host help=\"Use a non-loopback LAN IPv4 address for the iPhone to reach this Mac.\""
        ;;
      *)
        record_preflight_ok "check=lan_host lan_host=$lan_host"
        ;;
    esac
  fi

  lan_port="${UNUVAULT_PAIRING_LAN_PORT:-17670}"
  check_port_available "$lan_port" || true

  if command -v xcrun >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    device_id="$(resolve_device_id)"
  fi

  if [[ -z "$device_id" ]]; then
    record_preflight_blocker "no_physical_iphone" "help=\"Connect, unlock, and trust an iPhone, or set UNUVAULT_IOS_DEVICE_ID.\""
  else
    record_preflight_ok "check=physical_iphone device_id=$device_id"
  fi

  if [[ -n "${UNUVAULT_IOS_DEVELOPMENT_TEAM:-}" ]]; then
    record_preflight_ok "check=ios_signing team=configured allow_provisioning_updates=${UNUVAULT_IOS_ALLOW_PROVISIONING_UPDATES:-0}"
  else
    record_preflight_ok "check=ios_signing team=default allow_provisioning_updates=${UNUVAULT_IOS_ALLOW_PROVISIONING_UPDATES:-0} note=\"Set UNUVAULT_IOS_DEVELOPMENT_TEAM if Xcode cannot infer signing.\""
  fi

  if [[ "${#preflight_reasons[@]}" -gt 0 ]]; then
    echo "UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT status=blocked reason=${preflight_reasons[0]} lan_host=${lan_host:-unset} lan_port=$lan_port device_id=${device_id:-unset}"
    exit 1
  fi

  echo "UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT status=ready lan_host=$lan_host lan_port=$lan_port device_id=$device_id"
}

run_preflight

if [[ "$preflight_only" == "1" ]]; then
  exit 0
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
