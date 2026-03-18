import React, { useCallback, useEffect, useRef, useState } from 'react';
import DishPopup from './DishPopup';
import Hotspot from './Hotspot';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_HINT_THRESHOLD = 6;
const ZOOM_HINT_DURATION_MS = 3000;
const TAP_MOVE_THRESHOLD = 8;   // px – more movement than this → not a tap
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_ZOOM = 2.5;

/**
 * MenuOverlay – result screen with photo + pinch-to-zoom + hotspot overlays.
 *
 * Props:
 *   items            – array of dish objects from the API
 *                      { name_jp, name_en, description_en, price_jpy,
 *                        allergens, confidence, bbox: {x,y,width,height} }
 *   menuPhoto        – image src (URL or base64 data URI)
 *   imageNaturalWidth  – original image width in pixels (from Vision API / img.naturalWidth)
 *   imageNaturalHeight – original image height in pixels
 *   currency         – "USD" | "EUR" | "GBP"
 *   exchangeRate     – number (multiply JPY by this to get foreign currency)
 *   currencySymbol   – "$" | "€" | "£"
 *   showEnOverlay    – boolean – controlled by parent EN toggle
 */
export default function MenuOverlay({
  items = [],
  menuPhoto,
  imageNaturalWidth,
  imageNaturalHeight,
  currency = 'USD',
  exchangeRate = 0.0067,
  currencySymbol = '$',
  showEnOverlay = false,
}) {
  // ── Transform state ────────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Keep refs in sync so event handlers never read stale state
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const syncTransform = useCallback((newScale, newPan) => {
    scaleRef.current = newScale;
    panRef.current = newPan;
    setScale(newScale);
    setPan(newPan);
  }, []);

  // ── Zoom hint ──────────────────────────────────────────────────────────────
  const [showHint, setShowHint] = useState(items.length > ZOOM_HINT_THRESHOLD);
  const hintTimerRef = useRef(null);

  useEffect(() => {
    if (items.length > ZOOM_HINT_THRESHOLD) {
      setShowHint(true);
      hintTimerRef.current = setTimeout(() => setShowHint(false), ZOOM_HINT_DURATION_MS);
    }
    return () => clearTimeout(hintTimerRef.current);
  }, [items.length]);

  function dismissHint() {
    clearTimeout(hintTimerRef.current);
    setShowHint(false);
  }

  // ── Popup state ────────────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState(null);

  // ── Container + image dimensions ──────────────────────────────────────────
  const containerRef = useRef(null);
  const [imgScaleX, setImgScaleX] = useState(1);
  const [imgScaleY, setImgScaleY] = useState(1);

  const imgRef = useRef(null);

  const updateImgScale = useCallback(() => {
    if (!containerRef.current) return;
    const natW = imageNaturalWidth || imgRef.current?.naturalWidth;
    const natH = imageNaturalHeight || imgRef.current?.naturalHeight;
    if (!natW || !natH) return;
    const { clientWidth, clientHeight } = containerRef.current;
    setImgScaleX(clientWidth / natW);
    setImgScaleY(clientHeight / natH);
  }, [imageNaturalWidth, imageNaturalHeight]);

  useEffect(() => {
    updateImgScale();
    window.addEventListener('resize', updateImgScale);
    return () => window.removeEventListener('resize', updateImgScale);
  }, [updateImgScale]);

  // ── Pan clamping ───────────────────────────────────────────────────────────
  function clampPan(x, y, s) {
    const el = containerRef.current;
    if (!el) return { x, y };
    const w = el.clientWidth;
    const h = el.clientHeight;
    return {
      x: Math.min(0, Math.max(x, w * (1 - s))),
      y: Math.min(0, Math.max(y, h * (1 - s))),
    };
  }

  // ── Gesture tracking refs ──────────────────────────────────────────────────
  const pointersRef = useRef(new Map());   // pointerId → {x, y}
  const gestureRef = useRef({
    type: null,       // 'pan' | 'pinch'
    prevDist: null,
    totalMove: 0,     // cumulative movement for tap detection
  });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const didDragRef = useRef(false);        // used to suppress accidental click

  function getContainerCoords(e) {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Pointer handlers ───────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getContainerCoords(e);
    pointersRef.current.set(e.pointerId, pos);

    if (pointersRef.current.size === 1) {
      gestureRef.current = { type: 'pan', prevDist: null, totalMove: 0 };
      didDragRef.current = false;
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      gestureRef.current = { type: 'pinch', prevDist: dist, totalMove: 0 };
      didDragRef.current = true; // two-finger gesture is never a tap
    }
  }, []);

  const handlePointerMove = useCallback((e) => {
    const pos = getContainerCoords(e);
    const prevPos = pointersRef.current.get(e.pointerId);
    if (!prevPos) return;

    pointersRef.current.set(e.pointerId, pos);

    const { type } = gestureRef.current;

    if (type === 'pan' && pointersRef.current.size === 1) {
      const dx = pos.x - prevPos.x;
      const dy = pos.y - prevPos.y;
      gestureRef.current.totalMove += Math.abs(dx) + Math.abs(dy);

      if (gestureRef.current.totalMove > TAP_MOVE_THRESHOLD) {
        didDragRef.current = true;
      }

      if (scaleRef.current > 1) {
        const newPan = clampPan(
          panRef.current.x + dx,
          panRef.current.y + dy,
          scaleRef.current,
        );
        syncTransform(scaleRef.current, newPan);
      }
    } else if (type === 'pinch' && pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const currentDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const { prevDist } = gestureRef.current;
      if (!prevDist || prevDist === 0) return;

      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const prevS = scaleRef.current;
      const rawScale = prevS * (currentDist / prevDist);
      const newScale = Math.min(Math.max(rawScale, MIN_SCALE), MAX_SCALE);

      const newPanX = midX * (1 - newScale / prevS) + panRef.current.x * (newScale / prevS);
      const newPanY = midY * (1 - newScale / prevS) + panRef.current.y * (newScale / prevS);

      const newPan = clampPan(newPanX, newPanY, newScale);
      syncTransform(newScale, newPan);

      gestureRef.current.prevDist = currentDist;
      dismissHint();
    }
  }, [syncTransform]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerUp = useCallback((e) => {
    const pos = getContainerCoords(e);
    const activeCount = pointersRef.current.size;

    // Double-tap detection – only on single-finger, non-drag lifts
    if (activeCount === 1 && !didDragRef.current) {
      const now = Date.now();
      const last = lastTapRef.current;
      const dist = Math.hypot(pos.x - last.x, pos.y - last.y);

      if (now - last.time < DOUBLE_TAP_MS && dist < 30) {
        // Double-tap: toggle between reset and DOUBLE_TAP_ZOOM
        if (Math.abs(scaleRef.current - 1) < 0.15) {
          const newScale = DOUBLE_TAP_ZOOM;
          const newPanX = pos.x * (1 - newScale);
          const newPanY = pos.y * (1 - newScale);
          const newPan = clampPan(newPanX, newPanY, newScale);
          syncTransform(newScale, newPan);
          dismissHint();
        } else {
          syncTransform(1, { x: 0, y: 0 });
        }
        lastTapRef.current = { time: 0, x: 0, y: 0 };
      } else {
        lastTapRef.current = { time: now, x: pos.x, y: pos.y };
      }
    }

    pointersRef.current.delete(e.pointerId);

    // Downgrade pinch → pan if one finger lifts
    if (pointersRef.current.size === 1) {
      gestureRef.current.type = 'pan';
      gestureRef.current.totalMove = 0;
      didDragRef.current = false;
    } else if (pointersRef.current.size === 0) {
      gestureRef.current.type = null;
    }
  }, [syncTransform]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suppress click on hotspots after a drag
  const handleClickCapture = useCallback((e) => {
    if (didDragRef.current) {
      e.stopPropagation();
    }
  }, []);

  // ── Hotspot tap ────────────────────────────────────────────────────────────
  const handleHotspotTap = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  // ── CSS for hotspot hover state (inject once) ──────────────────────────────
  // We keep styles in a <style> tag because :hover pseudo-class isn't writable via inline styles
  const hotstyleId = 'hotspot-styles';
  useEffect(() => {
    if (document.getElementById(hotstyleId)) return;
    const tag = document.createElement('style');
    tag.id = hotstyleId;
    tag.textContent = `
      .hotspot:hover,
      .hotspot.pulsing {
        border-color: rgba(232,66,10,.7) !important;
        background: rgba(232,66,10,.12) !important;
        box-shadow: 0 0 0 3px rgba(232,66,10,.15), inset 0 0 12px rgba(232,66,10,.08);
      }
      .hotspot:hover .tap-badge,
      .hotspot.pulsing .tap-badge { opacity: 1 !important; }
      @keyframes fadeInLabel {
        from { opacity: 0; transform: translateY(3px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(tag);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const transformStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
    transformOrigin: '0 0',
    willChange: 'transform',
    position: 'relative',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Photo container – fixed size, overflow hidden, gesture target */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 20,
          background: '#1a1510',
          border: '1px solid #2a2520',
          touchAction: 'none',   // prevents browser scroll/zoom interfering
          cursor: scale > 1 ? 'grab' : 'default',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Zoom layer – everything here scales together */}
        <div style={transformStyle}>
          {/* Menu photo */}
          {menuPhoto && (
            <img
              ref={imgRef}
              src={menuPhoto}
              alt="Menu"
              onLoad={updateImgScale}
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            />
          )}

          {/* Hotspots */}
          {items.map((item) => (
            <Hotspot
              key={item.name_jp}
              item={item}
              scaleX={imgScaleX}
              scaleY={imgScaleY}
              showEnLabel={showEnOverlay}
              onTap={() => handleHotspotTap(item)}
            />
          ))}
        </div>

        {/* Zoom hint badge – OUTSIDE zoom-layer so it doesn't scale */}
        {showHint && scale === 1 && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 5,
              pointerEvents: 'none',
              background: 'rgba(46,41,36,0.88)',
              color: '#f7f2ea',
              fontSize: 12,
              fontWeight: 500,
              padding: '5px 12px',
              borderRadius: 20,
              letterSpacing: '.04em',
              backdropFilter: 'blur(4px)',
              animation: 'fadeInLabel .3s ease forwards',
            }}
          >
            🔍 Pinch to zoom
          </div>
        )}
      </div>

      {/* Dish detail popup (bottom sheet) – rendered outside photo-container
          so it can overflow beyond photo boundaries */}
      <DishPopup
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        currency={currency}
        exchangeRate={exchangeRate}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
