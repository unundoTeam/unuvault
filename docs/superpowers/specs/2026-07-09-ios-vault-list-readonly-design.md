# iOS Vault List Read-Only Design

## Goal

Show imported vault item metadata on iOS in a read-only list, without exposing
passwords or adding edit, delete, fill, search, or sync behavior.

## Design Gate

- UI impact: `VaultListView` changes from placeholder copy to a visible list
  state.
- Classification: `new-screen-or-component`.
- Project: `unuvault`.
- Pencil current: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`.
- Pencil draft: `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen`.
- Lightweight UI: not applicable.
- ui-ux-pro-max: used for iOS app UI guidance.
- Draft frame/page: `draft/unuvault/ios-vault-list-readonly-v1`
  (`eTCzx`) in `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen`.
- Promotion target: `current/unuvault/ios-vault-list-readonly-v1`.
- Design system frame: `current/unuvault/design-system-v1`.
- Code token/component mapping: native SwiftUI `List` rows, system typography,
  and existing safe vault metadata model.
- User approval: approved in chat on 2026-07-09.
- Implementation source: current iOS vault home direction plus the approved
  chat design in this spec.
- Pencil sync: current promoted; full simulator visual parity proof remains
  pending until the iOS UI host covers this vault list state.
- Draft cleanup: kept as active evidence after promotion.

## Visual Evidence

- Draft frame export:
  `/Users/yuchen/Design/unu/unuvault/exports/2026-07-09-ios-vault-list-readonly-v1b/eTCzx.png`
- Current frame export:
  `/Users/yuchen/Design/unu/unuvault/exports/2026-07-09-ios-vault-list-readonly-current-v1/dQ58n.png`
- Fresh current frame export:
  `/Users/yuchen/Design/unu/unuvault/exports/2026-07-09-ios-vault-list-readonly-current-v2/dQ58n.png`
- Pencil layout snapshot for `eTCzx`: no layout problems.
- Pencil layout snapshot for `dQ58n`: no layout problems.
- Current frame promotion: performed on 2026-07-09.

## User Experience

`VaultListView` displays a read-only list of imported metadata. Each row shows:

- `label` as the primary text
- `username` as secondary text
- `websiteOrigin` as tertiary text

The empty state remains quiet and local-first. It tells the user that imported
vault items will appear after pairing with the Mac.

The screen must not display, encode into view text, or otherwise expose
passwords. It must not include edit, delete, fill, search, cloud sync, or
account controls in this slice.

## Accessibility And Platform Behavior

Use native SwiftUI text and list behavior so Dynamic Type, VoiceOver order,
safe areas, contrast, and touch ergonomics follow iOS defaults. Rows are
informational only and should not appear as tappable actions in this slice.

## Validation

Add tests that render the list body and verify:

- populated data shows `label`, `username`, and `websiteOrigin`
- populated data does not show `password` or secret values
- empty data shows the empty state copy

Then run the repo-owned iOS and pairing boundary test scripts.
