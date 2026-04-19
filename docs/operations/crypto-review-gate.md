# Crypto Review Gate

## Purpose

This gate defines the release review required before the secure crypto slice can be treated as launch-ready.

## Completed Within This Slice

- Internal architecture review of the crypto boundary
- Updated helper contracts and compatibility posture
- Targeted tests for read, write, and failure behavior
- Documentation of residual risks and migration expectations

## Launch Gate

The following items are required before phase 1 launch:

- Third-party security review of the crypto implementation and call chains
- Verification that legacy compatibility still behaves as expected on real payloads
- Confirmation that no new plaintext, XOR, or custom-hash write paths remain
- Sign-off that the launch checklist reflects the current crypto boundary

## Review Expectations

- Review the CLI provider, web unlock paths, and browser extension read paths together
- Confirm failures are fail-closed and do not leak plaintext to stderr or logs
- Confirm new writes only emit the newest secure envelope formats
- Confirm any migration or remediation notes are captured before launch
- Reuse `docs/operations/crypto-legacy-smoke-checklist.md` for the manual legacy compatibility pass
- Attach `docs/operations/secure-crypto-pr-audit-handoff.md` to PR and audit handoff material

## Notes

- This gate is narrower than a general incident or observability runbook
- It exists to separate internal implementation completion from external launch approval
