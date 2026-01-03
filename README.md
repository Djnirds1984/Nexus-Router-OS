# Nexus Router OS powered by AJCMC

Nexus Router OS is a lightweight, production-focused network orchestration platform designed for Linux routers. It provides a modern UI and a hardware agent that together deliver reliable DHCP provisioning, Multi‑WAN control, and system observability. The project prioritizes stability, simplicity, and safe configuration management.

## Project Overview
Nexus Router OS centralizes edge networking tasks under a single, secure control panel. It coordinates DHCP server setup, interface management, and routing policies while persisting configuration safely across reboots. A built‑in agent exposes read/write APIs for metrics, interfaces, and configuration to the UI.

## Core Functionality
- DHCP server configuration and validation (interface selection, ranges, DNS options)
- Multi‑WAN orchestration with load‑balancing and failover modes
- Configuration persistence and backup/restore for critical settings
- Real‑time metrics: CPU, memory, interface throughput, session health
- Safe apply workflow with service restarts and dependency ordering

## Key Features
- DHCP‑only mode to avoid DNS port conflicts (configurable DNS servers via DHCP option 6)
- Automatic NAT and IPv4 forwarding when DHCP is applied
- Interface labeling for easy WAN port numbering
- Status awareness: detect existing `dnsmasq` and prevent duplicate servers
- Minimal footprint with a small Node.js agent and clean UI

## Target Audience & Use Cases
- SMBs, labs, and home networks needing a simple, reliable router UI
- Field deployments where predictable DHCP and Multi‑WAN are essential
- Builders integrating a web control plane with a Linux network stack

## Architecture & Components
- UI: React‑based single‑page application served to browser clients
- Agent: Node.js service exposing REST endpoints (`/api/interfaces`, `/api/metrics`, `/api/config`, `/api/apply`, `/api/dhcp/status`)
- System services: `dnsmasq` for DHCP, kernel routing, iptables/nftables for NAT
- Persistence: JSON configuration with backup/restore on boot

## Technical Specifications & Requirements
- OS: Linux x64 (Ubuntu 22.04/24.04 recommended)
- Services: `dnsmasq`, `systemd`
- Runtime: Node.js (for the agent)
- Networking tools: `iproute2`, `iptables` or `nftables`
- Browser: Modern Chromium/Firefox for UI access

## Security & Reliability
- Validates DHCP settings before service start
- Applies changes atomically and restarts services safely
- Avoids exposing credentials or secrets; follows least‑privilege principles

## Documentation
For installation and deployment instructions, see `deployment.md`.

### PPPoE Management Enhancements
- Interface selection now uses a dynamic dropdown powered by `/api/netdevs`, listing Physical, Bridge, and VLAN interfaces (VLANs detected by `iface.subiface` naming).
- Server IP field is available in the Servers tab; it maps to the selected server’s default profile localAddress to preserve configuration compatibility.
- Authentication type (PAP/CHAP/MSCHAPv1/v2) can be selected per server.
- A Profiles tab provides profile CRUD, rate limits, address pools, and quick credentials creation that links a Secret to the profile without altering backend schemas.
- Inputs include inline validation and user feedback; errors do not block other sections.

## Attribution
Nexus Router OS is powered by AJCMC and built to provide practical, stable routing control for real‑world networks.
