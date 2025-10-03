import { useEffect, useState } from 'react';
import { createMappingProfile, listMappingProfiles, MappingProfile } from '../client/api';

export function MappingProfilesPage() {
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [name, setName] = useState('Default');

  useEffect(() => {
    (async () => {
      const list = await listMappingProfiles();
      setProfiles(list);
    })();
  }, []);

  async function addProfile() {
    const created = await createMappingProfile({ name, owner: 'ops', fieldMappings: { A: 'a' } });
    setProfiles(p => [...p, created]);
    setName('');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input placeholder="Profile name" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={addProfile} disabled={!name}>Add</button>
      </div>
      <ul style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
        {profiles.map(p => (
          <li key={p.id} style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>
            {p.name} – owner: {p.owner}
          </li>
        ))}
      </ul>
    </div>
  );
}
