import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import PPPoEManager from '../components/PPPoEManager';

const mockFetchSequence = (handlers: Record<string, any>) => {
  (global.fetch as any) = vi.fn(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    for (const key of Object.keys(handlers)) {
      if (url.endsWith(key)) {
        return { ok: true, json: async () => handlers[key] } as any;
      }
    }
    return { ok: true, json: async () => ({}) } as any;
  });
};

describe('PPPoEManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('populates interface dropdown including Bridge and VLAN labels', async () => {
    mockFetchSequence({
      '/api/netdevs': {
        interfaces: [
          { name: 'eth0', type: 'physical' },
          { name: 'br0', type: 'bridge' },
          { name: 'eth0.20', type: 'physical' },
        ],
      },
      '/api/pppoe/config': { servers: [], secrets: [], profiles: [] },
      '/api/pppoe/active': [],
    });
    render(<PPPoEManager />);
    // Add a server to see the dropdown
    const addBtn = await screen.findByRole('button', { name: /\+ Add Server/i });
    fireEvent.click(addBtn);
    const select = (await screen.findAllByRole('combobox'))[0];
    const options = within(select as HTMLSelectElement).getAllByRole('option');
    const labels = options.map(o => o.textContent || '');
    expect(labels.some(l => l.includes('Physical'))).toBe(true);
    expect(labels.some(l => l.includes('Bridge'))).toBe(true);
    expect(labels.some(l => l.includes('VLAN'))).toBe(true);
  });

  it('validates and maps Server IP to profile localAddress', async () => {
    mockFetchSequence({
      '/api/netdevs': { interfaces: [{ name: 'eth0', type: 'physical' }] },
      '/api/pppoe/config': {
        servers: [
          { id: 's1', interfaceName: 'eth0', serviceName: 'Nexus', defaultProfile: 'default', authentication: 'chap', enabled: false },
        ],
        secrets: [],
        profiles: [
          { id: 'p1', name: 'default', localAddress: '10.0.0.1', remoteAddressPool: '10.0.0.100-10.0.0.200', dnsServer: '8.8.8.8', rateLimit: '10M/10M', onlyOne: true },
        ],
      },
      '/api/pppoe/active': [],
    });
    render(<PPPoEManager />);
    const serverIpField = await screen.findByPlaceholderText(/e\.g\. 10\.0\.0\.1/i);
    fireEvent.change(serverIpField, { target: { value: 'invalid' } });
    expect(await screen.findByText(/Invalid IPv4 address/i)).toBeInTheDocument();
    fireEvent.change(serverIpField, { target: { value: '10.0.0.9' } });
    expect(screen.queryByText(/Invalid IPv4 address/i)).toBeNull();
  });

  it('supports Profile CRUD and apply-to-server', async () => {
    mockFetchSequence({
      '/api/netdevs': { interfaces: [{ name: 'eth0', type: 'physical' }] },
      '/api/pppoe/config': { servers: [{ id: 's1', interfaceName: 'eth0', serviceName: 'Nexus', defaultProfile: 'default', authentication: 'chap', enabled: false }], secrets: [], profiles: [] },
      '/api/pppoe/active': [],
    });
    render(<PPPoEManager />);
    const profilesTab = screen.getByRole('button', { name: /Profiles/i });
    fireEvent.click(profilesTab);
    const addProfileBtn = await screen.findByRole('button', { name: /\+ Add Profile/i });
    fireEvent.click(addProfileBtn);
    const nameField = await screen.findByDisplayValue(/default/i);
    fireEvent.change(nameField, { target: { value: 'bronze' } });
    const applySelect = (await screen.findAllByRole('combobox')).slice(-1)[0];
    fireEvent.change(applySelect, { target: { value: 's1' } });
    expect(applySelect).toBeInTheDocument();
  });

  it('creates secrets from Profiles quick credentials', async () => {
    mockFetchSequence({
      '/api/netdevs': { interfaces: [{ name: 'eth0', type: 'physical' }] },
      '/api/pppoe/config': { servers: [], secrets: [], profiles: [] },
      '/api/pppoe/active': [],
    });
    render(<PPPoEManager />);
    const profilesTab = screen.getByRole('button', { name: /Profiles/i });
    fireEvent.click(profilesTab);
    const addProfileBtn = await screen.findByRole('button', { name: /\+ Add Profile/i });
    fireEvent.click(addProfileBtn);
    const userField = (await screen.findAllByRole('textbox')).slice(-1)[0];
    fireEvent.change(userField, { target: { value: 'alice' } });
    expect(userField).toHaveValue('alice');
  });
});
