import { useEffect, useState, useMemo } from 'react';
import { getBacklog, seedDemoData, BacklogItem } from '../client/api';
import { classifyProcedure, GROUP_LABELS, GROUP_ORDER, GROUP_COLORS, ProcedureGroupKey } from './procedureGroups';

export function BacklogPage({
  search = '',
  onSelect,
  selectedId,
  pendingIds = [],
  onConfirm,
  hiddenIds = [],
  canConfirm = true,
}: {
  search?: string;
  onSelect?: (item: BacklogItem) => void;
  selectedId?: string;
  pendingIds?: string[];
  onConfirm?: (item: BacklogItem) => void;
  hiddenIds?: string[];
  canConfirm?: boolean;
}) {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await seedDemoData();
      const data = await getBacklog();
      setItems(data);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      items
        .filter((i) => (i.patientName + ' ' + i.procedure).toLowerCase().includes(search.toLowerCase()))
        .filter((i) => !hiddenIds.includes(i.id)),
    [items, search, hiddenIds]
  );

  const grouped = useMemo(() => {
    const map = new Map<ProcedureGroupKey, BacklogItem[]>();
    for (const key of GROUP_ORDER) map.set(key, []);
    for (const it of filtered) {
      const key = classifyProcedure(it.procedure);
      map.set(key, [...(map.get(key) || []), it]);
    }
    return map;
  }, [filtered]);

  if (loading) return <div>Loading backlog…</div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <span style={{ opacity: 0.6 }}>
          {filtered.length} of {items.length}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GROUP_ORDER.length}, minmax(220px, 1fr))`,
          gap: 12,
          alignItems: 'start',
        }}
      >
        {GROUP_ORDER.map((key) => {
          const list = grouped.get(key) || [];
          return (
            <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              <div
                style={{
                  padding: '8px 10px',
                  fontWeight: 600,
                  background: GROUP_COLORS[key],
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {GROUP_LABELS[key]} <span style={{ opacity: 0.6 }}>({list.length})</span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.length === 0 ? (
                  <div style={{ opacity: 0.6, fontSize: 12 }}>No items</div>
                ) : (
                  list.map((i) => (
                    <div
                      key={i.id}
                      draggable
                      onDragStart={(e) => {
                        const payload = { itemId: i.id, estDurationMin: i.estDurationMin, surgeonId: i.surgeonId };
                        const text = JSON.stringify(payload);
                        try { e.dataTransfer.setData('application/json', text); } catch {}
                        try { e.dataTransfer.setData('text/plain', text); } catch {}
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      onClick={() => onSelect?.(i)}
                      style={{
                        border: selectedId === i.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: 8,
                        background: '#fafafa',
                        cursor: onSelect ? 'pointer' : 'default',
                      }}
                      title={onSelect ? 'Click to select' : undefined}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{i.patientName}</strong>
                        <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>{i.maskedMrn}</span>
                      </div>
                      <div style={{ opacity: 0.8 }}>{i.procedure}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{i.estDurationMin} min</div>
                      {pendingIds.includes(i.id) && canConfirm && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input id={`confirm-${i.id}`} type="checkbox" onChange={() => onConfirm?.(i)} />
                          <label htmlFor={`confirm-${i.id}`} style={{ fontSize: 12 }}>
                            Awaiting confirmation — tick to remove from Dashboard
                          </label>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
