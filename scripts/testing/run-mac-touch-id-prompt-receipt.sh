#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"
capture=0
timeout_seconds="${UNUVAULT_TOUCH_ID_PROMPT_TIMEOUT_SECONDS:-12}"
capture_delay_seconds="${UNUVAULT_TOUCH_ID_PROMPT_CAPTURE_DELAY_SECONDS:-2}"
output_dir="${UNUVAULT_TOUCH_ID_PROMPT_OUTPUT_DIR:-$repo_root/docs/design/evidence/$(date +%F)-mac-touch-id-prompt}"
prompt_reason="${UNUVAULT_TOUCH_ID_PROMPT_REASON:-Unlock UnuVault local vault on this Mac.}"

usage() {
  cat <<'USAGE'
Usage: bash scripts/testing/run-mac-touch-id-prompt-receipt.sh [--capture] [--output-dir <path>] [--timeout-seconds <seconds>]

Default mode builds the prompt receipt host and performs a non-prompting
LocalAuthentication readiness check.

--capture triggers the real macOS owner-authentication prompt, waits briefly,
captures a screenshot, then lets the prompt host cancel itself after the timeout.
Use it only when an interactive local UX receipt is intended.
USAGE
}

record() {
  echo "UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT $*"
}

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --capture)
      capture=1
      ;;
    --output-dir|--timeout-seconds|--reason)
      ;;
    --help|-h)
      usage
      exit 0
      ;;
  esac
done

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --capture)
      capture=1
      shift
      ;;
    --output-dir)
      output_dir="${2:-}"
      if [[ -z "$output_dir" ]]; then
        record "status=failed error=missing_output_dir" >&2
        exit 2
      fi
      shift 2
      ;;
    --timeout-seconds)
      timeout_seconds="${2:-}"
      if [[ -z "$timeout_seconds" || ! "$timeout_seconds" =~ ^[0-9]+$ || "$timeout_seconds" == "0" ]]; then
        record "status=failed error=invalid_timeout value=${timeout_seconds:-unset}" >&2
        exit 2
      fi
      shift 2
      ;;
    --reason)
      prompt_reason="${2:-}"
      if [[ -z "$prompt_reason" ]]; then
        record "status=failed error=missing_reason" >&2
        exit 2
      fi
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      record "status=failed error=unknown_arg arg=$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command_name in swift; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    record "status=failed error=missing_command command=$command_name" >&2
    exit 1
  fi
done

record "status=running check=build_host product=MacLocalAuthenticationPromptReceiptHost"
swift build \
  --package-path "$mac_package" \
  --product MacLocalAuthenticationPromptReceiptHost

bin_path="$(swift build --package-path "$mac_package" --show-bin-path)"
host_binary="$bin_path/MacLocalAuthenticationPromptReceiptHost"

if [[ ! -x "$host_binary" ]]; then
  record "status=failed error=missing_host_binary path=$host_binary" >&2
  exit 1
fi

if [[ "$capture" == "0" ]]; then
  "$host_binary"
  record "status=ready claim=local_auth_prompt_preflight unclaimed=touch_id_prompt_screenshot,notarization,physical_iphone"
  exit 0
fi

if ! command -v screencapture >/dev/null 2>&1; then
  record "status=blocked reason=missing_screencapture help=\"Run --capture on macOS with screencapture available.\""
  exit 1
fi

mkdir -p "$output_dir"
receipt_log="$(mktemp "${TMPDIR:-/tmp}/unuvault-touch-id-prompt.XXXXXX.log")"
output_path="$output_dir/touch-id-prompt.png"

cleanup() {
  rm -f "$receipt_log"
}
trap cleanup EXIT

record "status=running check=prompt_capture output=$output_path timeout_seconds=$timeout_seconds"

"$host_binary" \
  --prompt \
  --reason "$prompt_reason" \
  --timeout-seconds "$timeout_seconds" >"$receipt_log" 2>&1 &
host_pid="$!"

for _ in $(seq 1 "$timeout_seconds"); do
  if grep -q "status=prompt_requested" "$receipt_log"; then
    break
  fi
  if ! kill -0 "$host_pid" >/dev/null 2>&1; then
    cat "$receipt_log"
    record "status=blocked reason=prompt_host_exited_before_prompt"
    exit 1
  fi
  sleep 1
done

if ! grep -q "status=prompt_requested" "$receipt_log"; then
  cat "$receipt_log"
  record "status=blocked reason=prompt_not_observed"
  kill "$host_pid" >/dev/null 2>&1 || true
  wait "$host_pid" >/dev/null 2>&1 || true
  exit 1
fi

sleep "$capture_delay_seconds"
screencapture -x "$output_path"
wait "$host_pid" >/dev/null 2>&1 || true
cat "$receipt_log"

record "status=ready claim=touch_id_prompt_screenshot screenshot=$output_path unclaimed=notarization,physical_iphone"
