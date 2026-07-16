# React/CSS Adapter Evidence

This document records partial repo-local React/CSS implementation evidence for
the `unuvault` Web vault surface. It supports the shared `unundo-interface`
primitive evidence backlog, but it does not establish current shared primitive
adoption or visual parity by itself.

## Current Status

- Adapter lane: React/CSS web adapter
- Repo: `unuvault`
- Surface: Web vault management
- Current status: `blocked-needs-evidence`
- Evidence boundary: repo code and tests record partial semantic, keyboard, and
  focus-visible implementation evidence. This lane lacks fresh real-browser
  visual and accessibility proof, so it cannot claim `adapter-mapped`,
  `adopted`, or current parity.
- Pencil boundary: Web frames, draft assets, and dated Pencil exports are
  historical provenance only. They are not current Web adapter, adoption, or
  parity authority. Native current frames do not support this Web lane.

## Adapter Implementation Paths

- Web page: `apps/web/src/app/vault/page.tsx`
- Web component: `apps/web/src/components/vault/vault-panel.tsx`
- Shared foundation variables: `apps/web/src/app/globals.css`
- Semantic adapter evidence test:
  `apps/web/tests/react-css-adapter-evidence.spec.tsx`
- Foundation variable test:
  `apps/web/tests/design-foundation-contract.spec.ts`
- Historical browser visual evidence:
  `docs/design/evidence/2026-06-06-mac-companion-status/web-vault-browser.png`
- Historical Pencil export:
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
| Visual workspace | Web vault page shell | `.vault-page`, `.vault-shell`, `.vault-header`, `.vault-workspace`, `.vault-panel`, `.vault-card`, `.vault-items-list`, and `.vault-item-row` are durable repo-local React/CSS selectors; any former Pencil mapping is historical provenance only |

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
- the historical `2026-06-06` browser capture records the authenticated unlocked vault
  surface with the Mac companion unlocked pill, explicit Save to this Mac
  action, item rows, selected-item detail panel, secure feedback, and
  destructive delete boundary at a `1440x920` viewport
- the historical `2026-06-06` Pencil export records the Mac companion status pill, neutral
  unavailable/locked boundary copy, and explicit disabled-until-ready import
  rule in `current/unuvault/web-vault-management-state-model-v2`

## Visual Evidence

| Evidence | Path | Notes |
| --- | --- | --- |
| Historical Pencil state-model export | `docs/design/evidence/2026-06-06-mac-companion-status/4qsK6.png` | Historical export of `current/unuvault/web-vault-management-state-model-v2`; it is not current Web authority. |
| Historical Pencil implementation export | `docs/design/evidence/2026-06-06-mac-companion-status/BnvkE.png` | Historical export of retained `current/unuvault/web-vault-management-v1`; it is not current Web authority. |
| Historical browser DOM capture | `docs/design/evidence/2026-06-06-mac-companion-status/web-vault-browser-dom.html` | Dated capture from a local Next.js `/vault` render after seeding a Supabase SSR cookie, intercepting `POST /vault/sync`, and returning local Mac companion `unlocked` status. |
| Historical browser visual capture | `docs/design/evidence/2026-06-06-mac-companion-status/web-vault-browser.png` | Dated authenticated browser capture with the repo CSS at a `1440x920` viewport; it is not fresh acceptance evidence. |
| Previous Pencil current export | `docs/design/evidence/2026-05-23-react-css-visual-parity/pencil-current-web-vault.png` | Earlier export retained as historical visual-parity evidence before the Mac companion status layer. |
| Previous browser visual capture | `docs/design/evidence/2026-05-23-react-css-visual-parity/web-vault-browser.png` | Historical authenticated browser capture before the Mac companion status layer. |

Historical capture route used for the `2026-06-06` evidence:

1. Run the Web app with `pnpm --filter @unuvault/web dev`.
2. Use headless Chrome through Playwright with a Supabase SSR auth cookie for
   `http://localhost:3001`.
3. Intercept `POST /vault/sync` with two deterministic vault rows and intercept
   `http://127.0.0.1:17666/status` with `{ ok: true, state: "unlocked" }`.
4. Open `http://localhost:3001/vault`, set a master password to enter the
   unlocked state, confirm `Vault unlocked` and `Mac companion unlocked`, then
   capture the DOM and PNG artifacts.

## Claim Boundary

The current `unuvault` Web vault React/CSS lane is
`blocked-needs-evidence`. Repo code and tests are partial implementation
evidence; the dated browser and Pencil captures are historical provenance only.
Fresh real-browser visual and accessibility proof, plus applicable user
confirmation, is required before this lane can claim `adapter-mapped`,
`adopted`, or current parity. Active Native Pencil current frames remain Native
authority only and do not establish any Web adapter status.

Intentionally local values that must not be promoted into the shared library:

- `unuvault` credential and master-password copy
- product-specific vault, sync, and local credential bridge workflow text
- `unuvault` palette, typography values, and product security posture
- current Web implementation details that are not reusable primitive semantics
