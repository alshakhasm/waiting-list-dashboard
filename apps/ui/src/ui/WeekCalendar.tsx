import { useMemo, useRef, useState } from 'react';
import type { ScheduleEntry } from '../client/api';

type Props = {
  date: string; // ISO YYYY-MM-DD within target week
  entries: ScheduleEntry[];
  startHour?: number;
  endHour?: number;
  onDrop?: (info: { date: string; startTime: string; endTime: string; data: any }) => void;
  onDragStateChange?: (_dragging: boolean) => void;
};

function getWeekStart(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function WeekCalendar({ date, entries, startHour = 8, endHour = 18, onDrop }: Props) {
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ dayIdx: number; topPct: number; heightPct: number; startTime: string; endTime: string } | null>(null);
  const dayRefs = useRef<Array<HTMLDivElement | null>>([]);
  const week = useMemo(() => {
    const d = new Date(date + 'T00:00:00');
    const monday = getWeekStart(d);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const nd = new Date(monday);
      nd.setDate(monday.getDate() + i);
      days.push(formatISO(nd));
    }
    return days;
  }, [date]);

  const hours: number[] = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  // const rangeMinutes = (endHour - startHour) * 60; // unused
  const rowHeight = 48; // px per hour row

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!onDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function updateGhost(e: React.DragEvent<HTMLDivElement>, dayIdx: number) {
    if (!onDrop || !dayRefs.current[dayIdx]) return;
    const columnEl = dayRefs.current[dayIdx]!;
    const rect = columnEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
  const totalMins = (endHour - startHour) * 60;
  const startMRaw = Math.floor((y / Math.max(1, rect.height)) * totalMins);
    const snap = 15; // snap to 15-minute increments for easier targeting
    const startM = Math.floor(startMRaw / snap) * snap;
    const dur = 60;
    const endM = Math.min(totalMins, startM + dur);
  const topPx = (startM / 60) * rowHeight; // px from top of column
  const heightPx = Math.max(8, ((endM - startM) / 60) * rowHeight);
    const hh = Math.floor(startM / 60) + startHour;
    const mm = startM % 60;
    const eh = Math.floor(endM / 60) + startHour;
    const em = endM % 60;
    const startTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    setGhost({ dayIdx, topPct: topPx, heightPct: heightPx, startTime, endTime });
  }

  function dropToTime(e: React.DragEvent<HTMLDivElement>, dayISO: string, dayIdx: number) {
    if (!onDrop) return;
    e.preventDefault();
    let payloadStr = e.dataTransfer.getData('application/json');
  if (!payloadStr) payloadStr = e.dataTransfer.getData('text/plain');
    let data: any = null;
    try { data = JSON.parse(payloadStr); } catch {}
    if (!data || !data.itemId) {
      console.warn('[DnD] Missing or invalid payload on drop:', payloadStr);
      window.alert?.('Drag payload missing — try dragging the card again');
      return;
    }
    const columnEl = dayRefs.current[dayIdx]!;
    const rect = columnEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = Math.max(0, Math.min(1, y / rect.height));
    const totalMins = (endHour - startHour) * 60;
  const snap = 15;
  const startM = Math.floor((totalMins * pct) / snap) * snap;
    const dur = Math.max(30, Math.min(240, (data?.estDurationMin ?? 60))); // clamp 30–240
    const endM = Math.min(totalMins, startM + dur);
    const hh = Math.floor(startM / 60) + startHour;
    const mm = startM % 60;
    const eh = Math.floor(endM / 60) + startHour;
    const em = endM % 60;
    const startTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    onDrop({ date: dayISO, startTime, endTime, data });
    setGhost(null);
    setDragDay(null);
  }

  function handleRootDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Ensure the browser knows we can drop anywhere in the grid
    e.preventDefault();
  }

  function handleRootDrop(e: React.DragEvent<HTMLDivElement>) {
    if (!onDrop) return;
    e.preventDefault();
    e.stopPropagation();
    // Attempt to parse payload
    const payloadStr = e.dataTransfer.getData('application/json')
      || e.dataTransfer.getData('text/plain')
      || e.dataTransfer.getData('text');
    let data: any = null;
    try { data = JSON.parse(payloadStr); } catch {}
    if (!data || !data.itemId) {
      console.warn('[DnD] Root drop: missing payload', payloadStr);
      window.alert?.('Drag payload missing — try dragging the card again');
      return;
    }
    // Determine day index using actual day column rects
    let di = 0;
    for (let idx = 0; idx < dayRefs.current.length; idx++) {
      const col = dayRefs.current[idx];
      if (!col) continue;
      const r = col.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right) { di = idx; break; }
    }
    const colRect = dayRefs.current[di]?.getBoundingClientRect();
    if (!colRect) return;
    // Ignore drops on the date header (above the time grid)
    if (e.clientY < colRect.top) {
      window.alert?.('Drop inside the time grid (below the date header) to place the entry.');
      return;
    }
    // Compute time by Y position relative to the day column
    const totalMins = (endHour - startHour) * 60;
    const y = e.clientY - colRect.top;
    const pct = Math.max(0, Math.min(1, y / Math.max(1, colRect.height)));
    const startM = Math.floor(totalMins * pct);
    const dur = Math.max(30, Math.min(240, (data?.estDurationMin ?? 60)));
    const endM = Math.min(totalMins, startM + dur);
    const hh = Math.floor(startM / 60) + startHour;
    const mm = startM % 60;
    const eh = Math.floor(endM / 60) + startHour;
    const em = endM % 60;
    const startTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    const dayISO = week[di];
    onDrop({ date: dayISO, startTime, endTime, data });
    setGhost(null);
    setDragDay(null);
  }

  return (
    <div
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
      style={{
        display: 'grid',
        gridTemplateColumns: `80px repeat(7, 1fr)`,
        gridTemplateRows: `32px repeat(${hours.length}, ${rowHeight}px)`,
        borderTop: '1px solid #e5e7eb',
        height: '100%',
      }}
    >
      {/* Header */}
      <div />
      {week.map((d) => (
        <div key={d} style={{ padding: 8, borderLeft: '1px solid #e5e7eb', fontWeight: 600 }}>{d}</div>
      ))}
      {/* Body */}
      {hours.map((h, idx) => (
        <>
          <div key={`h-${h}`} style={{ borderTop: '1px dashed #e5e7eb', padding: '2px 4px', fontVariantNumeric: 'tabular-nums', height: rowHeight }}>{String(h).padStart(2, '0')}:00</div>
          {week.map((d, di) => (
            <div
              key={`cell-${idx}-${di}`}
              onDragOver={handleDragOver}
              ref={() => { /* placeholder to keep structure; handled on parent overlay */ }}
              style={{ borderTop: '1px dashed #e5e7eb', borderLeft: '1px solid #f3f4f6', position: 'relative', height: rowHeight }}
            />
          ))}
        </>
      ))}

      {/* Drop overlays per day column */}
      {week.map((d, di) => (
        <div
          key={`overlay-${di}`}
          ref={(el) => (dayRefs.current[di] = el)}
          style={{
            gridColumn: di + 2,
            gridRow: '2 / -1',
            position: 'relative',
            outline: dragDay === di ? '2px solid #93c5fd' : undefined,
            zIndex: 2,
            minHeight: '100%',
            pointerEvents: 'auto',
          }}
          onDragEnter={() => setDragDay(di)}
          onDragLeave={() => { if (dragDay === di) setDragDay(null); setGhost(null); }}
          onDragOver={(e) => { handleDragOver(e); updateGhost(e, di); }}
          onDrop={(e) => dropToTime(e as any, d, di)}
        >
          {ghost && ghost.dayIdx === di && (
            <>
              <div style={{ position: 'absolute', left: 6, right: 6, top: ghost.topPct, height: ghost.heightPct, background: 'rgba(59,130,246,0.15)', border: '1px dashed #3b82f6', borderRadius: 6 }} />
              <div style={{ position: 'absolute', top: ghost.topPct - 16, left: 8, padding: '2px 6px', fontSize: 11, background: '#111827', color: 'white', borderRadius: 4 }}>
                {ghost.startTime} → {ghost.endTime}
              </div>
            </>
          )}
        </div>
      ))}

      {/* Entries */}
      {entries.map((e) => {
        const dayIdx = week.indexOf(e.date);
        if (dayIdx === -1) return null;
  const startM = toMinutes(e.startTime) - startHour * 60;
  const endM = toMinutes(e.endTime) - startHour * 60;
  const topPx = Math.max(0, (startM / 60) * rowHeight);
  const heightPx = Math.max(8, ((endM - startM) / 60) * rowHeight);
        const isOperated = e.status === 'operated';
        const isConfirmed = isOperated || e.status === 'confirmed';
        const cardBg = isOperated ? '#DCFCE7' : isConfirmed ? '#E6F4EA' : '#FEF3C7';
        const borderColor = isOperated ? '#16a34a' : isConfirmed ? '#84cc16' : '#F59E0B';
        return (
          <div
            key={e.id}
            style={{
              gridColumn: dayIdx + 2,
              gridRow: '2 / -1', // overlay over all body rows
              position: 'relative',
              zIndex: 3,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: topPx,
                left: 6,
                right: 6,
                height: heightPx,
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 6,
                padding: 6,
                fontSize: 12,
                overflow: 'hidden',
              }}
              title={`OR ${e.roomId} ${e.startTime}-${e.endTime}`}
            >
              <div style={{ fontWeight: 600 }}>OR {e.roomId}</div>
              <div style={{ opacity: 0.8 }}>
                {e.startTime}–{e.endTime}{' '}
                {!isConfirmed && <em style={{ color: '#92400e' }}>(tentative)</em>}
                {isOperated && <em style={{ color: '#047857', marginLeft: 4 }}>(operated)</em>}
              </div>
              <div style={{ opacity: 0.7 }}>Surgeon {e.surgeonId}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
