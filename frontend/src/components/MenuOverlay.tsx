import { useCallback, useEffect, useRef, useState } from 'react';
import DishPopup from './DishPopup';
import Hotspot from './Hotspot';
import { MenuItem, Currency, CurrencySymbol } from '../types';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_HINT_THRESHOLD = 6;
const ZOOM_HINT_DURATION_MS = 3000;
const TAP_MOVE_THRESHOLD = 8;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_ZOOM = 2.5;

interface MenuOverlayProps {
  items: MenuItem[];
  menuPhoto: string;
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
  currency?: Currency;
  exchangeRate?: number;
  currencySymbol?: CurrencySymbol;
  showEnOverlay?: boolean;
}

interface Point {
  x: number;
  y: number;
}

export default function MenuOverlay({
  items = [],
  menuPhoto,
  imageNaturalWidth,
  imageNaturalHeight,
  currency = 'USD',
  exchangeRate = 0.0067,
  currencySymbol = '$',
  showEnOverlay = false,
}: MenuOverlayProps) {
  // ── Transform state ──────────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  const scaleRef = useRef(1);
  const panRef = useRef<Point>({ x: 0, y: 0 });

  const syncTransform = useCallback((newScale: number, newPan: Point) => {
    scaleRef.current = newScale;
    panRef.current = newPan;
    setScale(newScale);
    setPan(newPan);
  }, []);

  // ── Zoom hint ────────────────────────────────────────────────────────────────
  const [showHint, setShowHint] = useState(items.length > ZOOM_HINT_THRESHOLD);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (items.length > ZOOM_HINT_THRESHOLD) {
      setShowHint(true);
      hintTimerRef.current = setTimeout(() => setShowHint(false), ZOOM_HINT_DURATION_MS);
    }
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [items.length]);

  function dismissHint() {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setShowHint(false);
  }

  // ── Popup state ──────────────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // ── Image scale ──────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgScaleX, setImgScaleX] = useState(1);
  const [imgScaleY, setImgScaleY] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);

  const updateImgScale = useCallback(() => {
    if (!containerRef.current) return;
    const natW = imageNaturalWidth ?? imgRef.current?.naturalWidth;
    const natH = imageNaturalHeight ?? imgRef.current?.naturalHeight;
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

  // ── Pan clamping ─────────────────────────────────────────────────────────────
  function clampPan(x: number, y: number, s: number): Point {
    const el = containerRef.current;
    if (!el) return { x, y };
    const w = el.clientWidth;
    const h = el.clientHeight;
    return {
      x: Math.min(0, Math.max(x, w * (1 - s))),
      y: Math.min(0, Math.max(y, h * (1 - s))),
    };
  }

  // ── Gesture tracking refs ────────────────────────────────────────────────────
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{
    type: 'pan' | 'pinch' | null;
    prevDist: number | null;
    totalMove: number;
  }>({ type: null, prevDist: null, totalMove: 0 });
  const lastTapRef = useRef<{ time: number } & Point>({ time: 0, x: 0, y: 0 });
  const didDragRef = useRef(false);

  function getContainerCoords(e: React.PointerEvent): Point {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Pointer handlers ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
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
      didDragRef.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pos = getContainerCoords(e);
      const prevPos = pointersRef.current.get(e.pointerId);
      if (!prevPos) return;

      pointersRef.current.set(e.pointerId, pos);
      const { type } = gestureRef.current;

      if (type === 'pan' && pointersRef.current.size === 1) {
        const dx = pos.x - prevPos.x;
        const dy = pos.y - prevPos.y;
        gestureRef.current.totalMove += Math.abs(dx) + Math.abs(dy);
        if (gestureRef.current.totalMove > TAP_MOVE_THRESHOLD) didDragRef.current = true;

        if (scaleRef.current > 1) {
          const newPan = clampPan(panRef.current.x + dx, panRef.current.y + dy, scaleRef.current);
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
        const newScale = Math.min(Math.max(prevS * (currentDist / prevDist), MIN_SCALE), MAX_SCALE);
        const newPanX = midX * (1 - newScale / prevS) + panRef.current.x * (newScale / prevS);
        const newPanY = midY * (1 - newScale / prevS) + panRef.current.y * (newScale / prevS);
        syncTransform(newScale, clampPan(newPanX, newPanY, newScale));

        gestureRef.current.prevDist = currentDist;
        dismissHint();
      }
    },
    [syncTransform], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const pos = getContainerCoords(e);
      const activeCount = pointersRef.current.size;

      if (activeCount === 1 && !didDragRef.current) {
        const now = Date.now();
        const last = lastTapRef.current;
        const dist = Math.hypot(pos.x - last.x, pos.y - last.y);

        if (now - last.time < DOUBLE_TAP_MS && dist < 30) {
          if (Math.abs(scaleRef.current - 1) < 0.15) {
            const ns = DOUBLE_TAP_ZOOM;
            syncTransform(ns, clampPan(pos.x * (1 - ns), pos.y * (1 - ns), ns));
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

      if (pointersRef.current.size === 1) {
        gestureRef.current.type = 'pan';
        gestureRef.current.totalMove = 0;
        didDragRef.current = false;
      } else if (pointersRef.current.size === 0) {
        gestureRef.current.type = null;
      }
    },
    [syncTransform], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) e.stopPropagation();
  }, []);

  // ── Hotspot hover CSS (injected once) ────────────────────────────────────────
  const hotstyleId = 'hotspot-styles';
  useEffect(() => {
    if (document.getElementById(hotstyleId)) return;
    const tag = document.createElement('style');
    tag.id = hotstyleId;
    tag.textContent = `
      .hotspot:hover, .hotspot.pulsing {
        border-color: rgba(232,66,10,.7) !important;
        background: rgba(232,66,10,.12) !important;
        box-shadow: 0 0 0 3px rgba(232,66,10,.15), inset 0 0 12px rgba(232,66,10,.08);
      }
      .hotspot:hover .tap-badge, .hotspot.pulsing .tap-badge { opacity: 1 !important; }
      @keyframes fadeInLabel {
        from { opacity: 0; transform: translateY(3px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(tag);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  const transformStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
    transformOrigin: '0 0',
    willChange: 'transform',
    position: 'relative',
    userSelect: 'none',
  };

  return (
    <div style={{ position: 'relative' }}>
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
          touchAction: 'none',
          cursor: scale > 1 ? 'grab' : 'default',
          userSelect: 'none',
        }}
      >
        <div style={transformStyle}>
          {menuPhoto && (
            <img
              ref={imgRef}
              src={menuPhoto}
              alt="Menu"
              onLoad={updateImgScale}
              draggable={false}
              style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }}
            />
          )}
          {items.map((item) => (
            <Hotspot
              key={item.name_jp}
              item={item}
              scaleX={imgScaleX}
              scaleY={imgScaleY}
              showEnLabel={showEnOverlay}
              onTap={() => setSelectedItem(item)}
            />
          ))}
        </div>

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
            }}
          >
            🔍 Pinch to zoom
          </div>
        )}
      </div>

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
