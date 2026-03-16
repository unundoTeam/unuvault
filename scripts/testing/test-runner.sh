#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
pnpm_bin="$repo_root/node_modules/.bin/pnpm"

cd "$repo_root"

"$pnpm_bin" exec vitest --run --exclude='.worktrees/**' tests
"$pnpm_bin" -r test
