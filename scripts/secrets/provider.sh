#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
tsx_bin="$repo_root/node_modules/.bin/tsx"

exec "$tsx_bin" "$repo_root/scripts/secrets/provider.ts" "$@"
