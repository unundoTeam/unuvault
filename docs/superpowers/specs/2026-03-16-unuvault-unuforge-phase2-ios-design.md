# unuvault Unuforge Phase 2 iOS Design

**Problem:** `unuvault` phase 1 已经把 JavaScript 主链路接入了 `unuforge`，但 iOS 仍然只暴露人工/CI shell 入口，导致统一 machine surface 还缺一块。

## Current Context

- phase 1 已暴露两个 machine profiles：
  - `lint-runner`
  - `test-runner`
- iOS 现在已经有稳定 wrapper：
  - `scripts/testing/run-ios.sh`
- iOS workflow 目前单独存在：
  - `.github/workflows/ios.yml`
- 这个 wrapper 已经封装了 simulator 选择和 `xcodebuild test` 调用，所以 phase 2 最合适的仍然是“桥接现有入口”，而不是重做运行时。

## Approaches Considered

### Option 1: 只增加 `ios-test-runner` machine profile（Chosen）

- 在 preset 中新增 `ios-test-runner`
- host adapter 把它映射到 `scripts/testing/run-ios.sh`
- workflow 先保持不变

优点：
- 延续 phase 1 的薄契约策略
- 改动面小，风险低
- 先获得统一 machine surface，再决定 CI 是否要消费它

### Option 2: 增加 profile，并把 iOS workflow 同时切到 `unuforge.cli`

- 新增 `ios-test-runner`
- `.github/workflows/ios.yml` 改成调用 `python3 -m unuforge.cli`

优点：一步让 CI 和 machine surface 对齐。  
缺点：收益有限，但会增加 iOS CI 的调试面。

### Option 3: 把 JS 和 iOS workflow 一起统一到 `unuforge.cli`

- iOS profile 接入
- iOS workflow 切换
- JS CI 也同步切换

优点：统一度最高。  
缺点：超出 phase 2 范围，会把独立的小步演进变成一次大改。

## Chosen Design

phase 2 采用 Option 1。

### Machine Surface

在 `presets/unuvault/release-preset.json` 中新增：

- `ios-test-runner`

定义保持与现有 profiles 一致：

- `type`: `profile`
- `domain`: `testing`
- `visibility`: `human-and-machine`

并新增 entrypoint：

- `ios_test_runner` -> `scripts/testing/run-ios.sh`

### Host Boundary

`unuvault_forge_host` 新增一个 profile 映射：

- `ios-test-runner` -> `scripts/testing/run-ios.sh`

`build_profile_execution(...)` 仍返回 `runner=command`，`run_profile(...)` 仍直接执行 shell wrapper。phase 2 不引入 action，也不加更深的 iOS runtime 语义。

### CI Scope

phase 2 不修改 `.github/workflows/ios.yml`。

原因：
- workflow 当前已经稳定调用 wrapper
- 先把 `unuforge` contract 补完整，再决定是否让 workflow 消费它
- 这样如果 iOS 运行环境有问题，排查面仍然留在现有 wrapper 层

## Testing Strategy

- 扩展根级 meta test，锁定：
  - preset 暴露 `ios-test-runner`
  - entrypoint 暴露 `ios_test_runner`
  - host adapter 支持该 profile
- 本地 contract 验证：
  - `python3 -m unuforge.cli preset inspect --preset presets/unuvault/release-preset.json --json`
  - `python3 -m unuforge.cli profiles list --preset presets/unuvault/release-preset.json --json`
  - `python3 -m unuforge.cli profiles run ios-test-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host --dry-run --json`
- 如果本机 simulator 环境就绪，再额外验证：
  - `python3 -m unuforge.cli profiles run ios-test-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host`

## Non-Goals

- 不切换 `.github/workflows/ios.yml` 到 `unuforge.cli`
- 不切换 JS CI 到 `unuforge.cli`
- 不引入 deployment actions
- 不复制 `unundo` 的更深治理运行时
