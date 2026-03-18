import { useState } from 'react';
import MenuOverlay from './components/MenuOverlay';
import { MenuItem, Currency, CurrencySymbol } from './types';

const CURRENCY_RATES: Record<Currency, number> = {
  USD: 0.0067,
  EUR: 0.0062,
  GBP: 0.0053,
};

const CURRENCY_SYMBOLS: Record<Currency, CurrencySymbol> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

type AppState = 'upload' | 'loading' | 'result';

export default function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [menuPhoto, setMenuPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [showEnOverlay, setShowEnOverlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setMenuPhoto(dataUrl);
      setAppState('loading');
      setError(null);

      try {
        const base64 = dataUrl.split(',')[1];
        const res = await fetch('/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64 }),
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        setItems(data.items ?? []);
        setAppState('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setAppState('upload');
      }
    };
    reader.readAsDataURL(file);
  }

  if (appState === 'upload' || appState === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#141210',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          padding: 24,
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 24,
            fontWeight: 800,
            color: '#f7f2ea',
          }}
        >
          🏮 Izakaya Lens
        </div>

        {appState === 'loading' ? (
          <div style={{ color: '#c8bfb0', fontSize: 14 }}>Analysing menu…</div>
        ) : (
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              background: '#2e2924',
              border: '2px dashed #3a3530',
              borderRadius: 20,
              padding: '40px 32px',
              cursor: 'pointer',
              color: '#c8bfb0',
              fontSize: 14,
              maxWidth: 360,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 40 }}>📷</span>
            <span>
              <strong style={{ color: '#f7f2ea' }}>Choose a menu photo</strong>
              <br />
              Handwritten Japanese menus work best
            </span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        )}

        {error && (
          <div style={{ color: '#c0392b', fontSize: 13, maxWidth: 360, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <p
          style={{
            fontSize: 11,
            color: '#7a7068',
            maxWidth: 320,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          ⚠️ Allergy info is AI-estimated. Always confirm with staff.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#141210',
        fontFamily: "'DM Sans', sans-serif",
        padding: '16px 16px 40px',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => setAppState('upload')}
          style={{
            background: 'none',
            border: 'none',
            color: '#c8bfb0',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          ← Back
        </button>
        <span style={{ color: '#f7f2ea', fontSize: 13, fontWeight: 500 }}>
          {items.length} item{items.length !== 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        }}
      >
        {/* EN overlay toggle */}
        <button
          onClick={() => setShowEnOverlay((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: showEnOverlay ? 'rgba(232,66,10,.12)' : '#2e2924',
            border: `1px solid ${showEnOverlay ? '#e8420a' : '#3a3530'}`,
            borderRadius: 8,
            padding: '5px 12px',
            cursor: 'pointer',
            color: showEnOverlay ? '#f4a140' : '#c8bfb0',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 500,
          }}
        >
          EN Overlay {showEnOverlay ? 'ON' : 'OFF'}
        </button>

        {/* Currency selector */}
        <div style={{ display: 'flex', background: '#2e2924', borderRadius: 8, overflow: 'hidden' }}>
          {(['USD', 'EUR', 'GBP'] as Currency[]).map((cur) => (
            <button
              key={cur}
              onClick={() => setCurrency(cur)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: currency === cur ? 'white' : '#7a7068',
                background: currency === cur ? '#e8420a' : 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              {cur}
            </button>
          ))}
        </div>
      </div>

      {/* Menu overlay */}
      {menuPhoto && (
        <MenuOverlay
          items={items}
          menuPhoto={menuPhoto}
          currency={currency}
          exchangeRate={CURRENCY_RATES[currency]}
          currencySymbol={CURRENCY_SYMBOLS[currency]}
          showEnOverlay={showEnOverlay}
        />
      )}

      {/* Disclaimer */}
      <div
        style={{
          marginTop: 14,
          background: '#2e2924',
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 11,
          color: '#7a7068',
          lineHeight: 1.6,
          textAlign: 'center',
        }}
      >
        ⚠️ Allergy info is AI-estimated. Always confirm with staff.
      </div>
    </div>
  );
}
