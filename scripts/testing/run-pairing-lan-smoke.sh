#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
if [[ "${UNUVAULT_SHARED_TEST_LOCK_HELD:-0}" != "1" ]]; then
  exec "$repo_root/scripts/testing/run-with-shared-test-lock.sh" "$0" "$@"
fi

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

lan_port="${UNUVAULT_PAIRING_LAN_PORT:-17669}"

echo "Running UnuVault pairing LAN smoke proof at http://$lan_host:$lan_port"

UNUVAULT_PAIRING_LAN_HOST="$lan_host" \
UNUVAULT_PAIRING_LAN_PORT="$lan_port" \
swift test \
  --package-path "$repo_root/apps/macos/App" \
  --filter RuntimeLANPairingSmokeTests
