# Developer Secrets Provider Verify Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only provider command that verifies a developer-secret master password without releasing dotenv plaintext.

**Architecture:** Extend the existing provider command parser with a single-target `verify` command. Extract the existing fetch, prompt, decrypt, and dotenv-validation flow into one internal helper used by both `read` and `verify`; `read` keeps returning plaintext, while `verify` returns only a safe receipt.

**Tech Stack:** TypeScript, Vitest, pnpm, existing UnuVault developer-secret API client and password-derived envelope functions.

---

## File Map

- Modify `tests/dev-secrets-provider.spec.ts` to define the safe success and failure contracts before implementation.
- Modify `scripts/secrets/provider.ts` to parse and execute `verify` while preserving `read` and `import` behavior.
- Modify `README.md` to publish the new human entrypoint and its plaintext-free behavior.

### Task 1: Add the Verify Command with TDD

**Files:**
- Modify: `tests/dev-secrets-provider.spec.ts`
- Modify: `scripts/secrets/provider.ts`

- [ ] **Step 1: Write the failing success-path test**

Add this test inside the existing `describe("runDevSecretsProvider")` block in
`tests/dev-secrets-provider.spec.ts`:

```ts
it("verifies a stored dotenv record without releasing plaintext", async () => {
  const { io, readStdout, readStderr } = createCapturedIo();
  const plaintext = "SUPABASE_URL=https://example.supabase.co\n";
  const ciphertext = await sealDeveloperSecretBlob(
    plaintext,
    "correct horse",
  );
  const readRecord = vi.fn().mockResolvedValue({ ciphertext });
  const writeRecord = vi.fn().mockResolvedValue({ ok: true as const });

  const exitCode = await runDevSecretsProvider(
    ["verify", "--app", "unundo", "--env", "local"],
    {
      io,
      deps: {
        getCliSessionToken: async () => "cli-session-token",
        promptSecret: async () => "correct horse",
        readRecord,
        writeRecord,
        readTextFile: async () => "",
        confirm: async () => true,
      },
    },
  );

  expect(exitCode).toBe(0);
  expect(readRecord).toHaveBeenCalledWith("cli-session-token", {
    app: "unundo",
    env: "local",
  });
  expect(writeRecord).not.toHaveBeenCalled();
  expect(readStdout()).toBe("VERIFY_OK unundo/local/dotenv\n");
  expect(readStdout()).not.toContain(plaintext);
  expect(readStderr()).toBe("");
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
corepack pnpm exec vitest run tests/dev-secrets-provider.spec.ts
```

Expected: the new test fails because `verify` is rejected as
`invalid_command`.

- [ ] **Step 3: Write the failing wrong-password test**

Add this second test:

```ts
it("keeps stdout empty when verify cannot decrypt", async () => {
  const { io, readStdout, readStderr } = createCapturedIo();
  const plaintext = "SUPABASE_URL=https://example.supabase.co\n";
  const ciphertext = await sealDeveloperSecretBlob(
    plaintext,
    "correct horse",
  );
  const writeRecord = vi.fn().mockResolvedValue({ ok: true as const });

  const exitCode = await runDevSecretsProvider(
    ["verify", "--app", "unundo", "--env", "local"],
    {
      io,
      deps: {
        getCliSessionToken: async () => "cli-session-token",
        promptSecret: async () => "wrong horse",
        readRecord: async () => ({ ciphertext }),
        writeRecord,
        readTextFile: async () => "",
        confirm: async () => true,
      },
    },
  );

  expect(exitCode).toBe(1);
  expect(writeRecord).not.toHaveBeenCalled();
  expect(readStdout()).toBe("");
  expect(readStderr()).toContain("decrypt_failed");
  expect(readStderr()).not.toContain(plaintext);
});
```

- [ ] **Step 4: Run the focused test and confirm the failure contract is RED**

Run:

```bash
corepack pnpm exec vitest run tests/dev-secrets-provider.spec.ts
```

Expected: both new tests fail with `invalid_command`; the failure-path test
still confirms stdout contains no dotenv plaintext.

- [ ] **Step 5: Extend the command type, usage text, and parser**

Add `verify` as its own command variant:

```ts
type ProviderCommand =
  | {
      kind: "read";
      target: ProviderTarget;
    }
  | {
      kind: "verify";
      target: ProviderTarget;
    }
  | {
      kind: "import";
      target: ProviderTarget;
      from: string;
    };
```

Add this usage line immediately after the `read` examples:

```ts
"  bash scripts/secrets/provider.sh verify --app unundo --env local",
```

Accept the new command and return a target-only command for both read-only
operations:

```ts
if (kind !== "read" && kind !== "verify" && kind !== "import") {
  throw createProviderError("invalid_command");
}
```

Keep the existing flag parsing and target validation unchanged. Replace the
current `read` return branch with:

```ts
if (kind === "read" || kind === "verify") {
  return {
    kind,
    target,
  };
}
```

- [ ] **Step 6: Extract the shared decrypt-and-validate helper**

Add this helper before `runReadCommand`:

```ts
async function readDecryptedDotenv(
  target: ProviderTarget,
  deps: ProviderDeps,
) {
  const cliSessionToken = await deps.getCliSessionToken(target);
  const record = await deps.readRecord(cliSessionToken, target);
  const masterPassword = await deps.promptSecret("Master password: ");
  let plaintext = "";

  try {
    plaintext = await openDeveloperSecretBlob(
      record.ciphertext,
      masterPassword,
    );
  } catch {
    throw createProviderError("decrypt_failed");
  }

  if (!plaintext) {
    throw createProviderError("decrypt_failed");
  }

  validateConservativeDotenv(plaintext);
  return plaintext;
}
```

Replace the body of `runReadCommand` with:

```ts
const plaintext = await readDecryptedDotenv(command.target, deps);
io.writeStdout(plaintext);
```

- [ ] **Step 7: Implement the minimal verify execution path**

Add:

```ts
async function runVerifyCommand(
  command: Extract<ProviderCommand, { kind: "verify" }>,
  io: ProviderIo,
  deps: ProviderDeps,
) {
  await readDecryptedDotenv(command.target, deps);
  io.writeStdout(
    `VERIFY_OK ${command.target.app}/${command.target.env}/dotenv\n`,
  );
}
```

Dispatch it in `runDevSecretsProvider` before `import`:

```ts
if (command.kind === "verify") {
  await runVerifyCommand(command, io, deps);
  return 0;
}
```

- [ ] **Step 8: Run the focused provider suite and confirm GREEN**

Run:

```bash
corepack pnpm exec vitest run tests/dev-secrets-provider.spec.ts
```

Expected: all tests in `tests/dev-secrets-provider.spec.ts` pass, including
the new safe success and wrong-password cases.

- [ ] **Step 9: Commit the tested provider behavior**

```bash
git add scripts/secrets/provider.ts tests/dev-secrets-provider.spec.ts
git commit -m "feat: add safe developer secret verification"
```

### Task 2: Publish and Verify the Human Entrypoint

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the command beside read and import**

Add this entry to the private env-secrets bridge section:

```markdown
- verify a stored record without releasing dotenv plaintext:
  `bash scripts/secrets/provider.sh verify --app <app> --env <local|staging|production>`
```

Add this behavior statement beside the existing `read` and `import` notes:

```markdown
- `verify` prints only `VERIFY_OK <app>/<env>/dotenv` after successful decrypt
  and dotenv validation; it never prints the dotenv payload
```

- [ ] **Step 2: Run formatting and focused regression checks**

Run:

```bash
git diff --check
corepack pnpm exec vitest run tests/dev-secrets-provider.spec.ts
corepack pnpm exec vitest run tests/workspace-entrypoints.spec.ts
```

Expected: `git diff --check` is silent and both Vitest commands exit `0`.

- [ ] **Step 3: Run the repository TypeScript/lint gate**

Run:

```bash
corepack pnpm lint
```

Expected: the repo-owned lint runner exits `0`.

- [ ] **Step 4: Commit the documentation**

```bash
git add README.md
git commit -m "docs: document developer secret verification"
```

- [ ] **Step 5: Report the manual command without executing secret input**

Give the user this exact command:

```bash
cd /Users/yuchen/Code/unu/unuvault
bash scripts/secrets/provider.sh verify --app unundo --env local
```

The user enters the master password only in their own terminal. A successful
run must print `VERIFY_OK unundo/local/dotenv`; no password or dotenv value is
copied into chat.
