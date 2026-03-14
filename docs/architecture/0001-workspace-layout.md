# unuvault Workspace Layout

## Validation Checklist

- [x] apps directory exists for api, web, browser-extension, and ios
- [x] packages directory exists for domain, security, and api-client
- [x] root workspace tooling is shared instead of duplicated

## Workspace Layout

- `apps/api` - account, vault, devices, imports, activity, and sync APIs
- `apps/web` - onboarding, vault browsing, trust center, and import flows
- `apps/browser-extension` - autofill, save/update prompts, popup, and sync hooks
- `apps/ios` - iPhone unlock, search, and AutoFill onboarding
- `packages/domain` - shared item schemas, validators, and persistence contracts
- `packages/security` - crypto envelopes, unlock policy, and trust copy
- `packages/api-client` - typed clients shared by web and browser extension
- `infra/supabase` - database migrations, policies, and local setup

## Notes

- The JavaScript and TypeScript surfaces are managed from the root pnpm workspace.
- `apps/ios` is tracked with a lightweight README because it is part of the product scope but not part of the pnpm workspace.
- Product and sequencing decisions are governed by `docs/architecture/0000-phase1-execution-baseline.md`.
