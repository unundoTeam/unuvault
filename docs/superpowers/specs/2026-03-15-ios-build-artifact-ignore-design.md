# iOS Build Artifact Ignore Design

**Problem:** Running local Swift Package and simulator workflows leaves `[apps/ios/App/.build/](/Users/yuchen/Desktop/blackbox/apps/ios/App/.build/)` as an untracked artifact in the main workspace, which makes the repository appear dirty even when source files are unchanged.

**Goal:** Ignore only the Swift Package build directory for `apps/ios/App` and remove the current local artifact so the main workspace returns to a clean git status.

## Scope

- Add a precise ignore rule for `apps/ios/App/.build/`
- Remove the current local `.build/` artifact from the main workspace
- Verify git now ignores that path and the main workspace is clean

## Non-Goals

- Do not change application code, tests, CI, or broader ignore rules
- Do not add generalized `.build/` ignore patterns outside `apps/ios/App`

## Approach

1. Update the repository root `[.gitignore](/Users/yuchen/Desktop/blackbox/.gitignore)` with a path-specific ignore rule.
2. Delete `[apps/ios/App/.build/](/Users/yuchen/Desktop/blackbox/apps/ios/App/.build/)` from the main workspace.
3. Verify the path is ignored and that `git status --short --branch` in the main workspace is clean again.
