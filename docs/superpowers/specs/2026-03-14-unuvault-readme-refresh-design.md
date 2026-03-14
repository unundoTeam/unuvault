# unuvault README Refresh Design

> Status: Approved lightweight design for refreshing the repository homepage and top-level product presentation.

## Goal

Turn the repository homepage into a clearer public front door for `unuvault` while still giving contributors a fast path into the codebase.

## Chosen Approach

Use a dual-layer README.

- The first section should explain what `unuvault` is, who it is for, and why the product exists.
- The second section should help developers navigate the repo, understand phase-1 scope, and find the active source-of-truth docs.

This keeps the GitHub landing page product-shaped without making the repository feel marketing-only.

## Content Direction

- Primary language: English
- Chinese support: one short reinforcing sentence near the top
- Tone: clear, credible, early-stage, and technical
- Brand form: always `unuvault`

## Scope

### In scope

- Refresh `README.md`
- Add a stronger root package description in `package.json`
- Make the homepage structure match the current phase-1 plan and repository shape

### Out of scope

- Rewriting product specs or roadmap decisions
- Changing package scope names again
- Changing feature behavior or runtime code

## README Structure

1. Product title and one-line positioning
2. Short Chinese support sentence
3. `Why unuvault`
4. `Phase 1 scope`
5. `Repository guide`
6. `Development`
7. `Source of truth`
8. `Current status`

## Verification

- Check README copy and root package metadata for naming consistency
- Run a minimal repo verification command after edits
