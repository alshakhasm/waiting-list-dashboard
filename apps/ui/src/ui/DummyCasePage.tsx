import { useState } from 'react';
import { createBacklogItem, createSchedule } from '../client/api';

const SURGEONS = ['s:1', 's:2', 's:3'];
const PROCEDURES = ['Appendectomy', 'Cholecystectomy', 'CABG', 'Knee replacement', 'Hip replacement'];
const PREFIXES = ['John', 'Jane', 'Alex', 'Sam', 'Jordan', 'Case'];

function randomChoice<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function randomName() {
  return `${randomChoice(PREFIXES)} ${Math.floor(Math.random() * 900 + 100)}`;
}

function randomMrn() {
  return String(Math.floor(Math.random() * 9_000_000 + 1_000_000));
}

export function DummyCasePage() {
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function addDummy() {
    setCreating(true);
    setStatus(null);
    try {
      const patientName = randomName();
      const mrn = randomMrn();
      const procedure = randomChoice(PROCEDURES);
      const surgeonId = randomChoice(SURGEONS);
      const estDurationMin = 60;

      const backlog = await createBacklogItem({
        patientName,
        mrn,
        procedure,
        estDurationMin,
        surgeonId,
      });

      const baseDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      baseDate.setUTCHours(0, 0, 0, 0);
      const slotStartHour = 8 + Math.floor(Math.random() * 6); // between 8 and 13
      const start = new Date(baseDate);
      start.setUTCHours(slotStartHour, 0, 0, 0);
      const end = new Date(start.getTime() + estDurationMin * 60000);
      const date = baseDate.toISOString().slice(0, 10);

      await createSchedule({
        waitingListItemId: backlog.id,
        roomId: 'or:1',
        surgeonId: backlog.surgeonId || surgeonId,
        date,
        startTime: `${String(start.getUTCHours()).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')}`,
        endTime: `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`,
        notes: 'Auto-generated dummy case',
      });

      setStatus(`Added dummy case for ${patientName} (${procedure})`);
    } catch (e: any) {
      setStatus(e?.message || 'Failed to add dummy case');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
      <h2 style={{ margin: 0 }}>Random Dummy Case</h2>
      <p style={{ opacity: 0.8 }}>
        Generates a backlog entry plus a scheduled slot for today. Use this to quickly seed test data.
      </p>
      <button onClick={addDummy} disabled={creating} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer' }}>
        {creating ? 'Adding…' : 'Add dummy case'}
      </button>
      {status && (
        <div style={{ fontSize: 12, opacity: 0.85 }}>{status}</div>
      )}
    </div>
  );
}
