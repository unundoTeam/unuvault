# React/CSS Adapter Evidence

This document records the repo-local React/CSS evidence for the `unuvault` Web
vault surface. It supports the shared `unundo-interface` primitive evidence
backlog, but it does not claim broad shared primitive adoption by itself.

## Current Status

- Adapter lane: React/CSS web adapter
- Repo: `unuvault`
- Surface: Web vault management
- Status: browser visual proof recorded; Pencil current needs promotion/backwrite
  before this lane can be called `adapter-mapped`
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
- Browser visual evidence:
  `docs/design/evidence/2026-05-23-react-css-visual-parity/web-vault-browser.png`
- Pencil source export:
  `docs/design/evidence/2026-05-23-react-css-visual-parity/pencil-current-web-vault.png`

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
| Visual workspace | Web vault page shell | `.vault-page`, `.vault-shell`, `.vault-header`, `.vault-workspace`, `.vault-panel`, `.vault-card`, `.vault-items-list`, and `.vault-item-row` map the approved Pencil workspace into durable React/CSS selectors |

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
- browser visual evidence records the authenticated vault surface with the
  header, master-password panel, save-login card, item panel, search control,
  review-state banner, item rows, disabled password actions, and destructive
  delete affordance

## Visual Evidence

| Evidence | Path | Notes |
| --- | --- | --- |
| Pencil current export | `docs/design/evidence/2026-05-23-react-css-visual-parity/pencil-current-web-vault.png` | Export of `current/unuvault/web-vault-management-v1` from `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`. |
| Browser DOM capture | `docs/design/evidence/2026-05-23-react-css-visual-parity/web-vault-browser-dom.html` | Captured from a real authenticated local Next.js `/vault` DOM after seeding a local Supabase session and mock `POST /vault/sync` response. |
| Browser visual capture | `docs/design/evidence/2026-05-23-react-css-visual-parity/web-vault-browser.png` | Rendered from the captured authenticated browser DOM with the repo CSS at a `1440x920` viewport. |

Capture route used for this evidence:

1. Run the Web app with `pnpm --filter @unuvault/web dev`.
2. Run a local proxy/mock on `127.0.0.1:3000` that seeds
   `sb-127-auth-token`, proxies the Next.js Web app from `127.0.0.1:3001`,
   and returns two vault rows from `POST /vault/sync`.
3. Open `http://127.0.0.1:3000/seed-session`, which redirects to
   `http://127.0.0.1:3000/vault`.
4. Confirm the live DOM contains `Vault items`, `Search vault`, and
   `github.com`, then render the captured DOM for the screenshot artifact.

## Remaining Gap

This evidence does not yet move the shared React/CSS adapter to
`adapter-mapped`. The browser capture now exists, but it shows the implemented
surface is more complete than the current Pencil screen frame: the shipped Web
form includes `Website`, `Password`, and `Notes` fields, while the current frame
still shows the smaller save-login example. The source frame therefore needs a
Pencil draft backwrite and user approval before promotion into current.

Current Pencil sync label for this lane:
`draft backwrite pending approval`.

Intentionally local values that must not be promoted into the shared library:

- `unuvault` credential and master-password copy
- product-specific vault, sync, and local credential bridge workflow text
- `unuvault` palette, typography values, and product security posture
- current Web implementation details that are not reusable primitive semantics
