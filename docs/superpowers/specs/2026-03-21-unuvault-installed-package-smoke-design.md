# unuvault Installed-Package Smoke Design

**Problem:** `unuvault` 已经是 `unuforge` 的官方 sample consumer，但目前还没有 repo-owned 的 installed-package smoke 来证明发布后的 `unuforge` wheel 仍然能通过 `unuvault` 的 preset 和 host contract 被正确消费。

## Current Context

- `unuvault` 已经有稳定的 repo-local machine surface：
  - `preset inspect`
  - `profiles list`
  - `lint-runner`
  - `test-runner`
  - `ios-test-runner`
- `unuforge` 当前的 installed-package downstream gate 只覆盖：
  - `unuidentity`
  - `unundo`
- `unuvault` 的 official sample baseline 目前只纳入 JS-safe contract floor，
  不包括 `ios-test-runner`。
- 现有 `unuvault_forge_host` 通过 `Path(__file__).resolve().parents[4]`
  推 repo root，这对 installed-package 场景不够稳，因为 package 安装后的
  文件层级不应成为 repo root 解析的隐式 contract。

## Approaches Considered

### Option 1: 只在 `unuforge` 里把 `unuvault` 加进 installed-package gate

- 不先给 `unuvault` 自己补 smoke
- 直接在 `unuforge` 里登记新的 consumer

优点：
- 改动集中在一个仓库

缺点：
- ownership 不对
- `unuvault` 自己没有 repo-owned 的 published-package contract
- 一旦 smoke 坏掉，更像是 `unuforge` 在维护 `unuvault` 的消费入口

### Option 2: 先做 `unuvault` repo-owned installed-package smoke（Chosen）

- `unuvault` 自己提供一个 opt-in smoke 脚本
- 输入只认 `UNUFORGE_WHEEL_PATH`，并保留 `UNUFORGE_REPO_ROOT` 作为本地 fallback
- smoke 在干净 venv 中安装：
  - `unuforge` wheel
  - `packages/unuvault-forge-host`
- smoke 只覆盖 JS-safe contract：
  - `preset inspect`
  - `profiles list`
  - `lint-runner --dry-run --json`
  - `test-runner --dry-run --json`

优点：
- ownership 清楚
- 后续 `unuforge` 只需要调用稳定 repo-owned entrypoint
- 能先把 `unuvault` 的 published-wheel contract 单独做实

### Option 3: 直接把 installed-package smoke 塞进现有 `pnpm test`

- 把 wheel install 和 Python smoke 混进 JS 常规测试

优点：
- 表面上入口更少

缺点：
- 会把 Python wheel 验证和 repo-local JS 测试边界混在一起
- contributor 心智负担更重
- 失败时很难判断是 repo-local 测试问题还是 published-package contract 问题

## Chosen Design

采用 Option 2。

### Smoke Ownership

新增 repo-owned smoke 脚本：

- `scripts/ci/tests/test_unuforge_package_consumer_smoke.py`

这个脚本的角色是：

- 证明发布后的 `unuforge` package 可以被 `unuvault` 消费
- 保持 opt-in，不进入当前日常 JS CI
- 为将来纳入 `unuforge` installed-package gate 提供稳定入口

### Runtime Shape

smoke 使用 Python `unittest` 风格，与 `unuidentity` / `unundo` 的
installed-package smoke 保持一致：

- 创建临时目录和干净 venv
- 解析 wheel：
  - 优先 `UNUFORGE_WHEEL_PATH`
  - 否则使用 `UNUFORGE_REPO_ROOT` 调 `build_distribution.py`
- 安装：
  - `unuforge` wheel
  - `packages/unuvault-forge-host`
- 以受控环境运行 `python -m unuforge.cli`

### Contract Scope

第一版只验证 JS-safe contract：

- `preset inspect --json`
- `profiles list --json`
- `profiles run lint-runner --dry-run --json`
- `profiles run test-runner --dry-run --json`

明确不纳入：

- `ios-test-runner`
- 非 dry-run 执行
- 任何 `action` surface

### Host Resolution Change

`packages/unuvault-forge-host/src/unuvault_forge_host/host.py` 需要一并调整。

新的 host 不再依赖安装位置推导 repo root，而是像 `unuidentity` 一样：

- 从 `preset_path` 解析 repo root
- 从 preset payload 解析 surface 与 entrypoint
- 返回稳定的 `runner=command` 结构

这样 installed-package smoke 验证的就是：

- 发布后的 `unuforge` wheel
- `unuvault` 当前 checked-in preset
- `unuvault` 当前 checked-in host package

而不是某种偶然成立的相对路径布局。

### Expected Assertions

第一版 smoke 应该断言：

- `preset inspect` 成功且 `project.name == "unuvault"`
- `profiles list` 包含：
  - `lint-runner`
  - `test-runner`
- `lint-runner --dry-run --json`：
  - `runner == "command"`
  - `cwd == <unuvault repo root>`
  - `command == ["bash", "<repo>/scripts/testing/lint-runner.sh"]`
- `test-runner --dry-run --json`：
  - `runner == "command"`
  - `cwd == <unuvault repo root>`
  - `command == ["bash", "<repo>/scripts/testing/test-runner.sh"]`

### README Contract

`README.md` 应补一段简短说明：

- `unuvault` 现在有 opt-in installed-package smoke
- 该 smoke 验证 published `unuforge` wheel 的 JS-safe contract
- `ios-test-runner` 仍然不在第一版 installed-package smoke 范围内

## Testing Strategy

实现后应至少验证：

- `PYTHONPATH=/Users/yuchen/Code/unu/unuforge/src pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts`
- `UNUFORGE_REPO_ROOT=/Users/yuchen/Code/unu/unuforge python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py`

更真实的 wheel 路径验证应支持：

- 在 `unuforge` 构建 wheel
- `UNUFORGE_WHEEL_PATH=/abs/path/to/unuforge-<version>-py3-none-any.whl python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py`

## Non-Goals

- 不把 `unuvault` 立即加进 `unuforge` installed-package gate
- 不把 `ios-test-runner` 纳入第一版 smoke
- 不切换 `unuvault` 当前 CI 到这条 smoke
- 不扩大 `unuforge` 官方 sample baseline
