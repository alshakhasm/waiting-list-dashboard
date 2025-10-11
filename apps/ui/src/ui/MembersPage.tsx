import { useEffect, useMemo, useState } from 'react';
import { AppUser, Invitation, getCurrentAppUser, inviteByEmail, listInvitations, listMembers, updateMember, sendInviteLink, deleteMemberCompletely } from '../client/api';

export function MembersPage() {
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState<AppUser[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [me, setMe] = useState<AppUser | null>(null);
  const isOwner = me?.role === 'owner';
  const isApprovedOwner = isOwner && me?.status === 'approved';
  const [statusFilter, setStatusFilter] = useState<'all' | AppUser['status']>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  async function refresh() {
    try {
      setError(null);
      const [m, i] = await Promise.all([listMembers(), listInvitations()]);
      // Show all accounts explicitly; duplicates by email are intentional so owners can resolve them
      // Optional: sort by email then status for stable UI
      const sorted = [...m].sort((a, b) => {
        const ea = (a.email || '').toLowerCase();
        const eb = (b.email || '').toLowerCase();
        if (ea !== eb) return ea < eb ? -1 : 1;
        if (a.role !== b.role) return a.role < b.role ? -1 : 1;
        if (a.status !== b.status) return a.status < b.status ? -1 : 1;
        return a.userId < b.userId ? -1 : 1;
      });
      setMembers(sorted);
      setInvites(i);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function demoteToMember(userId: string) {
    try {
      setError(null);
      await updateMember(userId, { role: 'member' });
      await refresh();
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
      {/* Show owner count and helper if multiple owners exist */}
      {members.filter(m => m.role === 'owner').length > 1 && (
        <div style={{ fontSize: 13, color: '#92400e', background: '#fff7ed', border: '1px solid #f59e0b', padding: '8px', borderRadius: 6 }}>
          Multiple owners detected. This can cause confusion—only one primary owner is recommended.
          {isOwner && (
            <div style={{ marginTop: 8 }}>
              You can demote extra owners below. Demoting changes their role to <strong>member</strong>.
            </div>
          )}
        </div>
      )}
      {!isApprovedOwner && (
        <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #f59e0b', padding: '6px 8px', borderRadius: 6 }}>
          Approved owner access required to invite, delete, or change member status. You can still view the list below.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Invite email" value={email} onChange={(e) => setEmail(e.target.value)} />
  <button onClick={invite} disabled={!email || !isApprovedOwner}>Invite</button>
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
              <td>
                {isApprovedOwner && m.role !== 'owner' ? (
                  <select
                    value={m.role}
                    onChange={async (e) => {
                      const next = e.target.value as AppUser['role'];
                      try { await updateMember(m.userId, { role: next }); await refresh(); }
                      catch (e: any) { setError(e?.message || String(e)); }
                    }}
                  >
                    <option value="member">member</option>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                  </select>
                ) : (
                  m.role === 'owner' ? (
                    <span title="Owner" style={{ fontSize: 12, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface-2)' }}>Owner</span>
                  ) : (
                    m.role
                  )
                )}
              </td>
              <td>{m.status}</td>
              <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {isApprovedOwner ? (
                  m.role === 'owner' ? (
                          // Owner row: non-editable badge only
                          <>
                            <span title="Owner" style={{ fontSize: 12, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface-2)' }}>Owner</span>
                          </>
                  ) : (
                    // Member row: show status actions and delete
                    <>
                      <button onClick={() => approve(m.userId)} disabled={m.status==='approved'}>Approve</button>
                      <button onClick={() => pend(m.userId)} disabled={m.status==='pending'}>Set Pending</button>
                      <button onClick={() => revoke(m.userId)} disabled={m.status==='revoked'}>Revoke</button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete ${m.email} completely? This removes their membership and related data.`)) return;
                          setBusyIds(prev => ({ ...prev, [m.userId]: true }));
                          try {
                            await deleteMemberCompletely(m.userId, 'delete');
                            await refresh();
                            setInfo('Member deleted successfully');
                          } catch (e: any) {
                            const msg = e?.message || String(e);
                            // Surface common cases
                            if (msg.toLowerCase().includes('not authorized')) {
                              setError('You must be an approved owner to delete members.');
                            } else if (msg.toLowerCase().includes('refusing to delete an owner')) {
                              setError('Owner accounts cannot be deleted here. Demote first, then delete.');
                            } else {
                              setError(msg);
                            }
                          } finally {
                            setBusyIds(prev => { const copy = { ...prev }; delete copy[m.userId]; return copy; });
                          }
                        }}
                        disabled={!!busyIds[m.userId]}
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)', opacity: busyIds[m.userId] ? 0.6 : 1 }}
                      >Delete</button>
                    </>
                  )
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
          <ul style={{ display: 'grid', gap: 8 }}>
            {invites.map((i) => {
              const link = `${window.location.origin}?accept=1&token=${i.token}`;
              return (
                <li key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 220 }}>{i.email}</span>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>{i.status}</span>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>expires {new Date(i.expiresAt).toLocaleString()}</span>
                  <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 12, opacity: 0.9, overflowWrap: 'anywhere' }}>{link}</a>
                  <span style={{ marginLeft: 'auto' }} />
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(link); setInfo('Invite link copied'); } catch (e: any) { setError('Copy failed: ' + (e?.message || String(e))); }
                    }}
                  >Copy link</button>
                  <button
                    onClick={async () => {
                      try { setError(null); setInfo(null); await sendInviteLink(i.email, i.token); setInfo('Magic link sent to invitee'); } catch (e: any) { setError(e?.message || String(e)); }
                    }}
                  >Send email invite</button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
