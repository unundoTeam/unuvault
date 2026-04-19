# unuvault Phase 1 Launch Checklist

- Internal crypto review is complete for the client-side security boundary
- Third-party crypto review is still a launch gate and must be cleared before phase 1 goes live
- Complete `docs/operations/crypto-legacy-smoke-checklist.md` on an available local environment and record the result in `docs/operations/secure-crypto-pr-audit-handoff.md`
- Confirm trust explanations appear in web onboarding and security surfaces
- Confirm browser import creates an import job for Chrome, Edge, or Safari payloads
- Confirm vault sync route responds with updated items, deleted IDs, and conflicts
- Confirm browser extension popup and autofill helpers pass automated checks
- Confirm iPhone login and AutoFill onboarding tests pass on an available simulator
- Confirm `docs/operations/crypto-review-gate.md` is complete and matches the current launch policy
- Confirm `docs/operations/crypto-legacy-smoke-checklist.md` and `docs/operations/secure-crypto-pr-audit-handoff.md` are attached to the launch review packet
- Review help docs for recovery and import troubleshooting before external testing
