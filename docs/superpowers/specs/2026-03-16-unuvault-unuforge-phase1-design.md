# unuvault Unuforge Phase 1 Design

**Problem:** `unuvault` 现在已经有稳定的人类入口和 CI 入口，但还没有接入 `unuforge` 的统一机器入口，导致它不能像 `unundo` 一样通过 preset/CLI contract 被统一发现和调度。

## Current Context

- 根入口已经稳定：
  - `pnpm test` -> `bash scripts/testing/test-runner.sh`
  - `pnpm lint` -> `bash scripts/testing/lint-runner.sh`
- 现有 shell wrapper 已经是仓库级稳定入口：
  - `scripts/testing/test-runner.sh`
  - `scripts/testing/lint-runner.sh`
- 当前 CI 只依赖 `pnpm lint` / `pnpm test`，还没有更深的治理运行时。

这意味着 `unuvault` 当前最适合接入 `unuforge` 的“薄契约层”，而不是直接复制 `unundo` 的 manifest/guard/bundle 模型。

## Approaches Considered

### Option 1: 只加 preset

- 新增 preset
- 支持 `preset inspect` / `profiles list`
- 不加 host adapter

优点：改动最小。  
缺点：`profiles run` 不能真正接上仓库入口，价值有限。

### Option 2: 薄 preset + 轻 host adapter（Chosen）

- 新增 `presets/unuvault/release-preset.json`
- 暴露两个 profile：
  - `lint-runner`
  - `test-runner`
- 新增 `unuvault_forge_host`
- `profiles run` 只桥接到现有 shell wrapper
- 先不做 actions / deploy / ios profile

优点：
- 与当前仓库现状最匹配
- 可以立刻获得 `preset inspect`、`profiles list`、`profiles run --dry-run`
- 后续加 `ios-test-runner` 时路径自然

### Option 3: 直接引入完整治理运行时

- 上 manifest、profile registry、更多 runtime 语义
- 同步改 CI

优点：一步到位。  
缺点：过重，会把 `unuvault` 提前拖进 `unundo` 那套治理复杂度。

## Chosen Design

第一阶段采用 Option 2。

### Machine Surface

`unuvault` 第一阶段只暴露两个 machine profiles：

- `lint-runner`
- `test-runner`

它们分别桥接到：

- `scripts/testing/lint-runner.sh`
- `scripts/testing/test-runner.sh`

### Host Boundary

新增一个很薄的 `unuvault_forge_host`：

- `build_profile_execution(...)`
  - 返回 `runner=command`
  - `command` 指向现有 shell wrapper
- `run_profile(...)`
  - 直接执行 wrapper

第一阶段不暴露 deployment action，也不引入 `governance_kernel`。

### unuforge Consumption

`unuvault` 通过 repo-root `unuforge/__init__.py` 解析外部 `unuforge` 仓库：

- 优先 `UNUFORGE_SRC_ROOT`
- 其次 `UNUFORGE_REPO_ROOT/src/unuforge`
- 再其次 sibling repo：`../unuforge/src/unuforge`

第一阶段不在 `unuvault` 内部再复制一份 fallback mirror。

### CI Scope

第一阶段不切 `.github/workflows/ci.yml`。

原因：
- 当前 CI 已经稳定使用 `pnpm lint` / `pnpm test`
- 先把 `unuforge` 的 machine contract 接通，再决定是否让 CI 也调用 `unuforge.cli`

## Testing Strategy

- 新增一个根级 meta test，锁定：
  - preset 文件存在
  - host adapter 文件存在
  - preset surface 名称与 target 稳定
  - human-facing shell wrapper 仍然是 canonical root entrypoint
- 本地额外验证：
  - `python3 -m unuforge.cli preset inspect --preset presets/unuvault/release-preset.json --json`
  - `python3 -m unuforge.cli profiles list --preset presets/unuvault/release-preset.json --json`
  - `python3 -m unuforge.cli profiles run lint-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host --dry-run --json`
  - `python3 -m unuforge.cli profiles run test-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host --dry-run --json`

## Non-Goals

- 不引入 deployment actions
- 不在第一阶段接入 iOS profile
- 不切换 CI 到 `unuforge.cli`
- 不复制 `unundo` 的 manifest/guard/bundle runtime
