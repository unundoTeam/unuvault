# React/CSS Adapter Evidence

This document records the repo-local React/CSS evidence for the `unuvault` Web
vault surface. It supports the shared `unundo-interface` primitive evidence
backlog, but it does not claim broad shared primitive adoption by itself.

## Current Status

- Adapter lane: React/CSS web adapter
- Repo: `unuvault`
- Surface: Web vault management
- Status: partial repo proof; visual parity browser capture still pending
- Pencil current:
  `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`
- Pencil source frame: `current/unuvault/web-vault-management-v1`
- Design-system frame: `current/unuvault/design-system-v1`

## Adapter Implementation Paths

- Web page: `apps/web/src/app/vault/page.tsx`
- Web component: `apps/web/src/components/vault/vault-panel.tsx`
- Shared foundation variables: `apps/web/src/app/globals.css`
- Semantic adapter evidence test:
  `apps/web/tests/react-css-adapter-evidence.spec.tsx`
- Foundation variable test:
  `apps/web/tests/design-foundation-contract.spec.ts`

## Primitive Mapping

| Shared primitive area | Repo-local surface | Implementation evidence |
| --- | --- | --- |
| Surface / panel | Vault management section | `section[aria-labelledby="vault-heading"][data-unu-primitive="vault-surface"]` |
| Form / input | Unlock and save-item forms | Accessible named forms, visible labels, password/text inputs, and disabled password input while locked |
| Button | Unlock, save, copy, show, edit, delete, lock | Real `<button>` elements with accessible names and disabled states where required |
| Row / list | Vault item list and item rows | Real `<ul>` / `<li>` structure with `data-unu-primitive="row/vault-item"` |
| State | Sync, validation, error, empty | `role="status"` for sync state, `role="alert"` for validation/error state, visible empty copy |
| Review / approval boundary | Copy/show/delete actions | Credential-revealing and destructive actions stay explicit and disabled when unavailable |
| Foundation variables | Web CSS token layer | `globals.css` exposes shared spacing, radius, shadow, and motion variables |

## Verification

Run:

```bash
pnpm --filter @unuvault/web exec vitest --run tests/react-css-adapter-evidence.spec.tsx tests/design-foundation-contract.spec.ts
```

Current proof from this lane:

- semantic HTML surfaces are real controls, not `div`-only controls
- accessible form, input, and button names are queryable by role or label
- locked password actions are disabled until the vault is unlocked
- sync and validation states use semantic live-region roles
- shared foundation variables exist in the Web CSS layer

## Remaining Gap

This evidence does not yet move the shared React/CSS adapter to
`adapter-mapped`. The missing proof is a real browser screenshot or capture of
the Web vault surface compared with the routed Pencil source frame and the
relevant `unundo-interface` category files.

Intentionally local values that must not be promoted into the shared library:

- `unuvault` credential and master-password copy
- product-specific vault, sync, and local credential bridge workflow text
- `unuvault` palette, typography values, and product security posture
- current Web implementation details that are not reusable primitive semantics
