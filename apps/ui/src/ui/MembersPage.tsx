import { useEffect, useMemo, useState } from 'react';
import { AppUser, Invitation, getCurrentAppUser, inviteByEmail, listInvitations, listMembers, updateMember } from '../client/api';

export function MembersPage() {
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState<AppUser[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [me, setMe] = useState<AppUser | null>(null);
  const isOwner = me?.role === 'owner';
  const [statusFilter, setStatusFilter] = useState<'all' | AppUser['status']>('all');
  const [memberSearch, setMemberSearch] = useState('');

  async function refresh() {
    try {
      setError(null);
      const [m, i] = await Promise.all([listMembers(), listInvitations()]);
      setMembers(m);
      setInvites(i);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  useEffect(() => { refresh(); (async () => { try { setMe(await getCurrentAppUser()); } catch {} })(); }, []);

  async function invite() {
    try {
      setError(null); setInfo(null);
      const inv = await inviteByEmail(email);
      setInfo(`Invite created. Share this link: ${window.location.origin}?accept=1&token=${inv.token}`);
      setEmail('');
      refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function approve(userId: string) {
    try { await updateMember(userId, { status: 'approved' }); refresh(); } catch (e: any) { setError(e?.message || String(e)); }
  }
  async function revoke(userId: string) {
    try { await updateMember(userId, { status: 'revoked' }); refresh(); } catch (e: any) { setError(e?.message || String(e)); }
  }
  async function pend(userId: string) {
    try { await updateMember(userId, { status: 'pending' }); refresh(); } catch (e: any) { setError(e?.message || String(e)); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2>Members</h2>
      {!isOwner && (
        <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #f59e0b', padding: '6px 8px', borderRadius: 6 }}>
          Owner access required to invite and change member status. You can still view the list below.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Invite email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={invite} disabled={!email || !isOwner}>Invite</button>
        <span style={{ marginLeft: 'auto' }} />
        <input placeholder="Search email" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">All</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>
      {info && <div style={{ fontSize: 12, color: '#155e75' }}>{info}</div>}
      {error && <div style={{ fontSize: 12, color: '#9f1239' }}>{error}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Email</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Role</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members
            .filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter))
            .filter((m) => (memberSearch.trim() ? m.email.toLowerCase().includes(memberSearch.trim().toLowerCase()) : true))
            .map((m) => (
            <tr key={m.userId}>
              <td>{m.email}</td>
              <td>{m.role}</td>
              <td>{m.status}</td>
              <td style={{ display: 'flex', gap: 6 }}>
                {isOwner ? (
                  <>
                    <button onClick={() => approve(m.userId)} disabled={m.status==='approved'}>Approve</button>
                    <button onClick={() => pend(m.userId)} disabled={m.status==='pending'}>Set Pending</button>
                    <button onClick={() => revoke(m.userId)} disabled={m.status==='revoked'}>Revoke</button>
                  </>
                ) : (
                  <span style={{ opacity: 0.6 }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isOwner && (
        <>
          <h3>Invitations</h3>
          <ul>
            {invites.map((i) => (
              <li key={i.id}>
                {i.email} — {i.status} — expires {new Date(i.expiresAt).toLocaleString()} — link: {`${window.location.origin}?accept=1&token=${i.token}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
