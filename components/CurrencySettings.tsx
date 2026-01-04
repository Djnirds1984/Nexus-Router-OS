import React, { useEffect, useMemo, useRef, useState } from 'react';
 
type Currency = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
};
 
const API_BASE = `http://${window.location.hostname || 'localhost'}:3000/api`;
 
const allCurrencies: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: '$', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: '$', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2 }
];
 
const CurrencySettings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Currency>(allCurrencies.find(c => c.code === 'USD')!);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
 
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetch(`${API_BASE}/config`)
      .then(async r => {
        const cfg = await r.json();
        const cur = cfg?.billing?.currency;
        if (mounted && cur?.code) {
          const match = allCurrencies.find(c => c.code === cur.code);
          if (match) setSelected(match);
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);
 
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCurrencies;
    return allCurrencies.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    );
  }, [searchQuery]);
 
  const handleSelect = (c: Currency) => {
    setSelected(c);
    setOpen(false);
  };
 
  const handleSave = async () => {
    if (!selected || !allCurrencies.find(c => c.code === selected.code)) {
      window.alert('Error: Please select a valid currency.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing: { currency: selected } })
      });
      if (res.ok) {
        window.alert('Success: Currency settings saved.');
      } else {
        const t = await res.text();
        window.alert(`Error: Failed to save currency settings (${t || res.statusText}).`);
      }
    } catch (e: any) {
      window.alert(`Error: ${e?.message || 'Network error'}`);
    } finally {
      setIsSaving(false);
    }
  };
 
  return (
    <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Billing & Currency</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Currency</label>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => setOpen(o => !o)}
              className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none hover:bg-slate-800 transition-all flex items-center justify-between"
            >
              <span className="truncate">{selected.code} — {selected.name} ({selected.symbol})</span>
              <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {open && (
              <div className="absolute z-20 mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
                <div className="p-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search currency"
                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                    aria-label="Search currency"
                  />
                </div>
                <ul
                  ref={listRef}
                  role="listbox"
                  className="max-h-56 overflow-auto py-2"
                >
                  {filtered.map(c => (
                    <li
                      key={c.code}
                      role="option"
                      aria-selected={c.code === selected.code}
                      onClick={() => handleSelect(c)}
                      className={`px-3 py-2 text-xs cursor-pointer ${c.code === selected.code ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{c.code} — {c.name}</span>
                        <span className="text-slate-400 ml-3">{c.symbol}</span>
                      </div>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="px-3 py-2 text-xs text-slate-400">No matches</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="text-slate-500 text-[10px] font-medium leading-relaxed uppercase">
            Selected: <span className="text-slate-300">{selected.code}</span> • Decimals: <span className="text-slate-300">{selected.decimals}</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className={`w-full text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all ${isSaving || isLoading ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
          >
            {isSaving ? 'Saving…' : 'Save Currency Settings'}
          </button>
          {isLoading && <div className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-slate-800/50 text-slate-300 border border-slate-700/40">Loading current settings…</div>}
        </div>
      </div>
    </div>
  );
};
 
export default CurrencySettings;
 
