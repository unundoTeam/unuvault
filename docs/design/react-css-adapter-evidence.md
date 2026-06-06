# React/CSS Adapter Evidence

This document records the repo-local React/CSS evidence for the `unuvault` Web
vault surface. It supports the shared `unundo-interface` primitive evidence
backlog, but it does not claim broad shared primitive adoption by itself.

## Current Status

- Adapter lane: React/CSS web adapter
- Repo: `unuvault`
- Surface: Web vault management
- Status: React/CSS semantic proof, keyboard tab order, and focus-visible proof
  recorded for this Web vault React/CSS surface; Pencil current and browser
  visual proof now reflect the Mac companion status layer
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
  `docs/design/evidence/2026-06-06-mac-companion-status/web-vault-browser.png`
- Pencil source export:
  `docs/design/evidence/2026-06-06-mac-companion-status/4qsK6.png`

## Primitive Mapping

| Shared primitive area | Repo-local surface | Implementation evidence |
| --- | --- | --- |
| Surface / panel | Vault management section | `section[aria-labelledby="vault-heading"][data-unu-primitive="vault-surface"]` |
| Form / input | Unlock and save-item forms | Accessible named forms, visible labels, password/text inputs, and disabled password input while locked |
| Button | Unlock, save, Mac import, copy, show, edit, delete, lock | Real `<button>` elements with accessible names and disabled states where required |
| Row / list | Vault item list and item rows | Real `<ul>` / `<li>` structure with `data-unu-primitive="row/vault-item"` |
| State | Sync, Mac companion availability/lock, validation, error, empty | `role="status"` for sync and Mac companion state, `role="alert"` for validation/error state, visible empty copy |
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
- Mac companion availability and locked/unlocked states gate the Web-to-Mac
  import button before plaintext import can be attempted
- natural keyboard order covers the enabled form, search, and row-action
  controls while disabled password actions stay out of the enabled path
- `.vault-input:focus-visible`, `.vault-button:focus-visible`, and
  `.vault-action-danger:focus-visible` provide visible focus rings for the
  mapped React/CSS controls
- sync and validation states use semantic live-region roles
- Mac companion status uses a semantic live-region role and neutral/secure
  state styling instead of danger styling for non-destructive unavailable states
- shared foundation variables exist in the Web CSS layer
- latest browser visual evidence records the authenticated unlocked vault
  surface with the Mac companion unlocked pill, explicit Save to this Mac
  action, item rows, selected-item detail panel, secure feedback, and
  destructive delete boundary at a `1440x920` viewport
- latest Pencil current export records the Mac companion status pill, neutral
  unavailable/locked boundary copy, and explicit disabled-until-ready import
  rule in `current/unuvault/web-vault-management-state-model-v2`

## Visual Evidence

| Evidence | Path | Notes |
| --- | --- | --- |
| Pencil state-model current export | `docs/design/evidence/2026-06-06-mac-companion-status/4qsK6.png` | Export of `current/unuvault/web-vault-management-state-model-v2` from `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen` after Mac companion status-layer sync. |
| Pencil legacy implementation export | `docs/design/evidence/2026-06-06-mac-companion-status/BnvkE.png` | Export of retained `current/unuvault/web-vault-management-v1` after Mac companion status-layer sync. |
| Browser DOM capture | `docs/design/evidence/2026-06-06-mac-companion-status/web-vault-browser-dom.html` | Captured from a real local Next.js `/vault` browser render after seeding a Supabase SSR cookie, intercepting `POST /vault/sync`, and returning local Mac companion `unlocked` status. |
| Browser visual capture | `docs/design/evidence/2026-06-06-mac-companion-status/web-vault-browser.png` | Rendered from the authenticated unlocked browser state with the repo CSS at a `1440x920` viewport. |
| Previous Pencil current export | `docs/design/evidence/2026-05-23-react-css-visual-parity/pencil-current-web-vault.png` | Earlier export retained as historical visual-parity evidence before the Mac companion status layer. |
| Previous browser visual capture | `docs/design/evidence/2026-05-23-react-css-visual-parity/web-vault-browser.png` | Historical authenticated browser capture before the Mac companion status layer. |

Capture route used for this evidence:

1. Run the Web app with `pnpm --filter @unuvault/web dev`.
2. Use headless Chrome through Playwright with a Supabase SSR auth cookie for
   `http://localhost:3001`.
3. Intercept `POST /vault/sync` with two deterministic vault rows and intercept
   `http://127.0.0.1:17666/status` with `{ ok: true, state: "unlocked" }`.
4. Open `http://localhost:3001/vault`, set a master password to enter the
   unlocked state, confirm `Vault unlocked` and `Mac companion unlocked`, then
   capture the DOM and PNG artifacts.

## Claim Boundary

This evidence is enough to record the `unuvault` Web vault React/CSS lane as
`adapter-mapped` for the represented surface, controls, and states. It does not
make a repo-wide `adopted` claim, and it does not prove React/CSS categories
that the Web vault surface does not expose, such as navigation, dialogs, or
toast-style notifications.

Current Pencil sync label for this lane:
`current matches implementation`.

Intentionally local values that must not be promoted into the shared library:

- `unuvault` credential and master-password copy
- product-specific vault, sync, and local credential bridge workflow text
- `unuvault` palette, typography values, and product security posture
- current Web implementation details that are not reusable primitive semantics
