# Login Item Site Metadata Design

## Summary

The extension unlock and autofill-read path is now in place, but real site matching still has no reliable input. Today a login item payload only contains:

- `username`
- `password_ciphertext`
- `notes`

That is enough for vault display and decryption, but not enough for deciding whether a cached credential belongs to the current page. The next slice needs a stable site field that can travel end-to-end through the existing vault sync path and can be consumed by both web vault editing and extension readers.

This design adds a single `website_url` field to `VaultLoginPayload`, validates and normalizes it during web editing, preserves backward compatibility for old items, and exposes the normalized site metadata to extension background readers. This slice intentionally stops before implementing real site matching or DOM autofill.

## Scope

### In scope

- add `website_url: string` to `VaultLoginPayload`
- add shared payload normalization helpers so API, web, and extension stop maintaining separate shape parsing rules
- normalize missing or malformed `website_url` to `""`
- add a web vault `Website` field for create and edit flows
- validate website input in web UI before sync
- carry `website_url` through the existing `/vault/sync` contract unchanged
- extend extension local-cache validation so stored vault items may include `website_url`
- expose `websiteUrl`, `websiteHostname`, and `websiteOrigin` from the background unlocked vault reader
- add tests for payload normalization, old-item compatibility, web validation, sync persistence, and extension reader output

### Out of scope

- multiple websites per login item
- separate structured `site` objects in payloads
- true page-to-item matching
- DOM autofill
- retroactive migration that rewrites historical vault items
- advanced canonicalization such as public-suffix collapsing, path trimming, or redirect discovery

## Chosen Approach

The chosen approach is **one persisted `website_url` field plus shared normalization helpers**.

That means:

- the persisted payload gains exactly one new field
- old items remain valid because missing `website_url` normalizes to `""`
- web UI owns user-facing validation
- API keeps a fail-closed normalization guard
- extension derives `origin` and `hostname` at read time instead of persisting duplicated fields

This approach is preferred over a structured `site` object because the current MVP only needs a single human-entered source URL, not a mini metadata schema. It is preferred over an extension-only metadata layer because the correct long-term owner of the site association is the vault item itself, not a side cache.

## Architecture

### Shared payload helper

Create a shared helper module in `packages/api-client/src/login-payload.ts` that becomes the canonical owner of login payload normalization rules.

Responsibilities:

- normalize unknown payloads into a valid `VaultLoginPayload`
- normalize website input into either a valid URL string or `""`
- derive optional `origin` and `hostname` from a normalized `website_url`
- provide a single place for backward-compatible defaults

This helper should not know about encryption. Password sealing and opening should remain in the existing web/security helpers.

### API payload normalization

Update `apps/api/src/services/vault-service.ts` to reuse the shared payload helper instead of maintaining its own local payload parser.

Responsibilities:

- accept older rows without `website_url`
- guarantee sync responses always include `website_url`
- fail closed to empty strings when row payloads are malformed

The API should not reject a whole sync request only because a stored payload has a bad `website_url`. It should normalize defensively and keep the vault readable.

### Web vault editing

Update the web vault create and edit flows to let users save a website URL with each login item.

Responsibilities:

- add a `Website` field to create and edit forms
- validate user input before create or update
- normalize accepted input before it is written into the outgoing payload
- preserve old password and notes behavior
- continue to allow blank website values

The web UI should be the primary place that enforces “is this a valid site URL?” because that is where the user gets immediate feedback.

### Extension cache and unlocked reader

Update extension payload parsing to understand the new field, then surface site metadata from the unlocked vault reader.

Responsibilities:

- accept cached items with `website_url`
- keep old cached items valid when the field is missing
- expose normalized `websiteUrl`
- derive `websiteOrigin` and `websiteHostname` for the next autofill slice

This reader remains background-only. Content scripts still should not receive the full decrypted vault list in this slice.

## Data Model

`VaultLoginPayload` becomes:

```ts
export type VaultLoginPayload = {
  schema_version: 1;
  username: string;
  password_ciphertext: string;
  notes: string;
  website_url: string;
};
```

Key rules:

- `website_url` always exists after normalization
- blank means “no site metadata has been set”
- no new schema version is required for this additive field because all consumers are normalizing unknown input already

## URL Normalization Rules

The normalization rules should be explicit and conservative:

- blank or whitespace-only input becomes `""`
- inputs without a scheme get `https://` prepended before parsing
- parsing uses `new URL(...)`
- invalid inputs return `""` from the low-level normalizer, and web validation treats that as an error when the user actually typed something
- persisted values use `url.toString()`
- path, query, and hash are preserved for now
- future matching code should compare `origin`, not the full string

Examples:

- `github.com` -> `https://github.com/`
- `https://github.com/login` -> `https://github.com/login`
- `  example.com  ` -> `https://example.com/`
- `not a url` -> invalid for web form entry, normalized to `""` by fail-closed backend parsing

## Backward Compatibility

No migration runs in this slice.

Compatibility behavior:

- old items missing `website_url` normalize to `""`
- existing cached extension items remain readable
- existing API rows remain readable
- items gain `website_url` only when newly created or edited after this rollout

This keeps the release safe and avoids rewriting stored payloads before the model proves itself in real usage.

## Components

### `packages/api-client/src/vault.ts`

Add `website_url` to the shared type definition.

### `packages/api-client/src/login-payload.ts`

Add shared helpers such as:

- `normalizeVaultLoginPayload(payload: unknown): VaultLoginPayload`
- `normalizeVaultWebsiteUrl(value: unknown): string`
- `parseVaultWebsiteMetadata(websiteUrl: string): { websiteUrl: string; websiteOrigin: string; websiteHostname: string }`

The exact names may vary, but the module should own payload shape and URL parsing rules.

### `apps/web/src/components/vault/login-payload.ts`

Keep password-specific helpers here, but import shared payload normalization from `packages/api-client`.

### `apps/web/src/components/vault/use-vault-sync.ts`

Extend `VaultLoginFields` with `websiteUrl`, then write it into create and update payloads through the shared normalizer.

### `apps/web/src/components/vault/vault-panel.tsx`

Add `Website` inputs for create and edit, wire them into local state, and show a validation message like `Enter a valid website URL.` when needed.

### `apps/api/src/services/vault-service.ts`

Remove the local payload normalizer and delegate to the shared helper.

### `apps/browser-extension/src/popup/popup-vault-storage.ts`

Update storage validation so cached items with `website_url` are accepted, and older ones without it remain readable after normalization.

### `apps/browser-extension/src/popup/login-payload.ts`

Replace local shape parsing with the shared helper or a thin wrapper around it.

### `apps/browser-extension/src/background/unlocked-vault.ts`

Extend the background reader return shape to include:

```ts
type UnlockedVaultLoginItem = {
  id: string;
  title: string;
  username: string;
  password: string;
  hasPassword: boolean;
  websiteUrl: string;
  websiteOrigin: string;
  websiteHostname: string;
};
```

Blank site metadata should produce blank derived fields.

## Data Flow

### Create flow

1. user enters title, username, password, notes, and optional website
2. web validates the website input
3. accepted input is normalized into `website_url`
4. `createItem` sends the full payload through `/vault/sync`
5. API normalizes again before storing and before returning synced items

### Edit flow

1. web reads the existing normalized payload
2. edit form pre-fills the `Website` field from `website_url`
3. user edits and saves
4. updated payload travels through sync with the same compatibility rules

### Extension read flow

1. background hydrates cached vault items from sync
2. extension storage validates the item shape
3. unlocked vault reader normalizes the payload
4. reader derives `websiteOrigin` and `websiteHostname`
5. future autofill matching uses those fields without reparsing the raw payload everywhere

## Error Handling

### Web form validation

- if the user typed a non-empty invalid website, block save
- show `Enter a valid website URL.`
- do not clear other draft fields

### API/service normalization

- never throw only because `website_url` is malformed
- normalize malformed values to `""`
- keep item sync working

### Extension parsing

- malformed stored payloads still fail closed to default normalized values
- background unlocked reader should return blank site metadata rather than crash

## Testing

Add or update tests in these areas:

- `packages/api-client/tests/vault-client.spec.ts`
  - shared payload type/normalizer covers `website_url`
- `apps/api/tests/...`
  - old payload rows without `website_url` still map correctly
- `apps/web/tests/vault-page.spec.tsx`
  - create flow saves `website_url`
  - edit flow preserves and updates `website_url`
  - invalid website blocks save with the right message
  - blank website remains allowed
- `apps/browser-extension/tests/popup-vault-storage.spec.ts`
  - cached items with `website_url` are accepted
  - old cached items without it remain readable after normalization
- `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
  - unlocked reader returns `websiteUrl`, `websiteOrigin`, and `websiteHostname`
  - blank or malformed website data yields blank derived metadata

## Risks And Mitigations

### Duplicated parsing logic

Risk:
- adding `website_url` to three local normalizers would keep the current duplication and make future matching work harder

Mitigation:
- introduce one shared payload helper now

### Over-normalizing URLs too early

Risk:
- stripping paths or rewriting hostnames aggressively could destroy user intent before matching rules are settled

Mitigation:
- store normalized `toString()` output and derive `origin` later

### Breaking old cache entries

Risk:
- strict extension validation could reject pre-existing cached items

Mitigation:
- normalize missing `website_url` to `""` instead of requiring it at raw-parse time

## Success Criteria

This slice is successful when:

- a newly created or edited web login item can save an optional `website_url`
- synced items returned from API include the field
- old items with no site metadata still load everywhere
- extension background readers can expose normalized site metadata for unlocked login items
- no real site matching or DOM autofill behavior is introduced yet
