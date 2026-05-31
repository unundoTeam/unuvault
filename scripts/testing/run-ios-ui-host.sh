#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
host_root="$repo_root/apps/ios/HostApp"
derived_data="$repo_root/.derived-data/ios-ui-host"
bundle_id="com.unuvault.ioshost"
output_dir="$repo_root/docs/design/evidence/2026-05-29-ios-ui-host"
normal_output_path="$output_dir/ios-pairing-invite-host.png"
dynamic_type_output_path="$output_dir/ios-pairing-invite-host-accessibility3.png"

run_with_timeout() {
  local timeout_seconds="$1"
  shift

  "$@" &
  local command_pid="$!"
  local elapsed_seconds=0

  while kill -0 "$command_pid" >/dev/null 2>&1; do
    if (( elapsed_seconds >= timeout_seconds )); then
      kill -TERM "$command_pid" >/dev/null 2>&1 || true
      wait "$command_pid" >/dev/null 2>&1 || true
      return 124
    fi

    sleep 1
    elapsed_seconds=$((elapsed_seconds + 1))
  done

  wait "$command_pid"
}

launch_and_capture() {
  local output_path="$1"
  shift

  run_with_timeout 10 xcrun simctl terminate "$simulator_id" "$bundle_id" >/dev/null 2>&1 || true

  local launched=0
  for _ in {1..5}; do
    if run_with_timeout 20 xcrun simctl launch "$simulator_id" "$bundle_id" "$@"; then
      launched=1
      break
    fi
    sleep 1
  done

  if [[ "$launched" != "1" ]]; then
    echo "Unable to launch UnuVaultIOSHost on $simulator_name." >&2
    exit 1
  fi

  sleep 2
  run_with_timeout 20 xcrun simctl io "$simulator_id" screenshot "$output_path"
}

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required for the iOS UI host. Install it, then rerun this script." >&2
  exit 1
fi

available_simulators="$(xcrun simctl list devices available)"
simulator_name=""
for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if awk -v name="$candidate" '$0 ~ "^[[:space:]]*" name " \\(" { found = 1 } END { exit found ? 0 : 1 }' <<<"$available_simulators"; then
    simulator_name="$candidate"
    break
  fi
done

if [[ -z "$simulator_name" ]]; then
  echo "No supported iPhone simulator is available. Expected iPhone 17, 16, or 15." >&2
  xcrun simctl list devices available >&2
  exit 1
fi

simulator_id="$(
  xcrun simctl list devices available | awk -v name="$simulator_name" '
    $0 ~ "^[[:space:]]*" name " \\(" {
      if (match($0, /\([0-9A-F-]{36}\)/)) {
        print substr($0, RSTART + 1, RLENGTH - 2)
        exit
      }
    }
  '
)"

if [[ -z "$simulator_id" ]]; then
  echo "Unable to resolve simulator id for $simulator_name." >&2
  exit 1
fi

mkdir -p "$output_dir"

xcodegen --quiet --spec "$host_root/project.yml" --project "$host_root"

xcodebuild \
  -project "$host_root/UnuVaultIOSHost.xcodeproj" \
  -scheme UnuVaultIOSHost \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath "$derived_data" \
  build

app_path="$derived_data/Build/Products/Debug-iphonesimulator/UnuVaultIOSHost.app"

xcrun simctl boot "$simulator_id" >/dev/null 2>&1 || true

simulator_state=""
for _ in {1..60}; do
  simulator_state="$(
    xcrun simctl list devices available | awk -v id="$simulator_id" '
      index($0, id) {
        if (index($0, "(Booted)") > 0) {
          print "Booted"
        } else {
          print "Waiting"
        }
        exit
      }
    '
  )"

  if [[ "$simulator_state" == "Booted" ]]; then
    break
  fi

  sleep 1
done

if [[ "$simulator_state" != "Booted" ]]; then
  echo "$simulator_name did not finish booting." >&2
  exit 1
fi

sleep 3

installed=0
for _ in {1..5}; do
  if run_with_timeout 20 xcrun simctl install "$simulator_id" "$app_path"; then
    installed=1
    break
  fi
  sleep 1
done

if [[ "$installed" != "1" ]]; then
  echo "Unable to install UnuVaultIOSHost on $simulator_name." >&2
  exit 1
fi

launch_and_capture "$normal_output_path" --unuvault-dynamic-type large
launch_and_capture "$dynamic_type_output_path" --unuvault-dynamic-type accessibility3

echo "iOS UI host screenshot: $normal_output_path"
echo "iOS UI host Dynamic Type screenshot: $dynamic_type_output_path"
