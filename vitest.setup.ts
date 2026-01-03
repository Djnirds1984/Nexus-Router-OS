import '@testing-library/jest-dom/vitest';

beforeEach(() => {
  // Default mocks, can be overridden per-test
  global.fetch = vi.fn(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/netdevs')) {
      return {
        ok: true,
        json: async () => ({
          interfaces: [
            { name: 'eth0', type: 'physical' },
            { name: 'br0', type: 'bridge' },
            { name: 'eth0.10', type: 'physical' }
          ]
        })
      } as any;
    }
    if (url.endsWith('/api/pppoe/config')) {
      return {
        ok: true,
        json: async () => ({
          servers: [],
          secrets: [],
          profiles: []
        })
      } as any;
    }
    if (url.endsWith('/api/pppoe/active')) {
      return { ok: true, json: async () => [] } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  }) as any;
});
