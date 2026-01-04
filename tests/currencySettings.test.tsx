import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CurrencySettings from '../components/CurrencySettings';
 
const okJson = (data: any) => ({ ok: true, json: async () => data } as any);
const okText = () => ({ ok: true, text: async () => '' } as any);
const failText = (status = 500, text = 'Server error') => ({ ok: false, status, statusText: text, text: async () => text } as any);
 
describe('CurrencySettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
 
  it('defaults to USD and renders controls', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(okJson({})); // GET /api/config
    render(<CurrencySettings />);
    expect(await screen.findByText(/Billing & Currency/i)).toBeInTheDocument();
    expect(screen.getByText(/USD — US Dollar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Currency Settings/i })).toBeInTheDocument();
  });
 
  it('includes PHP and filters by search input', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(okJson({})); // GET /api/config
    render(<CurrencySettings />);
    fireEvent.click(screen.getByRole('button', { name: /USD — US Dollar/i }));
    const input = await screen.findByLabelText(/Search currency/i);
    fireEvent.change(input, { target: { value: 'Phil' } });
    expect(await screen.findByText(/PHP — Philippine Peso/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/PHP — Philippine Peso/));
    expect(screen.getByText(/Selected:/)).toHaveTextContent('PHP');
  });
 
  it('loads selection from /api/config', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(okJson({ billing: { currency: { code: 'EUR' } } })); // GET /api/config
    render(<CurrencySettings />);
    await waitFor(() => expect(screen.getByText(/EUR — Euro/)).toBeInTheDocument());
  });
 
  it('saves selection via /api/apply on success', async () => {
    const alerts: string[] = [];
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(okJson({})) // GET /api/config
      .mockResolvedValueOnce(okText()); // POST /api/apply
    vi.spyOn(window, 'alert').mockImplementation((msg: string) => { alerts.push(msg); });
    render(<CurrencySettings />);
    fireEvent.click(screen.getByRole('button', { name: /USD — US Dollar/i }));
    const input = await screen.findByLabelText(/Search currency/i);
    fireEvent.change(input, { target: { value: 'JPY' } });
    fireEvent.click(await screen.findByText(/JPY — Japanese Yen/));
    fireEvent.click(screen.getByRole('button', { name: /Save Currency Settings/i }));
    await waitFor(() => expect(alerts.some(a => /Success: Currency settings saved/i.test(a))).toBe(true));
  });
 
  it('alerts on save error', async () => {
    const alerts: string[] = [];
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(okJson({})) // GET /api/config
      .mockResolvedValueOnce(failText(500, 'Server error')); // POST /api/apply
    vi.spyOn(window, 'alert').mockImplementation((msg: string) => { alerts.push(msg); });
    render(<CurrencySettings />);
    fireEvent.click(screen.getByRole('button', { name: /Save Currency Settings/i }));
    await waitFor(() => expect(alerts.some(a => /Error:/i.test(a))).toBe(true));
  });
});
 
