# unuvault

unuvault is a Chinese-first public cloud password manager for technical users who want a more trustworthy home for credentials than browser-native storage.

## Source Of Truth

- Product scope and trust posture: `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`
- Execution baseline: `docs/architecture/0000-phase1-execution-baseline.md`
- Engineering roadmap: `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`

## Workspace Layout

- `apps/api` - account, vault, devices, imports, and activity APIs
- `apps/web` - onboarding, vault management, and trust center
- `apps/browser-extension` - autofill, save/update prompts, and popup UI
- `apps/ios` - SwiftUI iPhone app and AutoFill onboarding
- `packages/domain` - shared schemas and validation
- `packages/security` - crypto, unlock, and trust boundaries
- `packages/api-client` - shared typed clients for web and extension
- `infra/supabase` - migrations and local infrastructure notes

## Current Status

This repository currently contains the bootstrap workspace skeleton and planning docs for phase 1. The next planned step is defining the phase-1 schema boundary and the client-side security model.
