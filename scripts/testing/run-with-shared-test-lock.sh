#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

if (( $# == 0 )); then
  echo "Usage: $0 <test-command> [args...]" >&2
  exit 2
fi

if ! git_common_dir="$(
  git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null
)" || [[ -z "$git_common_dir" || ! -d "$git_common_dir" ]]; then
  printf 'UNUVAULT_TEST_RUNNER status=failed reason=git_common_dir_unavailable repo=%s\n' \
    "$repo_root" >&2
  exit 74
fi

test_lock_path="$git_common_dir/.unuvault-test-runner.lock"
test_lock_owner_file=""
handshake_dir=""
ready_fifo=""
control_fifo=""
supervisor_pid=""
supervisor_pgid=""
forward_signal=""
pending_signal=""

process_group_exists() {
  [[ -n "$supervisor_pgid" ]] && kill -0 "-$supervisor_pgid" >/dev/null 2>&1
}

wait_for_process_group() {
  while process_group_exists; do
    sleep 0.02
  done
}

cleanup_handshake() {
  exec 3>&- 4>&- || true
  if [[ -n "$ready_fifo" && ( -e "$ready_fifo" || -p "$ready_fifo" ) ]]; then
    rm -f "$ready_fifo" || true
  fi
  if [[ -n "$control_fifo" && ( -e "$control_fifo" || -p "$control_fifo" ) ]]; then
    rm -f "$control_fifo" || true
  fi
  if [[ -n "$handshake_dir" && -d "$handshake_dir" ]]; then
    rmdir "$handshake_dir" 2>/dev/null || true
  fi
}

cleanup() {
  local exit_code="$1"
  local cleanup_failed=0

  trap - EXIT INT TERM

  if [[ -n "$forward_signal" ]] && process_group_exists; then
    kill "-$forward_signal" "-$supervisor_pgid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$supervisor_pid" ]]; then
    wait "$supervisor_pid" >/dev/null 2>&1 || true
  fi
  wait_for_process_group
  cleanup_handshake

  if [[ -n "$test_lock_owner_file" && \
        ( -e "$test_lock_path" || -L "$test_lock_path" ) && \
        "$test_lock_path" -ef "$test_lock_owner_file" ]]; then
    rm -f "$test_lock_path" || cleanup_failed=1
  fi
  if [[ -n "$test_lock_owner_file" && \
        ( -e "$test_lock_owner_file" || -L "$test_lock_owner_file" ) ]]; then
    rm -f "$test_lock_owner_file" || cleanup_failed=1
  fi

  if [[ "$cleanup_failed" == "1" ]]; then
    printf 'UNUVAULT_TEST_RUNNER status=failed reason=lock_cleanup_failed lock=%s\n' \
      "$test_lock_path" >&2
    [[ "$exit_code" != "0" ]] || exit_code=1
  fi

  exit "$exit_code"
}

forward_and_cleanup() {
  forward_signal="$1"
  cleanup "$2"
}

record_pending_signal() {
  [[ -n "$pending_signal" ]] || pending_signal="$1"
}

pending_signal_exit_code() {
  if [[ "$pending_signal" == "INT" ]]; then
    printf '130\n'
  else
    printf '143\n'
  fi
}

abort_supervisor_and_cleanup() {
  local abort_reason="$1"
  local exit_code="$2"

  if [[ -n "$pending_signal" ]]; then
    abort_reason="$pending_signal"
    exit_code="$(pending_signal_exit_code)"
  fi

  printf 'ABORT %s\n' "$abort_reason" >&4
  wait "$supervisor_pid" >/dev/null 2>&1 || true

  if [[ -n "$pending_signal" ]]; then
    exit_code="$(pending_signal_exit_code)"
  fi
  cleanup "$exit_code"
}

run_supervisor() {
  local identity=""
  local expected_pid=""
  local observed_pgid=""
  local action=""
  local command_exit_code=0

  set +m
  trap 'exit 130' INT
  trap 'exit 143' TERM

  if ! IFS=' ' read -r identity expected_pid <&4 || \
     [[ "$identity" != "IDENTIFY" || ! "$expected_pid" =~ ^[0-9]+$ ]]; then
    printf 'FAILED invalid_identity\n' >&3
    exit 74
  fi

  observed_pgid="$(
    /bin/ps -o pgid= -p "$expected_pid" 2>/dev/null | tr -d '[:space:]' || true
  )"
  if [[ -z "$observed_pgid" || "$observed_pgid" != "$expected_pid" ]]; then
    printf 'FAILED process_group_unavailable\n' >&3
    exit 74
  fi

  printf 'READY %s %s\n' "$expected_pid" "$observed_pgid" >&3
  if ! IFS= read -r action <&4; then
    exit 74
  fi

  case "$action" in
    START)
      ;;
    "ABORT TERM")
      exit 143
      ;;
    "ABORT INT")
      exit 130
      ;;
    "ABORT FAILURE")
      exit 74
      ;;
    *)
      exit 74
      ;;
  esac

  exec 3>&- 4>&-
  set +e
  UNUVAULT_SHARED_TEST_LOCK_HELD=1 "$@"
  command_exit_code="$?"
  set -e
  exit "$command_exit_code"
}

trap 'cleanup "$?"' EXIT
trap 'forward_and_cleanup INT 130' INT
trap 'forward_and_cleanup TERM 143' TERM

if ! test_lock_owner_file="$(
  mktemp "$git_common_dir/.unuvault-test-runner.owner.XXXXXX"
)"; then
  printf 'UNUVAULT_TEST_RUNNER status=failed reason=owner_token_create_failed lock=%s\n' \
    "$test_lock_path" >&2
  exit 74
fi
printf 'pid=%s\n' "$$" > "$test_lock_owner_file"

if [[ -e "$test_lock_path" || -L "$test_lock_path" ]] || \
   ! ln "$test_lock_owner_file" "$test_lock_path" 2>/dev/null; then
  printf 'UNUVAULT_TEST_RUNNER status=blocked reason=concurrent_runner lock=%s help="Confirm no test runner is active, then remove %s manually."\n' \
    "$test_lock_path" \
    "$test_lock_path" >&2
  exit 75
fi
if [[ ! "$test_lock_path" -ef "$test_lock_owner_file" ]]; then
  printf 'UNUVAULT_TEST_RUNNER status=failed reason=lock_acquire_failed lock=%s\n' \
    "$test_lock_path" >&2
  exit 74
fi

trap 'record_pending_signal INT' INT
trap 'record_pending_signal TERM' TERM

if ! handshake_dir="$(
  mktemp -d "$git_common_dir/.unuvault-test-runner.handshake.XXXXXX"
)"; then
  printf 'UNUVAULT_TEST_RUNNER status=failed reason=readiness_handshake_unavailable lock=%s\n' \
    "$test_lock_path" >&2
  exit 74
fi
ready_fifo="$handshake_dir/ready"
control_fifo="$handshake_dir/control"
if ! mkfifo "$ready_fifo" "$control_fifo" || \
   ! exec 3<> "$ready_fifo" || \
   ! exec 4<> "$control_fifo"; then
  printf 'UNUVAULT_TEST_RUNNER status=failed reason=readiness_handshake_unavailable lock=%s\n' \
    "$test_lock_path" >&2
  exit 74
fi

if [[ -n "$pending_signal" ]]; then
  cleanup "$(pending_signal_exit_code)"
fi

set -m
run_supervisor "$@" &
supervisor_pid="$!"
set +m

printf 'IDENTIFY %s\n' "$supervisor_pid" >&4

readiness_state=""
ready_pid=""
ready_pgid=""
if ! IFS=' ' read -r readiness_state ready_pid ready_pgid <&3 || \
   [[ "$readiness_state" != "READY" || \
      "$ready_pid" != "$supervisor_pid" || \
      "$ready_pgid" != "$supervisor_pid" ]]; then
  if [[ -z "$pending_signal" ]]; then
    printf 'UNUVAULT_TEST_RUNNER status=failed reason=process_group_unavailable pid=%s pgid=%s\n' \
      "$supervisor_pid" \
      "${ready_pgid:-unavailable}" >&2
  fi
  abort_supervisor_and_cleanup FAILURE 74
fi
supervisor_pgid="$ready_pgid"

observed_pgid="$(
  /bin/ps -o pgid= -p "$supervisor_pid" 2>/dev/null | tr -d '[:space:]' || true
)"
if [[ -z "$observed_pgid" || "$observed_pgid" != "$supervisor_pgid" ]]; then
  if [[ -z "$pending_signal" ]]; then
    printf 'UNUVAULT_TEST_RUNNER status=failed reason=process_group_unavailable pid=%s pgid=%s\n' \
      "$supervisor_pid" \
      "${observed_pgid:-unavailable}" >&2
  fi
  abort_supervisor_and_cleanup FAILURE 74
fi

trap 'forward_and_cleanup INT 130' INT
trap 'forward_and_cleanup TERM 143' TERM
if [[ -n "$pending_signal" ]]; then
  forward_and_cleanup "$pending_signal" "$(pending_signal_exit_code)"
fi

printf 'START\n' >&4
cleanup_handshake

set +e
wait "$supervisor_pid"
exit_code="$?"
set -e
cleanup "$exit_code"
