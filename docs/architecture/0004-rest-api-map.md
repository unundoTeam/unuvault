# REST API Map

## Goal

Phase 1 organizes the unuvault API by product domain so web, browser extension, and iPhone clients can share a predictable surface.

## Route Groups

- `GET /health` - service health probe for local development and automated checks
- `/auth` - account creation, sign-in, and session bootstrap
- `/vault` - encrypted item CRUD and sync-related flows
- `/devices` - visible signed-in devices and revocation actions
- `/imports` - browser import jobs, reports, and migration status
- `/activity` - recent trust and account activity shown in security surfaces

## Current Route Maturity

- `GET /health` is an implemented service health probe.
- `/auth` has an implemented bearer-authenticated `POST /auth/bootstrap`
  product identity bridge; shared signup and sign-in remain owned by
  `unuidentity`, not by this prefix.
- `/vault` has an implemented encrypted `POST /vault/sync` contract in addition
  to its scope probe. This does not make every planned vault CRUD flow complete.
- `/imports` has an implemented authenticated recorded report receipt at
  `POST /imports/browser` plus its scope probe. It requires bearer auth,
  accepts sanitized counts and issue reason codes only, and does not accept raw
  CSV. The receipt has at-least-once semantics and no idempotency guarantee;
  `recorded` does not prove vault item persistence or `/vault/sync` linkage.
  An actual browser UI call site, database `CHECK` constraints/RLS, telemetry,
  and external security review remain open.
- `/devices` remains a scope-probe skeleton.
- `/activity` remains a scope probe plus an empty recent-activity scaffold.

These prefixes remain stable shared-client contracts, but maturity must be
described per route rather than as one blanket skeleton or completed API.
