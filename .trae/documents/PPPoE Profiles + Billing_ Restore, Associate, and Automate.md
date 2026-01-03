## Overview
- Restore PPPoE Profile management and integrate billing, profile–secret association, and IP pool controls.
- Keep changes scoped to PPPoE UI and PPPoE config endpoints; preserve existing behavior elsewhere.

## Data Model (Backward Compatible)
- PPPoEProfile (extend with optional billing fields):
  - price?: number
  - currency?: string
  - billingPeriodDays?: number (default 30)
  - defaultDueDate?: string (ISO date)
  - gracePeriodDays?: number (default 0)
  - ipPool?: string (optional, new) — CIDR or range(s); if absent, use existing remoteAddressPool
- PPPoESecret (extend optional fields):
  - dueDate?: string (ISO date)
  - status?: 'ACTIVE' | 'GRACE' | 'EXPIRED'
- Keep remoteAddressPool in PPPoEProfile for compatibility; IP Pool UI writes to ipPool when provided and also mirrors to remoteAddressPool in start–end format for older consumers.

## API Changes (PPPoe-only)
- Adjust /api/pppoe/config GET/POST to pass-through the new optional fields without changing response shape.
- Before POST write, emit a timestamped backup of systemState.config.

## UI Changes: PPPoE Manager
- Profiles tab (restored):
  - General: name, localAddress, DNS, rateLimit, onlyOne (existing)
  - IP Pool:
    - Field labeled "IP Pool" supporting either CIDR (e.g., 10.0.0.0/24) or range (start-end). Validate format and overlaps.
    - Persist to profile.ipPool; also derive remoteAddressPool (first-last in range) for legacy.
  - Billing:
    - Price (numeric) + Currency (dropdown)
    - Billing period (days; default 30)
    - Default due date (optional date input)
    - Grace period (days)
- Secrets tab:
  - Add profile dropdown (required) with labels: name • price currency • period.
  - On selection, set dueDate to defaultDueDate or today + billingPeriodDays.
  - Display associated profile for each secret.
- Active view:
  - Show subscription status badges based on dueDate and gracePeriod.

## Subscription Automation
- Client-side status computation and warnings for near-due (≤3 days).
- No enforcement changes; purely admin/visual until requested.

## Validation
- IP Pool: accept CIDR or start–end; ensure valid IPv4 and start ≤ end; optionally prevent overlaps across profiles.
- Billing fields: numeric/currency/date validation.
- Secrets: require profile; compute dueDate; allow manual override with date input.

## Backups  Safety
- Timestamped JSON backup before updating PPPoE config.
- Limit edits to PPPoE UI and /api/pppoe/config handler.

## Testing
- Unit: IP pool parsing/validation, billing forms, currency formatting.
- Integration: profile dropdown population in Secrets, dueDate calculation, GET/POST config round-trip.
- Regression: existing PPPoE server/secret operations unaffected.

## Documentation
- Update README and PPPoE docs: Profiles tab (including IP Pool and Billing), Secrets association, status badges.
- API notes for new optional fields and backup behavior.

## Rollout
- Implement PPPoEManager changes and PPPoE config handler passthrough + backup.
- Add tests; run in staging; rebuild and deploy.

Proceeding will restore Profiles tab with IP Pool and Billing, add profile selection to Secrets with automatic due dates, and keep compatibility via remoteAddressPool mirroring.