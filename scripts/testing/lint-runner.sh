#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
pnpm_bin="$repo_root/node_modules/.bin/pnpm"

cd "$repo_root"

"$pnpm_bin" exec tsc --noEmit -p tsconfig.json
"$pnpm_bin" -r lint
