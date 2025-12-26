# Nexus Router OS - System Administration Guide

## Interface Management & Naming

Nexus Router OS provides two levels of interface renaming: **Display Renaming** and **Persistent System Renaming**.

### 1. Display Renaming (Safe)
Assigns a friendly alias to an interface without changing the underlying system identifier.
*   **Usage**: Rename `eth0` to "Starlink WAN" or "Office Bridge".
*   **Behavior**:
    *   System continues to use `eth0` for DHCP, routing, and firewall rules.
    *   UI displays "Starlink WAN" in Dashboard and menus.
    *   **Persistence**: Stored in `nexus-config.json`.
*   **Requirements**: Any character string allowed.

### 2. Persistent System Renaming (Advanced)
Changes the actual Linux kernel interface name. This is recommended for establishing a clean, semantic network topology (e.g., `wan0`, `lan0`, `dmz0`).
*   **Usage**: Rename `eth0` to `wan0`.
*   **Behavior**:
    *   Updates Linux kernel interface name via `ip link`.
    *   **Updates DHCP Server**: `dnsmasq` configuration is automatically updated to bind to the new name (`interface=wan0`).
    *   **Updates Firewall/Routing**: Internal config references are updated.
    *   **Persistence**:
        *   Generates `udev` rules in `/etc/udev/rules.d/99-nexus-net.rules` binding the MAC address to the new name.
        *   Saves MAC mapping in `nexus-config.json` for backup/restore portability.
*   **Requirements**:
    *   Must be a valid Linux interface name (Alphanumeric, no spaces, e.g., `lan1`).
    *   **Reboot**: A system reboot may be required if the interface is busy or if driver locks prevent runtime renaming.

### Synchronization & Propagation

The system employs a centralized synchronization mechanism to ensure interface names are consistent across all views.

1.  **Backend (Single Source of Truth)**
    *   The backend agent (`server.js`) loads `interfaceCustomNames` and `persistentInterfaceMap` at startup.
    *   On boot, `restorePersistentNaming()` checks `persistentInterfaceMap` and regenerates `udev` rules if missing, ensuring network identity persists even after a factory reset (if config is restored).

2.  **DHCP Integration**
    *   When a System Rename occurs (e.g., `eth0` -> `lan0`), the DHCP service is automatically reconfigured to serve `lan0`.
    *   The `dhcp.interfaceName` setting in `nexus-config.json` is updated to reflect the new name.

### Verification Procedures

To validate that the persistent renaming is functioning correctly, perform the following checks:

#### 1. System Reboot Verification
1.  Rename an interface (e.g., `eth0` to `wan0`) via the Dashboard.
2.  Reboot the system (`sudo reboot`).
3.  After boot, open a terminal and run: `ip link show`.
4.  **Expected Result**: The interface should be listed as `wan0`.
5.  Check the Dashboard: The interface should appear as `wan0` with its configured status.

#### 2. DHCP Configuration Persistence
1.  Ensure a DHCP server is set up on the interface (e.g., `wan0`).
2.  Navigate to **DHCP Management** and click **Save & Apply**.
3.  Check the generated configuration: `cat /etc/dnsmasq.d/nexus-dhcp.conf`.
4.  **Expected Result**: The configuration should reference `interface=wan0`.
5.  Connect a client device; it should receive an IP address from the `wan0` pool.

#### 3. Service Restart Stability
1.  Restart the Nexus Agent service: `sudo systemctl restart nexus-agent`.
2.  Check the logs: `tail -f /var/log/nexus-agent.log`.
3.  **Expected Result**:
    *   No "Interface not found" errors.
    *   `restorePersistentNaming` should log "Restored persistent interface naming rules" (or silent if rules match).
    *   Network traffic graphs on the Dashboard should resume immediately.

### Troubleshooting

*   **Interface Missing After Rename**:
    *   Check `ip link show` in terminal.
    *   Verify `/etc/udev/rules.d/99-nexus-net.rules` matches the device MAC address.
    *   If the name is "busy", reboot the system.

*   **DHCP Not Serving**:
    *   Ensure the interface name in `DHCP Management` matches the current system name.
    *   Check `/var/log/nexus-agent.log` for "DHCP APPLY ERROR".

### API Reference

**Rename Interface**
`POST /api/interfaces/rename`
```json
{
  "interfaceName": "eth0",
  "customName": "lan0"
}
```
*   If `customName` is a valid kernel name (e.g., `lan0`), the system attempts a **System Rename**.
*   If `customName` contains spaces (e.g., `Primary WAN`), it performs a **Display Rename**.
