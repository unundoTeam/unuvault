# Web Vault Encryption Boundary Design

## Summary

This slice turns the current Web vault password handling from an honest-but-plain placeholder into a real local encryption boundary.

Today `unuvault` already supports:

- creating, editing, deleting, revealing, and copying login passwords in the Web vault
- syncing login items through `vault/sync`
- storing password material in `encrypted_payload.password_ciphertext`

But the password is still flowing through Web helpers as a raw string. That means the product shape now looks useful, while the client-side trust boundary still lags behind the intended architecture in [0003-client-crypto-boundary.md](/Users/yuchen/Desktop/blackbox/.worktrees/web-vault-encryption-boundary/docs/architecture/0003-client-crypto-boundary.md).

The goal of this slice is to make the boundary real without pulling in the full unlock model yet:

- Web should stop storing raw password strings directly in the payload
- Web should wrap passwords into a serialized vault envelope before sync
- reveal and copy should decrypt locally through a single helper boundary
- sync, API, and database contracts should stay unchanged for now

This slice is intentionally **not** the final security model. It is the minimum step that makes the client-owned encryption boundary real enough to support later master-password and unlock work.

## Scope

### In scope

- add a browser-safe password sealing/opening helper in `packages/security`
- store a serialized encrypted envelope string in `password_ciphertext`
- route Web create/edit/reveal/copy flows through the new helper boundary
- keep the transport field name `password_ciphertext` unchanged
- make the server continue to treat the field as opaque data
- add tests for envelope read/write behavior and Web integration

### Out of scope

- full master-password setup flow
- unlock screen or session unlock UX
- Argon2-based user key derivation
- device unlock persistence
- browser extension changes
- iOS changes
- re-encrypting old remote data at scale
- changing the database schema or sync route shape

## Chosen Approach

The chosen approach is to introduce a **development-stage local envelope boundary** that is real in code structure, but still limited in operational scope.

That means:

- passwords stop flowing through Web helpers as raw stored values
- `password_ciphertext` becomes a serialized envelope string
- Web uses a thin security helper to seal and open that envelope
- the API and database continue to store and return the field without understanding it

This is preferred over jumping straight to a full master-password unlock model because:

- it fixes the most immediate architectural mismatch first
- it keeps the current Web CRUD and sync product momentum intact
- it gives the future unlock work a real swap point instead of requiring a second UI rewrite

This is also preferred over inventing a fake format marker like `ENCRYPTED::<value>` because the point of the slice is to make the boundary honest, not just rename the plaintext.

## Security Posture For This Slice

This slice should be described as a **real client-owned envelope boundary with development-time key management**.

Concretely:

- the password should be wrapped locally before it enters sync payloads
- the server should still only see opaque envelope data
- the current Web surface may use a development-scoped key source so the UX can keep working without a full unlock system

The honest limitation is:

- the secrecy of the system is not final until primary-password key derivation and unlock UX land

But the important architectural improvement is:

- password handling becomes explicitly “seal locally / open locally” instead of “read raw string everywhere”

## Data Contract

The shared login payload shape stays:

```ts
type VaultLoginPayload = {
  schema_version: 1;
  username: string;
  password_ciphertext: string;
  notes: string;
};
```

What changes is the meaning of `password_ciphertext`:

- before: raw password string in practice
- after: serialized envelope string produced by the client

The envelope should align with the existing `VaultEnvelope` contract in `packages/security/src/vault-envelope.ts`.

The Web surface should treat the field as opaque storage and only interact through helpers such as:

```ts
sealVaultPassword(password: string): string
openVaultPassword(ciphertext: string): string
```

Those helpers can evolve later to accept derived keys and richer metadata without forcing the Web vault components to rewrite their UI behavior.

## Architecture

### Security package

`packages/security` should become the only place that knows how to:

- turn a plaintext password into an envelope string
- turn an envelope string back into plaintext
- validate that an envelope version is supported

This keeps crypto boundary code out of React components.

### Web payload helpers

`apps/web/src/components/vault/login-payload.ts` should stop exposing “draft string storage” semantics and instead expose:

- write sealed password into payload
- read opened password from payload
- derive row labels like `No password saved` or masked/revealed text from the opened value

This file remains the UI-facing boundary.

### Web panel and sync hook

`vault-panel.tsx` and `use-vault-sync.ts` should continue to own form state and sync orchestration, but they should no longer directly treat `password_ciphertext` as a raw stored password.

They should only:

- accept user-entered plaintext in local component state
- call the payload helper boundary when creating/updating items
- call the payload helper boundary when rendering revealed/copyable values

### Server

The server remains unchanged in responsibility:

- store opaque envelope data
- return opaque envelope data
- do not interpret plaintext password contents

## Data Flow

### Create flow

1. user enters a plaintext password into the Web create form
2. panel passes that plaintext into the create action
3. payload helper seals the password through the security helper
4. sync sends the sealed envelope string in `password_ciphertext`
5. server stores it as opaque JSON payload data

### Edit flow

1. Web receives an item with `password_ciphertext`
2. payload helper opens the stored envelope for the edit form
3. user edits plaintext locally
4. save path reseals the updated password before sync

### Reveal and copy flow

1. row reads the stored envelope string from `password_ciphertext`
2. payload helper opens it locally
3. reveal shows the plaintext only in local UI state
4. copy writes the opened plaintext to the clipboard
5. no sync change is sent

## Error Handling

This slice should stay small but explicit:

- unsupported or invalid envelope data should behave like “no usable password available”
- create/edit should not crash the page if envelope parsing fails
- reveal/copy should fail closed rather than exposing broken raw storage values
- sync should continue to work because the field remains just a string to the server

If an envelope cannot be opened locally:

- `Show password` should not display garbage
- `Copy password` should not copy raw envelope text
- the row can fall back to a neutral unavailable message

## Testing Strategy

Tests should cover two layers.

### `packages/security`

- sealing a plaintext password returns a non-empty envelope string
- opening a freshly sealed password returns the original plaintext
- unsupported envelope versions fail safely

### Web

- create stores a sealed string rather than the raw password
- edit opens the stored value for form use and reseals on save
- reveal shows the locally opened password
- copy password copies the locally opened password
- empty password behavior stays unchanged

No API tests are required because the server contract remains opaque-string transport.

## Success Criteria

This slice is complete when:

- Web no longer stores raw password values directly in `password_ciphertext`
- Web create/edit/reveal/copy flows all pass through a single local seal/open boundary
- `packages/security` owns the browser-side envelope logic
- API and sync behavior remain unchanged from the server’s perspective
- Web behavior stays product-consistent
- repo-wide verification remains green
