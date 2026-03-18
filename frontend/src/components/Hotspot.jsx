import React from 'react';

/**
 * Hotspot – transparent overlay positioned via Vision API bbox.
 *
 * Props:
 *   item          – dish data { name_jp, name_en, price_jpy, allergens, confidence, bbox }
 *   scaleX        – displayWidth / imageNaturalWidth
 *   scaleY        – displayHeight / imageNaturalHeight
 *   showEnLabel   – show EN name inline (name only, no price)
 *   onTap         – called when user taps without dragging
 */
export default function Hotspot({
  item,
  scaleX,
  scaleY,
  showEnLabel,
  onTap,
}) {
  const { bbox, name_en, name_jp, confidence } = item;

  const style = {
    position: 'absolute',
    left: bbox.x * scaleX,
    top: bbox.y * scaleY,
    width: bbox.width * scaleX,
    height: bbox.height * scaleY,
    borderRadius: 8,
    border: '2px solid rgba(232,66,10,0)',
    background: 'rgba(232,66,10,0)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 4,
    transition: 'border-color .15s, background .15s, box-shadow .15s',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="hotspot"
      style={style}
      data-jp={name_jp}
      onClick={onTap}
    >
      {/* Small arrow badge – visible on hover via CSS */}
      <div
        style={{
          position: 'absolute',
          right: -10,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#e8420a',
          boxShadow: '0 0 12px rgba(232,66,10,.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: 'white',
          opacity: 0,
          transition: 'opacity .2s',
          pointerEvents: 'none',
        }}
        className="tap-badge"
      >
        →
      </div>

      {/* Low-confidence warning */}
      {confidence === 'low' && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: 0,
            fontSize: 12,
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          ⚠️
        </span>
      )}

      {/* EN overlay label – shown when EN toggle is on */}
      {showEnLabel && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10,8,5,0.82)',
            backdropFilter: 'blur(2px)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px 0 8px',
            gap: 6,
            pointerEvents: 'none',
            animation: 'fadeInLabel .2s ease forwards',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#f7f2ea',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '.02em',
            }}
          >
            {name_en}
          </span>
        </div>
      )}
    </div>
  );
}
