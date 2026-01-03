## Root Cause
- The multi‑WAN page posts to /api/apply with a partial config that often omits `dhcp`.
- The server’s /api/apply handler assigns `systemState.config = req.body` and writes it, overwriting the saved DHCP LAN server configuration.
- After that, DHCP Manager can’t fetch existing DHCP because it was replaced with an object lacking `dhcp`.

## Fix (Minimal, Server‑Side Merge)
- Change /api/apply to merge the incoming config over the existing one instead of overwriting.
- Preserve `dhcp`, `pppoe`, `bridges`, `firewallRules`, and other keys when they are absent in the incoming payload.

### Implementation Details
- Compute a merged config:
  - `const incoming = req.body || {}`
  - `const prev = systemState.config || {}`
  - `systemState.config = { ...prev, ...incoming, wanInterfaces: incoming.wanInterfaces ?? prev.wanInterfaces ?? [], dhcp: incoming.dhcp ?? prev.dhcp ?? { interfaceName: '', enabled: false, start: '', end: '', leaseTime: '24h' }, pppoe: incoming.pppoe ?? prev.pppoe ?? { servers: [], secrets: [], profiles: [] }, bridges: incoming.bridges ?? prev.bridges ?? [], firewallRules: incoming.firewallRules ?? prev.firewallRules, interfaceCustomNames: incoming.interfaceCustomNames ?? prev.interfaceCustomNames }`
- Write the merged config to disk as before and run the existing apply routines against the merged state.
- Do not modify any other endpoint or client page; this change is contained to /api/apply.

## Verification
- Before change: POST /api/apply with `{ wanInterfaces: [...] }` → DHCP disappears.
- After change: POST same payload → `systemState.config.dhcp` persists; DHCP Manager still fetches correct data.
- Add a simple test (manual or unit) to post partial config and confirm DHCP persistence.

## Safety
- Backward compatible: existing callers that include `dhcp` continue to work; those that omit it no longer wipe it.
- Scope is strictly limited to /api/apply; no unrelated modules touched.

## Rollout
- Update server handler, redeploy agent.
- Quick manual test: configure DHCP, then commit Multi‑WAN; confirm DHCP remains visible in DHCP Manager.