import { useMemo, useRef, useState } from 'react';
import type { ScheduleEntry } from '../client/api';

type Props = {
  date: string; // ISO YYYY-MM-DD within target week
  entries: ScheduleEntry[];
  startHour?: number;
  endHour?: number;
  onDrop?: (info: { date: string; startTime: string; endTime: string; data: any }) => void;
  onDragStateChange?: (dragging: boolean) => void;
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
  const [ghost, setGhost] = useState<{ dayIdx: number; topPct: number; heightPct: number } | null>(null);
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

  const rangeMinutes = (endHour - startHour) * 60;

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
    const pct = Math.max(0, Math.min(1, y / rect.height));
    const totalMins = (endHour - startHour) * 60;
    const startM = Math.floor(totalMins * pct);
    const dur = 60;
    const endM = Math.min(totalMins, startM + dur);
    const topPct = (startM / totalMins) * 100;
    const heightPct = Math.max(2, ((endM - startM) / totalMins) * 100);
    setGhost({ dayIdx, topPct, heightPct });
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
    const startM = Math.floor(totalMins * pct);
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

  return (
    <div
      onDragOver={handleRootDragOver}
      style={{ display: 'grid', gridTemplateColumns: `80px repeat(7, 1fr)`, borderTop: '1px solid #e5e7eb', height: '100%' }}
    >
      {/* Header */}
      <div />
      {week.map((d) => (
        <div key={d} style={{ padding: 8, borderLeft: '1px solid #e5e7eb', fontWeight: 600 }}>{d}</div>
      ))}
      {/* Body */}
      {hours.map((h, idx) => (
        <>
          <div key={`h-${h}`} style={{ borderTop: '1px dashed #e5e7eb', padding: '2px 4px', fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}:00</div>
          {week.map((d, di) => (
            <div
              key={`cell-${idx}-${di}`}
              onDragOver={handleDragOver}
              ref={el => { /* placeholder to keep structure; handled on parent overlay */ }}
              style={{ borderTop: '1px dashed #e5e7eb', borderLeft: '1px solid #f3f4f6', position: 'relative' }}
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
            <div style={{ position: 'absolute', left: 6, right: 6, top: `${ghost.topPct}%`, height: `${ghost.heightPct}%`, background: 'rgba(59,130,246,0.15)', border: '1px dashed #3b82f6', borderRadius: 6 }} />
          )}
        </div>
      ))}

      {/* Entries */}
      {entries.map((e) => {
        const dayIdx = week.indexOf(e.date);
        if (dayIdx === -1) return null;
        const startM = toMinutes(e.startTime) - startHour * 60;
        const endM = toMinutes(e.endTime) - startHour * 60;
        const topPct = Math.max(0, (startM / rangeMinutes) * 100);
        const heightPct = Math.max(2, ((endM - startM) / rangeMinutes) * 100);
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
                top: `${topPct}%`,
                left: 6,
                right: 6,
                height: `${heightPct}%`,
                background: e.status === 'confirmed' ? '#E6F4EA' : '#FEF3C7',
                border: `1px solid ${e.status === 'confirmed' ? '#84cc16' : '#F59E0B'}`,
                borderRadius: 6,
                padding: 6,
                fontSize: 12,
                overflow: 'hidden',
              }}
              title={`OR ${e.roomId} ${e.startTime}-${e.endTime}`}
            >
              <div style={{ fontWeight: 600 }}>OR {e.roomId}</div>
              <div style={{ opacity: 0.8 }}>{e.startTime}–{e.endTime} {e.status !== 'confirmed' && <em style={{ color: '#92400e' }}>(tentative)</em>}</div>
              <div style={{ opacity: 0.7 }}>Surgeon {e.surgeonId}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
