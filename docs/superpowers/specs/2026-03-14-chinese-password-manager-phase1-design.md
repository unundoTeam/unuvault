# unuvault Phase 1 Design

> Status: Product source of truth for scope, target user, goals, non-goals, and trust posture.
> Engineering execution details are governed by `docs/architecture/0000-phase1-execution-baseline.md` and `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`.

## Context

unuvault targets Chinese-speaking technical users who currently rely on browser-native password storage in Chrome, Edge, or Safari. The product starts as a public cloud password manager. Security is the core product promise, and easy migration is the main adoption path.

The approved phase-1 scope is intentionally narrow:

- Public cloud only
- Personal users only
- Chinese-speaking technical users first
- Browser extension + web vault + iPhone app at launch
- Passwords first; no passkeys, teams, or family sharing in phase 1

## Product Statement

Build unuvault, a trustworthy public cloud password manager for Chinese-speaking technical users who have outgrown browser-native password storage and want a safer, clearer, more durable home for their credentials.

The product should feel more secure and more intentional than browser storage, without feeling heavier or harder to adopt than traditional password managers.

## Goals

- Make security the product center of gravity, not just a technical property
- Help users migrate from browser-native password storage in one sitting
- Deliver a launch experience that feels complete enough to become the user's primary password manager
- Ship a coherent three-surface product: browser extension, web vault, and iPhone app
- Establish a trust loop through transparent security explanations, device visibility, and clear recovery guidance

## Non-Goals

- Android
- Desktop app
- Family sharing
- Team or enterprise features
- Passkeys
- Developer secrets or CLI tooling
- File vaults, cards, identity documents, or photo storage
- AI-based automation or organization features

## Target User

### Primary user

A Chinese-speaking technical user who:

- Already stores many passwords in Chrome, Edge, or Safari
- Understands basic digital security but does not want to self-host
- Wants a more trustworthy and manageable system than the browser default
- Uses both desktop browser workflows and iPhone regularly

### User motivation

The user does not switch just because migration is easy. The user switches because the product feels safer and more trustworthy. Migration quality matters because it lowers the cost of acting on that trust.

## Product Positioning

### Core promise

Security and trust first. Smooth migration second. Polished daily use third.

### Positioning sentence

unuvault is a public cloud password manager for Chinese-speaking technical users who want to upgrade from browser-native password storage to a product that is more secure, more transparent, and easier to live in every day.

### Competitive posture

The product should not try to win by feature breadth in phase 1. It should win by:

- Better trust communication
- Cleaner migration from browser storage
- Strong browser extension workflow
- Credible iPhone support at launch

## Platform Scope

### Browser extension

The extension is the daily action surface.

Responsibilities:

- Save new passwords
- Autofill login forms
- Update changed passwords
- Offer quick in-context search
- Trigger or guide browser-password import

### Web vault

The web vault is the management and trust surface.

Responsibilities:

- Registration and login
- Vault browsing, search, edit, and organization
- Security explanations
- Device/session management
- Import flow and migration report
- Account settings and recovery guidance

### iPhone app

The iPhone app is the mobile credibility surface.

Responsibilities:

- Sign in and unlock
- View and search vault items
- Support iOS AutoFill
- Support biometric unlock
- Keep critical credentials available away from desktop

## Core Modules

### 1. Account and Identity

- Account creation
- Login
- Primary vault unlock model
- Device session tracking
- Recovery guidance and account-level settings

### 2. Vault

- Login-item storage
- Create, edit, delete
- Search
- Favorites
- Minimal categorization

Phase 1 focuses on website login items only.

### 3. Migration

- Import from Chrome, Edge, and Safari
- Basic duplicate and malformed-entry handling
- Import success report
- Post-import next-step guidance

### 4. Browser Fill and Save

- Form detection
- Autofill
- Save prompt
- Update prompt
- Quick picker in extension popup

### 5. Sync and Cross-Device Availability

- Vault sync across extension, web, and iPhone
- Basic conflict handling
- Predictable state refresh

### 6. Security and Trust

- Human-readable security model
- Device/session visibility
- Sensitive action confirmation
- Basic risk surfacing
- Help center and recovery education

## Core User Flows

### Primary flow: browser-native user migrates and becomes active

1. User creates an account in the web vault
2. User sets the primary account credentials
3. User installs the browser extension
4. User imports passwords from Chrome, Edge, or Safari
5. User sees an import report with counts, duplicates, and next steps
6. User starts autofilling on real sites
7. User saves or updates at least one credential from the extension
8. User signs into the iPhone app and enables AutoFill
9. User crosses the line from trial to primary use

### Daily-use flow

1. User visits a login page
2. Extension offers autofill
3. User signs up for a new service and receives a save prompt
4. User updates a password and receives an update prompt
5. User occasionally uses the web vault to search, edit, or clean up items
6. User retrieves credentials on iPhone when away from desktop

### Trust flow

1. User encounters clear security explanations during onboarding
2. User can inspect devices and recent sessions
3. User understands what the product can and cannot recover
4. User can find backup and recovery guidance without opening support tickets

## Security and Trust Design

### Product stance

Security must be both real and legible. The product should feel professional, transparent, and understandable. It should avoid both black-box vagueness and jargon-heavy crypto theater.

### Phase-1 trust surfaces

- Clear explanation of encryption and key roles
- Clear explanation of what the service can and cannot see
- Device and session list
- Recent account activity
- Sensitive action confirmations
- Backup and export guidance
- Recovery explanations written in plain language

### Account protection baseline

- Strong primary account credential flow
- Email verification
- Biometric unlock on iPhone
- Session revocation
- Export and backup guidance
- Low-noise security prompts for weak, repeated, or stale passwords

### Risk design

Warnings should help the user improve security without overwhelming them. Phase 1 should avoid a large security-score dashboard and instead focus on a small number of actionable, understandable prompts.

## Phase-1 Success Criteria

### Product outcomes

- Users can move from browser-native storage to active daily use without support
- Users can trust the product enough to store their primary credentials
- Users can use the product across browser and iPhone in a believable way

### Experience outcomes

- Import is understandable and recoverable
- Autofill and save flows feel dependable
- Security explanations reduce confusion rather than increase it

## Assumptions

- Implementation will use Bitwarden as the functional baseline or reference architecture
- The first launch should prioritize trust, migration, and browser workflows over breadth
- The initial product language should be Chinese-first, with a later path to global expansion

## Phase-2 Candidates

- Android
- Family sharing
- Passkeys
- Expanded vault item types
- Desktop app
- Team features
- English localization and global positioning
