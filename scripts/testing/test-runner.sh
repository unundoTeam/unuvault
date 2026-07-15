#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
pnpm_bin="$repo_root/node_modules/.bin/pnpm"

cd "$repo_root"

exec "$script_dir/run-with-shared-test-lock.sh" bash -c "
  set -euo pipefail
  \"\$1\" exec vitest --run --exclude='.worktrees/**' tests
  \"\$1\" -r test
" bash "$pnpm_bin"
