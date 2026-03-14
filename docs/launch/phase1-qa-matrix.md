# Blackbox Phase 1 QA Matrix

## Core Paths

- Account shell loads in web
- Security page shows devices and recent activity sections
- Browser extension popup shows vault search
- Browser import page shows Chrome, Edge, and Safari entry point
- iPhone login and AutoFill onboarding render in simulator tests

## Verification Targets

- API route smoke tests for health, sync, imports, devices, and recent activity
- Web component tests for security and import pages
- Browser-extension tests for autofill detection and popup search field
- Shared package tests for schema and unlock policy contracts
- iOS simulator tests for login and AutoFill onboarding copy
