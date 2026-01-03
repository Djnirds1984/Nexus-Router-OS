import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PPPoEManager from '../components/PPPoEManager';

const mockFetch = (payloads: Record<string, any>) => {
  (global.fetch as any) = vi.fn(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    const key = Object.keys(payloads).find(k => url.endsWith(k));
    if (key) return { ok: true, json: async () => payloads[key] } as any;
    if (url.endsWith('/api/pppoe/config') && (input as any).method === 'POST') {
      return { ok: true, json: async () => ({ status: 'ok' }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
};

describe('PPPoE Billing \u0026 Association', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates secret with profile dropdown and due date', async () => {
    mockFetch({
      '/api/netdevs': { interfaces: [] },
      '/api/pppoe/config': {
        servers: [],
        secrets: [],
        profiles: [
          { id: 'p1', name: 'bronze', localAddress: '10.0.0.1', remoteAddressPool: '10.0.0.100-10.0.0.200', dnsServer: '', rateLimit: '', onlyOne: true, price: 100, currency: 'USD', billingPeriodDays: 30, gracePeriodDays: 3, ipPool: '10.0.0.100-10.0.0.200' }
        ]
      },
      '/api/pppoe/active': []
    });
    render(<PPPoEManager />);
    const secretsTab = screen.getByRole('button', { name: /Secrets/i });
    fireEvent.click(secretsTab);
    const user = await screen.findByPlaceholderText(/Username/i);
    const pass = await screen.findByPlaceholderText(/Password/i);
    fireEvent.change(user, { target: { value: 'alice' } });
    fireEvent.change(pass, { target: { value: 'pw' } });
    const profileSelect = await screen.findByRole('combobox');
    fireEvent.change(profileSelect, { target: { value: 'bronze' } });
    const createBtn = await screen.findByRole('button', { name: /Create Secret/i });
    fireEvent.click(createBtn);
    expect(await screen.findByText(/ACTIVE|DUE IN/i)).toBeTruthy();
  });

  it('normalizes IP pool CIDR into remoteAddressPool', async () => {
    mockFetch({
      '/api/netdevs': { interfaces: [] },
      '/api/pppoe/config': { servers: [], secrets: [], profiles: [] },
      '/api/pppoe/active': []
    });
    render(<PPPoEManager />);
    const profilesTab = screen.getByRole('button', { name: /Profiles/i });
    fireEvent.click(profilesTab);
    const addProfile = await screen.findByRole('button', { name: /\+ Add Profile/i });
    fireEvent.click(addProfile);
    const ipPoolInput = await screen.findByLabelText(/IP Pool/i);
    fireEvent.change(ipPoolInput, { target: { value: '10.0.1.0/24' } });
    expect(ipPoolInput).toHaveValue('10.0.1.0/24');
  });
});
