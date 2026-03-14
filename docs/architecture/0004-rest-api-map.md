# REST API Map

## Goal

Phase 1 organizes the Blackbox API by product domain so web, browser extension, and iPhone clients can share a predictable surface.

## Route Groups

- `GET /health` - service health probe for local development and automated checks
- `/auth` - account creation, sign-in, and session bootstrap
- `/vault` - encrypted item CRUD and sync-related flows
- `/devices` - visible signed-in devices and revocation actions
- `/imports` - browser import jobs, reports, and migration status
- `/activity` - recent trust and account activity shown in security surfaces

## Notes

- The current implementation is only a route skeleton.
- Business logic will be added behind these prefixes in later milestones.
- Prefixes are stable contracts and should remain shared across clients.
