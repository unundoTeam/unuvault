# Agent Notes (UnuVault)

## Frontend Design Rule

- Any task that changes UI structure, visual hierarchy, interaction patterns, responsive behavior, or accessibility must invoke `$ui-ux-pro-max` before implementation.
- Use `brainstorming` to scope the feature or flow first, then use `$ui-ux-pro-max` for the actual UI/UX design and review decisions.

## Design Authority

- Start design work from `/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-operating-index.md`; it is the only first-read design authority.
- Current design status: `registered`.
- Pencil current: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`.
- Pencil draft: `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen`.
- Current design-system frame: `current/unuvault/design-system-v1`.
- Current web source frame: `current/unuvault/web-vault-management-v1`.
- Current Mac companion source frame: `current/unuvault/mac-companion-core-flows-v1.3`.
- Current iOS source frames: `current/unuvault/ios-vault-home-native-locked-v1`
  and `current/unuvault/ios-pairing-invite-receive-v2`.
- Small UI copy or polish uses the `Lightweight UI Path` in the portfolio Pencil gate.
- Historical design specs are planning context only unless the operating index or this repo-local entrypoint explicitly routes to them.
- The legacy product-scope spec is routed only through `/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-specs-inventory.md` as `current-routed` product scope and trust posture context; it is not broad Pencil or current UI authority.
- Future material web, extension, or iOS UI changes start in draft and promote only approved frames into current.

## Portfolio Delivery Defaults

- Treat `/Users/yuchen/Code/unu/unuOS/docs/portfolio/agent-delivery-defaults.md` as the version-controlled authority for portfolio-wide delivery defaults across `/Users/yuchen/Code/unu`.
- Follow those delivery defaults by default when the user asks for change implementation, PR text, merge text, or other committable output.
- Follow the repo scope boundary in `/Users/yuchen/Code/unu/unuOS/docs/portfolio/agent-delivery-defaults.md`: by default, handle `unuvault` only, unless the current task has a clear cross-repo dependency or the user explicitly asks for another project.

## unu Skill Routing

- For auth bridge, browser/server env boundaries, sync behavior, iOS bridge, or shared `unuidentity` coupling questions, invoke `unu-docs` first.
- Start from `README.md` for repo overview and active contributor entrypoints. Follow linked architecture or spec docs only when the task needs deeper scope clarification.
- If the task is about README or PR-template normalization, env docs/examples, migration-status wording, runner naming, or shared design-foundation alignment, invoke `unu-contracts`.
- If the task is about `Post-Merge Closeout`, cleanup review, branch/worktree lifecycle state, or retirement-note decisions, invoke `unu-lifecycle`.
- If the task changes auth behavior, env boundaries, sync assumptions, migration shape, or bridge contracts, use `brainstorming` after `unu-docs` before planning or implementation.
- If the task changes UI structure, visual hierarchy, interaction patterns, responsive behavior, or accessibility, invoke `$ui-ux-pro-max` after `brainstorming` before implementation.
- For verification scope selection, invoke `unu-verify`.
- For merge-readiness or blocker assessment, invoke `unu-review`.
