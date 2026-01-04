## Overview
- Add a Currency Settings module to the System tab, placed alongside existing SystemSettings and WifiManager, matching current styling and interaction patterns
- Persist the selected currency via existing REST endpoints: GET /api/config to load, POST /api/apply to save, with no server changes
- Provide a searchable, accessible dropdown; default to USD; include PHP and major world currencies
- Include unit tests using Vitest + React Testing Library

## Placement & Integration
- Render CurrencySettings inside the settings tab block at [index.tsx:L4095-L4100](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/index.tsx#L4095-L4100), just below SystemSettings and above WifiManager
- Follow the card layout and typography used in SystemSettings [index.tsx:L1048-L1071](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/index.tsx#L1048-L1071)

## Component Design
- Create components/CurrencySettings.tsx
- State: isLoading, isSaving, searchQuery, selectedCurrency, currencies
- Load: on mount, GET `${API_BASE}/config` and prefill from `config.billing.currency` if present; otherwise default to USD
- UI:
  - Card container with heading “Billing & Currency” using existing classes
  - Searchable dropdown:
    - Input with placeholder “Search currency” filters options by code or name
    - Options list shows code, name, symbol; keyboard navigation (ArrowUp/Down, Enter) and mouse click selection
    - Default selection USD
  - Save button: label “Save Currency Settings”; disabled and shows “Saving…” when isSaving
- Feedback: use window.alert for success/error per existing patterns [index.tsx:L3988-L4016](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/index.tsx#L3988-L4016)
- Accessibility: roles listbox/option, focus management, input labeled; ensure TAB and Enter workflows
- Responsiveness: grid/stack classes consistent with SystemSettings cards; dropdown list constrained and scrollable on small screens

## Currency Data Model
- Static list of major currencies (USD, EUR, GBP, JPY, PHP, AUD, CAD, CHF, CNY, HKD, SGD, KRW, INR, SEK, NOK, DKK, NZD, ZAR, MXN, BRL, RUB, TRY, AED, SAR, THB, TWD, MYR, IDR, VND, etc.) each as { code, name, symbol, decimals }
- Persist selection as `config.billing.currency = { code, symbol, decimals }`
- Store in a way suitable for future conversion: code + decimals enable rate lookup and rounding

## Persistence & Validation
- Save flow:
  - Validate selectedCurrency exists in the list
  - POST `${API_BASE}/apply` with body `{ billing: { currency: selectedCurrency } }`
  - On ok: alert success and clear isSaving; on error: alert failure and clear isSaving
- No server setup changes; relies on merge behavior in /api/apply [server.js:L2222-L2249](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/server.js#L2222-L2249) and persistence to configPath/backupPath

## Unit Tests (Vitest + RTL)
- tests/currencySettings.test.tsx
- Cases:
  - Renders card and defaults to USD
  - Contains PHP and other major currency options
  - Filters list when typing (e.g., “Phil” shows PHP)
  - Saves: triggers validation and calls POST /api/apply with billing.currency; shows success alert on ok, error alert on non-ok
  - Loading and disabled states: shows disabled button during save; handles initial load
- Use existing test setup and fetch mocking [vitest.config.ts](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/vitest.config.ts), [vitest.setup.ts](file:///c:/Users/AJC/Documents/GitHub/Nexus-Router-OS/vitest.setup.ts)

## Future-Proofing
- Data structure (billing.currency) ready to expand with rateProvider, baseCurrency, and conversion rules without breaking changes
- REST-friendly path today (GET /api/config, POST /api/apply); future endpoints can add GET/PUT `/api/billing/currency` while keeping current flow backward-compatible
- UI component designed to accept props for rates or advanced validation later

## Styling & UX
- Match current tailwind-based styling: rounded cards, uppercase microheadings, subtle borders
- Include loading spinner/disabled text on save consistent with patterns (e.g., “SYNCING…” usage)
- Use alerts for success/error to align with existing feedback conventions

## Non-Breaking & Constraints
- No server changes or config edits beyond writing `billing.currency` inside merged config
- No new external libraries; custom searchable dropdown implemented in-house
- Follows existing coding style (functional React, TypeScript, tailwind classes, native alerts)