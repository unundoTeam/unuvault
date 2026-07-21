# Agent Notes (UnuVault)

## Frontend Design Rule

- Any task that changes UI structure, visual hierarchy, interaction patterns, responsive behavior, or accessibility must invoke `$ui-ux-pro-max` before implementation.
- Use `brainstorming` to scope the feature or flow first, then use `$ui-ux-pro-max` for the actual UI/UX design and review decisions.

## Design Authority

- Start design work from `/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-operating-index.md`; it is the only first-read design authority.
- Current design status: `registered`.
- Native Pencil current: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`.
- Native design-system frame: `current/unuvault/design-system-v1`.
- Active macOS source frame: `current/unuvault/mac-companion-core-flows-v1.3`.
- Active iOS source frames:
  `current/unuvault/ios-vault-home-native-locked-v1` and
  `current/unuvault/ios-vault-list-readonly-v1`.
- Pairing V2 protocol/security authority:
  `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`
  is `current-routed` for Pairing V2 protocol/security semantics only.
  Pairing V2 is protocol/security-only.
  Pairing V2 implementation and exact-target security re-review remain pending.
  It is not broad Pencil/current-UI authority.
- For Native work, confirm direction/spec in brainstorming Visual Companion, directly update the relevant frame in `unuvault.current.pen`, show and correct the actual Pencil result, then verify the real app/simulator/device; direction approval is not visual acceptance.
- Web and browser-extension surfaces use no product Pencil. Follow `/Users/yuchen/Code/unu/unuOS/docs/portfolio/web-design-foundation.md`, repo-local overrides/components, code under `apps/web/` or `apps/browser-extension/`, and the shown real browser result; important results require user confirmation.
- Web frames inside `unuvault.current.pen`, including `current/unuvault/web-vault-management-v1`, are historical/reference-only, not Web implementation or parity sources.
- `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen` as a whole is inactive historical/reference-only. Do not promote from or backwrite to product drafts.
- Small UI copy or polish uses the `Lightweight UI Path` in the portfolio Pencil gate for Native or `Fast Path Escalation` in `web-design-foundation.md` for Web.
- Historical design specs are planning context only unless the operating index or this repo-local entrypoint explicitly routes to them.
- The legacy product-scope spec is routed only through `/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-specs-inventory.md` as `current-routed` product scope and trust posture context; it is not broad Pencil or current UI authority.
- Keep Native and Web closeout separate: Native requires the shown/corrected current frame plus real app/device parity; Web requires fresh real-browser visual/accessibility evidence plus applicable user confirmation.

## Portfolio Delivery Defaults

- Treat `/Users/yuchen/Code/unu/unuOS/docs/portfolio/agent-delivery-defaults.md` as the version-controlled authority for portfolio-wide delivery defaults across `/Users/yuchen/Code/unu`.
- Follow those delivery defaults by default when the user asks for change implementation, PR text, merge text, or other committable output.
- Follow the repo scope boundary in `/Users/yuchen/Code/unu/unuOS/docs/portfolio/agent-delivery-defaults.md`: by default, handle `unuvault` only, unless the current task has a clear cross-repo dependency or the user explicitly asks for another project.

## unu Task Clarification Gate

- For every task semantically related to the `unu` ecosystem, follow the portfolio authority at `/Users/yuchen/Code/unu/unuOS/docs/portfolio/agent-task-clarification-gate.md` before answering, planning, or changing state.
- This applies to read-only and state-changing work. Repo-local stricter rules still apply.

## unu Skill Routing

- For auth bridge, browser/server env boundaries, sync behavior, iOS bridge, or shared `unuidentity` coupling questions, invoke `unu-docs` first.
- Start from `README.md` for repo overview and active contributor entrypoints. Follow linked architecture or spec docs only when the task needs deeper scope clarification.
- If the task is about README or PR-template normalization, env docs/examples, migration-status wording, runner naming, or shared design-foundation alignment, invoke `unu-contracts`.
- If the task is about `Post-Merge Closeout`, cleanup review, branch/worktree lifecycle state, or retirement-note decisions, invoke `unu-lifecycle`.
- If the task changes auth behavior, env boundaries, sync assumptions, migration shape, or bridge contracts, use `brainstorming` after `unu-docs` before planning or implementation.
- If the task changes UI structure, visual hierarchy, interaction patterns, responsive behavior, or accessibility, invoke `$ui-ux-pro-max` after `brainstorming` before implementation.
- For verification scope selection, invoke `unu-verify`.
- For merge-readiness or blocker assessment, invoke `unu-review`.
