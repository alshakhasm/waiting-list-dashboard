# Feature Specification: Auth, Owners & Members

**Feature Branch**: `011-auth-owners-members`  
**Created**: 2025-10-04  
**Status**: Implemented (Option A: strict RLS)  
**Input**: "Enable sign-in with email, allow anyone to become an owner for their own list, and support invitation-based members with approval."

## User Scenarios & Testing (mandatory)

### Primary User Story
As a user, I want to sign in and either create my own workspace as an owner or join an existing owner’s workspace by invitation so that my data access is correctly scoped and secure.

### Acceptance Scenarios
1. Given I have no account yet, When I go to `/?create=1` and complete the form, Then I receive a confirmation email and, after signing in, my owner account is created and I can access the app.
2. Given I am an authenticated owner, When I invite a colleague, Then they receive a link; after they sign in with the same email and accept, They appear as a pending member until I approve them.
3. Given a member is pending, When the owner approves them, Then they can read backlog and schedule and perform permitted actions.
4. Given Supabase is misconfigured or slow, When the app cannot load my profile within the timeout, Then I see a clear error with actions to Retry, Become owner now, or Go to Sign in.
5. Given a recursive policy would be triggered on `app_users`, When policies are evaluated, Then a helper function `public.is_owner()` is used in policies to avoid recursion and allow evaluation to complete.
6. Given backlog insert is blocked by RLS, When the app attempts to seed demo data on first load, Then the app skips seeding gracefully and continues rendering without showing a startup error.

### Edge Cases
- Sign-in without completing email confirmation → user remains unauthenticated; Create Account will resume after confirmation.
- Invite accepted with mismatched email → invite is rejected and user is informed.
- Owner profile upsert fails → account still works as owner; profile can be completed later.
- `getSession()` stalls due to network blockers → loader times out in 5s and routes to sign-in instead of hanging indefinitely.
- Policies referencing `app_users` directly can recurse → fixed by `public.is_owner()` helper used in policies.
- Demo seeding fails under strict RLS → app logs a warning and proceeds without demo data; no crash.

## Requirements (mandatory)

### Functional Requirements
- FR-001: Users MUST be able to sign in with email (magic link and password supported).
- FR-002: Any authenticated user MUST be able to create their own owner row (self-contained workspace).
- FR-003: Owners MUST be able to invite members via email and see/manage invitations.
- FR-004: Invited users MUST be added as members with status=pending and require owner approval.
- FR-005: Data access MUST require `role='owner'` OR `status='approved'` for backlog/schedule reads; mutations follow policies.
- FR-006: The system MUST show an EnvDebug indicator to verify Supabase enablement in the browser.
- FR-007: The system MUST provide a loading UI with a timeout and actionable recovery for profile load failures.
- FR-008: Policies MUST avoid recursion; use `public.is_owner()` helper in RLS policies (e.g., `app_users_owner_all`, schedule/invitations owner policies).
- FR-009: App MUST provide sign-out shortcuts: visible Sign out, `/?signout=1` (network with 3s cap), and `/?signout=force` (local-only).
- FR-010: Seeding MUST be resilient; if RLS/permissions deny inserts, the app MUST skip demo seeding without surfacing an error banner.
- FR-011: Auth session fetch MUST be bounded (5s) and log progress; on timeout, treat as signed-out to show sign-in.
- FR-012: Access denied view MUST include actions: Become owner (idempotent RPC), Go to Sign in, and Sign out.

### Key Entities
- App User: { userId, email, role: owner|member, status: approved|pending|revoked }
- Invitation: { id, email, token, status, expiresAt, invitedBy }
- Owner Profile: { user_id, full_name, workspace_name, org_name?, phone?, timezone?, locale? }

## Technical Notes (implementation-aligned)

- Supabase Functions (security definer):
	- `app_users_is_empty()` → gate sign-up UI and bootstrap logic.
	- `app_users_bootstrap_owner()` → insert first owner if table empty.
	- `app_users_become_owner()` → idempotent self-promotion to owner.
	- `is_owner()` → returns true if `auth.uid()` has an owner row (used in policies to prevent recursion).

- RLS Policies:
	- `app_users_read_self` (self can read).
	- `app_users_owner_all` uses `public.is_owner()` (non-recursive) for USING / WITH CHECK.
	- `backlog_read` uses owner/approved predicate; backlog insert is NOT allowed under Option A (strict), so demo seeding is skipped.
	- `schedule_*` and `invitations_*` owner policies call `public.is_owner()`.

- UI/UX safeguards and diagnostics:
	- Profile loader emits console milestones: `start → getSession → bootstrap_owner → getCurrentAppUser` and bounds `getSession` to 5s.
	- Error views expose actions (Retry, Become owner now, Go to Sign in) and an EnvDebug badge.
	- Sign-out flows: visible button, `/?signout=1` (best-effort network revoke with 3s cap), and `/?signout=force` (instant local clear).
	- Global seeding is resilient to RLS: warnings logged without interrupting UI load.

## Decision Log

- 2025-10-08: Resolved recursion error on `app_users` by introducing `public.is_owner()` and updating policies to reference it.
- 2025-10-08: Chose Option A (strict RLS). Demo seed no longer inserts under RLS; admin can seed via SQL when needed.
- 2025-10-08: Improved sign-out UX with URL shortcuts and local-fast sign-out to avoid network stalls.

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] All mandatory sections completed

### Requirement Completeness
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Execution Status
- [x] User description parsed
- [x] Key concepts extracted
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
