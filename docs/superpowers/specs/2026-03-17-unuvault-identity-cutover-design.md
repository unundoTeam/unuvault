# Unuvault Identity Cutover Design

**Problem:** `PR #21` moves `unuvault` from a product-local Supabase auth flow to `unuidentity`, but the current implementation mixes `auth.users.id` and `accounts.id` into a single `account_id` concept. That makes bootstrap and vault sync resolve the wrong identity key, and it seeds new `users_profile.account_id` values with data that will not match the real `unuidentity` account rows.

## Current State

- [`apps/api/src/lib/supabase.ts`](/Users/yuchen/Desktop/unuvault/.worktrees/codex-unuvault-account-id-bootstrap/apps/api/src/lib/supabase.ts) resolves an identity user from the `unuidentity` token, but falls back to `user.id` when `account_id` is not present in metadata.
- [`infra/supabase/migrations/0003_users_profile_account_id.sql`](/Users/yuchen/Desktop/unuvault/.worktrees/codex-unuvault-account-id-bootstrap/infra/supabase/migrations/0003_users_profile_account_id.sql) backfills `users_profile.account_id` from `auth_user_id`.
- [`apps/api/src/services/auth-bootstrap-service.ts`](/Users/yuchen/Desktop/unuvault/.worktrees/codex-unuvault-account-id-bootstrap/apps/api/src/services/auth-bootstrap-service.ts) and [`apps/api/src/services/vault-service.ts`](/Users/yuchen/Desktop/unuvault/.worktrees/codex-unuvault-account-id-bootstrap/apps/api/src/services/vault-service.ts) both assume `account_id` is the canonical user key for product lookups.
- [`unuidentity`](/Users/yuchen/Desktop/unuidentity) explicitly models `accounts.id` separately from `primary_auth_user_id`, and its shared-login design says product backends validate the identity token and then resolve the real `account_id`.

## Approaches

### Option 1: Compatibility bridge by email

- Keep the current migration
- Try to map old `users_profile` rows to new identity accounts by `email`
- Preserve existing local product rows automatically

Trade-off:
- Makes the current PR appear smoother, but it turns pre-launch test data into a long-lived compatibility concern and introduces a real risk of binding the wrong profile to the wrong account.

### Option 2: Clean cutover with strict `account_id` resolution (Recommended)

- Only accept a real `account_id` resolved from the identity context
- Remove the `auth_user_id -> account_id` fallback
- Stop backfilling `users_profile.account_id` from old local ids
- Recreate local test accounts and product profiles on the new path

Why this is recommended:
- matches the `unuidentity` model instead of layering compatibility onto an incorrect key
- keeps `unuvault` pre-launch and test-only assumptions intact
- removes the merge blocker without adding a migration strategy that the product will immediately need to unwind later

### Option 3: Defer `account_id` and keep product auth ids for now

- Keep `users_profile` keyed effectively by `auth_user_id`
- Delay account-level bootstrap until later

Trade-off:
- Avoids the immediate migration problem, but it undermines the whole point of this PR and leaves `unuvault` in an in-between auth model.

## Chosen Design

Use option 2 and treat this `unuvault -> unuidentity` bridge as a clean cutover.

### Architecture

- `unuidentity` remains the issuer of sessions and the source of truth for account identity.
- `unuvault` API accepts bearer tokens from `unuidentity`, validates them, and requires a real `account_id` before touching product data.
- `users_profile.account_id` remains the product-local foreign key for account ownership, but it must only ever store true `unuidentity.accounts.id` values.
- Existing pre-launch local rows are not automatically migrated from `auth_user_id` values. They are expected to be recreated through the new login/bootstrap path.

### Components

- API dependency layer in `apps/api/src/lib/supabase.ts` must fail closed when identity resolution does not produce `account_id`.
- Bootstrap service and vault sync continue using `account_id`, but now only after strict validation.
- Migration `0003_users_profile_account_id.sql` must stop writing `auth_user_id` into `account_id`.
- Tests and local docs must explicitly state that this is a clean cutover for test users.

### Data Flow

1. The web app authenticates through `unuidentity`.
2. The API validates the bearer token against `unuidentity`.
3. The API resolves the authenticated account context and reads a real `account_id`.
4. If `account_id` is missing, bootstrap and vault sync fail as unauthorized/incomplete identity context.
5. If `account_id` is present, the API upserts or reads `users_profile` by `account_id`.
6. Product-scoped vault data continues to hang off the local `users_profile.id`.

### Error Handling

- Missing `account_id` in the resolved identity user must be treated as an auth/bootstrap failure, not as a signal to fall back to `auth_user_id`.
- Local migrations must not fabricate `account_id` values from historical product auth ids.
- Local developer docs must say that old test users and product profiles should be recreated rather than silently rebound.

### Testing

- Add API dependency tests proving that identity users without `account_id` are rejected.
- Add service tests proving bootstrap and vault sync fail when `account_id` is absent.
- Update migration expectations so no test encodes `auth_user_id` as a valid fallback `account_id`.
- Re-run the existing JS suite after the cutover changes.

## Success Criteria

- `unuvault` no longer treats `auth.users.id` as a valid replacement for `account_id`.
- `users_profile.account_id` is only populated with true `unuidentity` account ids.
- Bootstrap and vault sync fail safely when the identity context is incomplete.
- The PR documents and enforces a clean cutover for pre-launch test users.

## Non-Goals

- Automatic migration of old local `users_profile` rows by email
- Long-lived dual-key compatibility between `auth_user_id` and `account_id`
- Redesigning the broader `unuidentity` token format in this slice
- Changing unrelated `unuvault` auth UX beyond what is needed for the cutover
