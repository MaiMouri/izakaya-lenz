import { MenuItem, Currency, CurrencySymbol } from '../types';

interface DishPopupProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  currency: Currency;
  exchangeRate: number;
  currencySymbol: CurrencySymbol;
}

const HIGH_RISK_ALLERGENS = ['Egg', 'Shellfish', 'Fish', 'Peanut', 'Tree Nut', 'Milk'];

function allergenClass(allergen: string): 'danger' | 'warn' {
  return HIGH_RISK_ALLERGENS.some((h) =>
    allergen.toLowerCase().includes(h.toLowerCase())
  )
    ? 'danger'
    : 'warn';
}

const ALLERGEN_STYLES: Record<'warn' | 'danger', React.CSSProperties> = {
  warn: { background: '#fff4e0', color: '#c97a00', border: '1px solid #ffe5a0' },
  danger: { background: '#fdecea', color: '#c0392b', border: '1px solid #f9c6c0' },
};

export default function DishPopup({
  item,
  isOpen,
  onClose,
  currency,
  exchangeRate,
  currencySymbol,
}: DishPopupProps) {
  if (!item) return null;

  const { name_jp, name_en, description_en, price_jpy, allergens = [], confidence } = item;
  const converted = price_jpy != null ? (price_jpy * exchangeRate).toFixed(2) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: isOpen ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,0)',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'background .25s',
          zIndex: 100,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fdf8f0',
          borderRadius: '28px 28px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: isOpen
            ? 'transform .32s cubic-bezier(.33,1,.68,1)'
            : 'transform .32s cubic-bezier(.32,0,.67,0)',
          zIndex: 101,
          overflow: 'hidden',
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: '#ddd6ca',
            margin: '12px auto 0',
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 18,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#ede8e0',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            color: '#6b5f52',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >
          ✕
        </button>

        <div style={{ padding: '16px 22px 28px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#0f0d0b',
                  letterSpacing: '.06em',
                }}
              >
                {name_jp}
              </div>
              <div style={{ fontSize: 13, color: '#7a6f63', marginTop: 2, lineHeight: 1.4 }}>
                {name_en}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
              {price_jpy != null && (
                <div
                  style={{
                    fontFamily: "'Shippori Mincho', serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#0f0d0b',
                  }}
                >
                  ¥{price_jpy}
                </div>
              )}
              {converted && (
                <div style={{ fontSize: 12, color: '#c97a00', fontWeight: 500, marginTop: 2 }}>
                  ≈ {currencySymbol}{converted} {currency}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: '#ede8e0', margin: '12px 0' }} />

          {/* Description */}
          {description_en && (
            <p style={{ fontSize: 13, color: '#6b5f52', lineHeight: 1.75, marginBottom: 14 }}>
              {description_en}
            </p>
          )}

          {/* Allergens */}
          {allergens.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: '#a89f94',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  marginBottom: 7,
                }}
              >
                Allergens detected
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allergens.map((a) => (
                  <span
                    key={a}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: 8,
                      letterSpacing: '.03em',
                      ...ALLERGEN_STYLES[allergenClass(a)],
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confidence badge */}
          {confidence && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                padding: '3px 9px',
                borderRadius: 6,
                marginTop: 10,
                ...(confidence === 'high'
                  ? { background: '#e8f5ee', color: '#2d7a4f' }
                  : { background: '#fff4e0', color: '#c97a00' }),
              }}
            >
              {confidence === 'high'
                ? '✓ High OCR confidence'
                : '⚠ Low confidence — verify with staff'}
            </div>
          )}

          {/* Allergy disclaimer */}
          <div
            style={{
              marginTop: 14,
              background: '#fff8ed',
              border: '1px solid #ffe5a0',
              borderRadius: 12,
              padding: '9px 12px',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 14 }}>⚠️</span>
            <p style={{ fontSize: 11, color: '#7a6030', lineHeight: 1.6 }}>
              <strong>AI-estimated.</strong> Always confirm allergy info with staff if you have a
              food allergy.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
