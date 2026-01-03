## Overview
- Enhance PPPoE page while keeping existing behavior and static serving untouched.
- Add interface dropdown with dynamic fetch (physical, bridge, VLAN), server IP input, validation.
- Introduce a new Profiles tab built on existing PPPoEProfile/Secret models for create/edit/delete/apply.
- Preserve backend APIs and data shape; all persistence continues via /api/pppoe/config.

## Scope Boundaries
- Modify only the PPPoE UI component [PPPoEManager.tsx](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/components/PPPoEManager.tsx).
- Do not change server static file logic or port; see [server.js](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/server.js#L838-L849).
- Use existing types in [types.ts](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/types.ts#L83-L114); no schema changes.

## Server Addition Section
- Replace plain Interface text input with a dropdown that fetches from `/api/netdevs` [server.js](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/server.js#L857-L907).
  - Populate options from `interfaces[]` including type tags: Physical, Bridge, VLAN (detected by name pattern like `eth0.10`).
  - Show customName when available; fall back to kernel name.
- Add Server IP field in the server card:
  - Bind to the selected server’s `defaultProfile` localAddress in config.profiles (keeps compatibility).
  - On change, update the matching profile’s `localAddress`.
- Add Authentication selector (PAP/CHAP/MSCHAPv1/v2) bound to `PPPoEServerConfig.authentication` [types.ts](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/types.ts#L87-L90).
- Validation & UX:
  - Interface required; warn if interface not in the fetched list.
  - Server IP must be a valid IPv4; prevent save for invalid input and show inline error.
  - Service Name non-empty.
  - Non-blocking inline feedback consistent with Tailwind style used in the page.

## Profile Management Tab
- Add a fourth tab "Profiles" alongside Servers, Secrets, Active.
- List and edit profiles using existing fields [types.ts](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/types.ts#L105-L114): name, localAddress, remoteAddressPool, dnsServer, rateLimit, onlyOne.
- Actions: Create, Edit inline, Delete.
- Apply Profile:
  - Provide an "Apply to Server" action that sets a server’s `defaultProfile` to this profile name.
- Credentials & Auth:
  - Include a "Quick Credentials" sub-form inside each profile card to create/update a Secret linked to the profile (username, password, callerId optional) [types.ts](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/types.ts#L92-L103).
  - Auth type remains on the server (as per current model) to avoid schema changes; show helper text about how auth is applied.
- Persistence:
  - All operations funnel through the existing `saveConfig()` POST to `/api/pppoe/config` [PPPoEManager.tsx](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/components/PPPoEManager.tsx#L48-L62).

## Data Fetch & Performance
- Fetch interfaces once on mount, with manual refresh button; avoid a new polling loop.
- Keep active sessions polling (5s) unchanged [PPPoEManager.tsx](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/components/PPPoEManager.tsx#L38-L46).

## Validation & Error Handling
- Implement small validators (IPv4, rate limit pattern, required fields) with inline messages; no new libraries.
- Graceful fallbacks when `/api/netdevs` fails: allow manual interface entry, show warning.
- Debounce user input to avoid redundant saves; only save on explicit actions.

## Styling & Responsiveness
- Follow existing Tailwind conventions (uppercase labels, tracking-widest, rounded-xl) as used throughout [PPPoEManager.tsx](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/components/PPPoEManager.tsx#L109-L121).
- Use grid layouts that degrade to single-column on small screens, mirroring current layout patterns.

## Backward Compatibility
- Do not alter the shape of `config.pppoe`; keep servers/secrets/profiles arrays intact [types.ts](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/types.ts#L62-L74).
- Map "Server IP" edits to the associated profile’s `localAddress` rather than adding a new server field.
- Keep existing add/delete functions for servers and secrets untouched, only extend UI.

## Unit Tests
- Add Vitest + React Testing Library (test-only additions) without touching runtime code.
- Tests cover:
  - Interface dropdown populates from `/api/netdevs` and includes Bridge/VLAN labels.
  - Server IP validation and mapping to the default profile’s localAddress.
  - Profile CRUD and apply-to-server wiring via `saveConfig()`.
  - Secrets creation from Profiles tab and linking `profile` correctly.
  - Regression: existing server add/delete, secret add/delete, status toggles still function.
  - Confirm static serving untouched by asserting no imports or changes to [server.js](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/server.js) in the refactor.

## Documentation
- Inline component doc blocks for new UI sections and a short README section describing Profiles tab usage, interface dropdown behavior, and validation rules.

## Risks & Mitigations
- VLAN detection is heuristic (name pattern with dot). If `/api/netdevs` later exposes `vlan` type, dropdown will adapt without code changes.
- If defaultProfile is missing, "Server IP" field shows a helper to create/select a profile before editing.

## Deliverables
- Updated PPPoEManager.tsx implementing dropdown, auth select, server IP field, new Profiles tab, validation and feedback.
- New unit test suite verifying interface detection, profile management, IP validation, and regression of existing behaviors.
- Minimal documentation additions aligned with project standards.