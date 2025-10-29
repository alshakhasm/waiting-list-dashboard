import { useEffect, useMemo, useState } from 'react';
import { AppUser, getCurrentAppUser, listMembers } from '../client/api';
import { IntakeLink, listIntakeLinks, createIntakeLink, updateIntakeLink, deleteIntakeLink, getIntakeShareUrl } from '../client/api';

export function IntakeLinksPage() {
  const [me, setMe] = useState<AppUser | null>(null);
  const [owners, setOwners] = useState<AppUser[]>([]);
  const [links, setLinks] = useState<IntakeLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>('mine'); // 'mine' | 'all' | userId

  // New l ink form
  const [label, setLabel] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string>('');
  const [defaultCategoryKey, setDefaultCategoryKey] = useState<string>('');
  const [defaultCaseTypeId, setDefaultCaseTypeId] = useState<string>('case:elective');
  const [defaultSurgeonId, setDefaultSurgeonId] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const meUser = await getCurrentAppUser();
        setMe(meUser);
        const members = await listMembers();
        setOwners(members.filter(m => m.role === 'owner'));
        if (meUser) setOwnerUserId(meUser.userId);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
  }, []);

  async function refresh() {
    try {
      setError(null);
      let ownerScope: { ownerUserId?: string | 'all' } = {};
      if (filterOwner === 'all') ownerScope = { ownerUserId: 'all' };
      else if (filterOwner === 'mine' && me?.userId) ownerScope = { ownerUserId: me.userId };
      else if (filterOwner && filterOwner !== 'mine') ownerScope = { ownerUserId: filterOwner };
      const list = await listIntakeLinks(ownerScope);
      setLinks(list);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  useEffect(() => { refresh(); }, [filterOwner, me?.userId]);

  const isOwner = me?.role === 'owner';

  async function onCreate() {
    if (!isOwner || !ownerUserId) return;
    try {
      setError(null); setInfo(null);
      const cat = (['dental','minorPath','majorPath','tmj','orthognathic','uncategorized'] as const).includes(defaultCategoryKey as any)
        ? (defaultCategoryKey as any)
        : undefined;
      const link = await createIntakeLink({
        label: label.trim() || undefined,
        ownerUserId,
        defaultCategoryKey: cat,
        defaultCaseTypeId: defaultCaseTypeId || undefined,
        defaultSurgeonId: defaultSurgeonId || undefined,
      });
      setInfo(`Created: ${getIntakeShareUrl(link.token)}`);
      setLabel('');
      refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function onToggleActive(id: string, active: boolean) {
    try { await updateIntakeLink(id, { active }); refresh(); } catch (e: any) { setError(e?.message || String(e)); }
  }

  async function onSaveDefaults(id: string, patch: Partial<{ label: string; defaultCategoryKey: string | null; defaultCaseTypeId: string | null; defaultSurgeonId: string | null; ownerUserId: string }>) {
    try { await updateIntakeLink(id, patch as any); refresh(); } catch (e: any) { setError(e?.message || String(e)); }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this intake link? This cannot be undone.')) return;
    try {
      setError(null);
      await deleteIntakeLink(id);
      refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2>Intake Links</h2>
      {!isOwner && (
        <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #f59e0b', padding: '6px 8px', borderRadius: 6 }}>
          Owner access required to create or modify intake links.
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>Filter:</label>
        <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
          <option value="mine">Mine</option>
          <option value="all">All owners</option>
          {owners.map(o => (
            <option key={o.userId} value={o.userId}>{o.email}</option>
          ))}
        </select>
      </div>

      {/* Create */}
      <fieldset style={{ border: '1px solid var(--border)', padding: 12, borderRadius: 8 }}>
        <legend>Create link</legend>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
            <option value="">Select owner</option>
            {owners.map(o => (
              <option key={o.userId} value={o.userId}>{o.email}</option>
            ))}
          </select>
          <select value={defaultCategoryKey} onChange={(e) => setDefaultCategoryKey(e.target.value)}>
            <option value="">Category (optional)</option>
            <option value="dental">Dental extraction</option>
            <option value="minorPath">Minor pathology</option>
            <option value="majorPath">Major pathology</option>
            <option value="tmj">TMJ</option>
            <option value="orthognathic">Orthognathic</option>
            <option value="uncategorized">Uncategorized</option>
          </select>
          <select value={defaultCaseTypeId} onChange={(e) => setDefaultCaseTypeId(e.target.value)}>
            <option value="case:elective">Elective</option>
            <option value="case:urgent">Urgent</option>
            <option value="case:emergency">Emergency</option>
          </select>
          <input placeholder="Default surgeon ID (optional)" value={defaultSurgeonId} onChange={(e) => setDefaultSurgeonId(e.target.value)} />
          <button onClick={onCreate} disabled={!isOwner || !ownerUserId}>Create</button>
        </div>
        {info && <div style={{ fontSize: 12, color: '#155e75', marginTop: 6 }}>{info}</div>}
        {error && <div style={{ fontSize: 12, color: '#9f1239', marginTop: 6 }}>{error}</div>}
      </fieldset>

      {/* List */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Label</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Token</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Defaults</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Owner</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Created</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Active</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map(l => (
            <tr key={l.id}>
              <td>
                <input
                  value={l.label || ''}
                  onChange={(e) => onSaveDefaults(l.id, { label: e.target.value })}
                  placeholder="optional label"
                />
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <code style={{ fontSize: 12 }}>{l.token.slice(0, 8)}…</code>
                  <button onClick={() => { navigator.clipboard.writeText(getIntakeShareUrl(l.token)); setInfo('Copied link to clipboard'); }}>Copy link</button>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={l.defaultCategoryKey || ''}
                    onChange={(e) => onSaveDefaults(l.id, { defaultCategoryKey: e.target.value || null })}
                  >
                    <option value="">Category</option>
                    <option value="dental">Dental</option>
                    <option value="minorPath">Minor path</option>
                    <option value="majorPath">Major path</option>
                    <option value="tmj">TMJ</option>
                    <option value="orthognathic">Orthognathic</option>
                    <option value="uncategorized">Uncategorized</option>
                  </select>
                  <select
                    value={l.defaultCaseTypeId || ''}
                    onChange={(e) => onSaveDefaults(l.id, { defaultCaseTypeId: e.target.value || null })}
                  >
                    <option value="">Case type</option>
                    <option value="case:elective">Elective</option>
                    <option value="case:urgent">Urgent</option>
                    <option value="case:emergency">Emergency</option>
                  </select>
                  <input
                    placeholder="Surgeon ID"
                    value={l.defaultSurgeonId || ''}
                    onChange={(e) => onSaveDefaults(l.id, { defaultSurgeonId: e.target.value || null })}
                    style={{ width: 120 }}
                  />
                </div>
              </td>
              <td>
                <select
                  value={l.createdBy}
                  onChange={(e) => onSaveDefaults(l.id, { ownerUserId: e.target.value })}
                >
                  {owners.map(o => (
                    <option key={o.userId} value={o.userId}>{o.email}</option>
                  ))}
                </select>
              </td>
              <td style={{ fontSize: 12, opacity: 0.8 }}>
                {new Date(l.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </td>
              <td>
                <input type="checkbox" checked={l.active} onChange={(e) => onToggleActive(l.id, e.target.checked)} />
              </td>
              <td>
                <a href={getIntakeShareUrl(l.token)} target="_blank" rel="noreferrer">Open</a>
                {' | '}
                <button onClick={() => onDelete(l.id)} style={{ background: 'none', border: 'none', color: '#d97706', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
