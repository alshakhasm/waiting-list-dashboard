import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  initialLeft?: number; // percentage 0-100
  minLeft?: number;
  maxLeft?: number;
  left: React.ReactNode;
  right: React.ReactNode;
  style?: React.CSSProperties;
};

const STORAGE_KEY = 'schedule-split-left-pct';

export function SplitPane({ initialLeft = 35, minLeft = 20, maxLeft = 80, left, right, style }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Initialize from localStorage or props
  const [leftPct, setLeftPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if (Number.isFinite(parsed) && parsed >= minLeft && parsed <= maxLeft) {
          return parsed;
        }
      }
    } catch {
      // localStorage not available or error reading
    }
    return initialLeft;
  });
  const dragging = useRef(false);

  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.currentTarget as HTMLElement).ownerDocument.body.style.cursor = 'col-resize';
  }, []);

  const onUp = useCallback((_e: MouseEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
  }, []);

  const onMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const clamped = Math.min(maxLeft, Math.max(minLeft, pct));
    setLeftPct(clamped);
  }, [minLeft, maxLeft]);

  // Persist split position to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(leftPct));
    } catch {
      // localStorage not available - silently fail
    }
  }, [leftPct]);

  // Handle keyboard reset
  const handleDividerDoubleClick = useCallback(() => {
    setLeftPct(initialLeft);
  }, [initialLeft]);

  useEffect(() => {
    const doc = window.document;
    doc.addEventListener('mousemove', onMove);
    doc.addEventListener('mouseup', onUp);
    return () => {
      doc.removeEventListener('mousemove', onMove);
      doc.removeEventListener('mouseup', onUp);
    };
  }, [onMove, onUp]);

  const [dividerHovered, setDividerHovered] = useState(false);

  return (
    <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: `${leftPct}% 6px ${100 - leftPct}%`, width: '100%', height: '100%', ...style }}>
      <div style={{ minWidth: 0, overflow: 'auto' }}>{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onDown}
        onDoubleClick={handleDividerDoubleClick}
        onMouseEnter={() => setDividerHovered(true)}
        onMouseLeave={() => setDividerHovered(false)}
        style={{
          cursor: 'col-resize',
          background: dividerHovered ? '#d1d5db' : '#e5e7eb',
          width: 6,
          transition: 'background 200ms ease',
          userSelect: 'none',
        }}
        title="Drag to resize, double-click to reset"
      />
      <div style={{ minWidth: 0, overflow: 'auto' }}>{right}</div>
    </div>
  );
}
