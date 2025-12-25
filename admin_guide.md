# Nexus Router OS - System Administration Guide

## Interface Management & Naming

Nexus Router OS provides a flexible interface management system allowing custom naming for physical WAN ports and bridges. This guide details the naming conventions, synchronization behavior, and persistence mechanisms.

### Naming Conventions

*   **System Name**: The Linux kernel interface name (e.g., `eth0`, `eth1`, `wlan0`). This is immutable and serves as the unique identifier (`interfaceName` in API).
*   **Custom Name**: A user-defined friendly name (e.g., `Starlink`, `Fiber Backup`, `Local LAN`).
    *   **Length**: Recommended 1-20 characters.
    *   **Allowed Characters**: Alphanumeric, spaces, hyphens. Avoid special characters that might break UI layouts.
    *   **Storage**: Custom names are stored in `nexus-config.json` under the `interfaceCustomNames` object, mapping system names to custom strings.

### Synchronization & Propagation

The system employs a centralized synchronization mechanism to ensure interface names are consistent across all views (Dashboard, Multi-WAN, Interfaces, Traffic Monitor).

1.  **Backend (Single Source of Truth)**
    *   The backend agent (`server.js`) loads `interfaceCustomNames` from `nexus-config.json` at startup.
    *   During the real-time interface polling loop (1s interval), the agent injects the `customName` into the standard interface status object.
    *   The `name` field of the API response (`/api/interfaces` and `/api/netdevs`) is automatically populated with the custom name if it exists, falling back to the uppercase system name.

2.  **Frontend (Real-Time Updates)**
    *   **Dashboard**: Subscribes to `/api/interfaces`. Renaming an interface updates the API response, which automatically updates the Dashboard dropdowns, graph titles, and status matrix within the next polling cycle (approx. 1 second).
    *   **Multi-WAN Manager**: Merges static configuration with real-time interface status. Even if the underlying configuration refers to `eth0`, the UI looks up the live status to display "Starlink".
    *   **Persistence**: Renaming is performed via `POST /api/interfaces/rename`. This immediately updates the in-memory state and persists to disk.

### Troubleshooting

*   **Name Not Updating**:
    *   Ensure the agent is running (`systemctl status nexus-agent`).
    *   Check `nexus-config.json` for write permissions.
    *   Refresh the browser page to clear any stale client-side cache (though the app is designed to auto-refresh).

*   **Conflict Resolution**:
    *   If a custom name is deleted or set to empty, the system automatically reverts to the default system name (e.g., `ETH0`).
    *   If a physical interface is removed (e.g., USB unplugged), the custom name remains in the config but will not be displayed until the interface reappears.

### API Reference

**Rename Interface**
`POST /api/interfaces/rename`
```json
{
  "interfaceName": "eth0",
  "customName": "Primary Fiber"
}
```
*Set `customName` to empty string to reset.*
