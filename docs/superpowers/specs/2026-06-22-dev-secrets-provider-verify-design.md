# Developer Secrets Provider Verify Command Design

## Problem

The developer-secrets provider can currently import encrypted dotenv records
and read plaintext records, but it has no safe command for checking whether a
master password can unlock a stored record. Using `read` for this purpose
unnecessarily releases the full dotenv payload to stdout, while redirecting
stdout also conflicts with the interactive browser handoff's TTY requirement.

## Goal

Add a read-only `verify` command that proves one supported developer-secret
record can be fetched, decrypted, and validated as conservative dotenv without
printing or writing any plaintext.

Example from the repository root:

```bash
bash scripts/secrets/provider.sh verify --app unundo --env local
```

Successful output:

```text
VERIFY_OK unundo/local/dotenv
```

## Scope

The first version verifies exactly one existing provider target selected by
`--app` and `--env`. It supports the same namespaces and interactive browser
handoff as `read` and `import`.

The command will:

1. validate the requested target;
2. obtain the normal short-lived CLI session;
3. fetch the stored ciphertext through the existing provider API;
4. prompt for the master password;
5. decrypt the ciphertext in memory;
6. validate the plaintext with the existing conservative dotenv rules;
7. discard the plaintext and print only the safe success receipt.

## Safety Contract

- `verify` is read-only and never calls `writeRecord`.
- Plaintext is never written to stdout, stderr, disk, logs, or error messages.
- Successful verification prints only
  `VERIFY_OK <app>/<env>/dotenv` to stdout and exits with code `0`.
- A wrong password, empty decrypted result, or malformed ciphertext returns
  `decrypt_failed` on stderr, keeps stdout empty, and exits with code `1`.
- A decrypted payload that is not valid conservative dotenv returns
  `invalid_dotenv_payload`, keeps stdout empty, and exits with code `1`.
- Existing `read` and `import` behavior remains unchanged.

## Alternatives Rejected

### Redirect `read` output

Running `read` with stdout redirected still transports plaintext through the
process and breaks the current interactive TTY requirement used by browser
handoff. It does not provide the desired safety contract.

### Direct database helper

A helper using the Supabase service-role key would bypass the normal
developer-secret session and provider API boundary. That is too privileged for
a routine verification command.

## Implementation Shape

Extend the provider command union and parser in
`scripts/secrets/provider.ts` with `verify`. Reuse the same record read,
decryption, and dotenv validation path as `read`, but replace plaintext output
with the safe verification receipt.

Update these contributor surfaces:

- `DEV_SECRETS_PROVIDER_USAGE` in `scripts/secrets/provider.ts`;
- the private env-secrets bridge section in `README.md`;
- focused provider tests in `tests/dev-secrets-provider.spec.ts`.

No API, database schema, encryption-envelope, UI, or cross-repo contract change
is required.

## Verification

Focused tests must prove:

1. a correct password returns the exact safe receipt and never outputs the
   dotenv payload;
2. a wrong password returns `decrypt_failed`, leaves stdout empty, and never
   outputs the dotenv payload;
3. `verify` does not call `writeRecord`;
4. the existing provider test suite remains green.

The final manual invocation must be run from the repository root, or by using
the absolute path to `scripts/secrets/provider.sh`.
