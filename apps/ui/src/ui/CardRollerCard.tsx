import { BacklogItem } from '../client/api';
import { classifyProcedure, GROUP_LABELS } from './procedureGroups';

export function CardRollerCard({ item, onEdit, onSchedule, onRemove }: {
  item: BacklogItem;
  onEdit: (item: BacklogItem) => void;
  onSchedule: (item: BacklogItem) => void;
  onRemove: (item: BacklogItem) => void;
}) {
  const categoryKey = item.categoryKey || classifyProcedure(item.procedure);
  const categoryLabel = GROUP_LABELS[categoryKey];
  const created = item.createdAt ? new Date(item.createdAt) : null;
  const createdFmt = created ? created.toLocaleDateString() + ' ' + created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 0, padding: 24, background: 'var(--surface-1)', color: 'var(--text)', boxShadow: '0 10px 30px var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>{item.patientName}</h2>
        <div style={{ fontSize: 14, opacity: 0.7 }}>{item.maskedMrn}</div>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 18, marginBottom: 8 }}><strong>Procedure:</strong> {item.procedure}</div>
          <div style={{ fontSize: 15, opacity: 0.9, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 10 }}>
            <div><strong>MRN:</strong> {item.mrn}</div>
            <div><strong>Category:</strong> {categoryLabel}</div>
            <div><strong>Case:</strong> {item.caseTypeId}</div>
            <div><strong>Surgeon:</strong> {item.surgeonId || '—'}</div>
            <div><strong>Est. duration:</strong> {item.estDurationMin} min</div>
            {createdFmt && <div><strong>Created:</strong> {createdFmt}</div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 15, opacity: 0.9, display: 'grid', gap: 8 }}>
            <div><strong>Phone 1:</strong> {item.phone1 ? (<a href={`tel:${item.phone1}`}>{item.phone1}</a>) : '—'}</div>
            <div><strong>Phone 2:</strong> {item.phone2 ? (<a href={`tel:${item.phone2}`}>{item.phone2}</a>) : '—'}</div>
            <div><strong>Preferred date:</strong> {item.preferredDate || '—'}</div>
          </div>
          {item.notes && (
            <div style={{ marginTop: 10, fontSize: 15, whiteSpace: 'pre-wrap' }}>
              <strong>Notes:</strong> {item.notes}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <button
          onClick={() => onEdit(item)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          Edit
        </button>
        <button
          onClick={() => onSchedule(item)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          Schedule
        </button>
        <button
          onClick={() => onRemove(item)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            background: 'var(--surface-2)',
            color: 'var(--danger)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
