import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AppUser, Invitation, InvitationRole, getCurrentAppUser, inviteByEmail, listInvitations, listMembers, updateMember, sendInviteLink, deleteMemberCompletely, deleteInvitation } from '../client/api';

function getInviteBase(): string {
  try {
    const url = new URL(window.location.href);
    const path = url.pathname || '/';
    const ghBase = '/waiting-list-dashboard';
    const base = path.startsWith(ghBase) ? ghBase : '';
    return `${url.origin}${base}`;
  } catch {
    return window.location.origin;
  }
}

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
  const [inviteRole, setInviteRole] = useState<InvitationRole>('member');
  const [inviting, setInviting] = useState(false);
  const inviteBase = useMemo(() => (typeof window === 'undefined' ? '' : getInviteBase()), []);

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

  useEffect(() => { refresh(); (async () => { try { setMe(await getCurrentAppUser()); } catch {} })(); }, []);

  async function invite() {
    if (inviting) return;
    const address = email.trim();
    if (!address) return;
    try {
      setInviting(true);
      setError(null); setInfo(null);
      const inv = await inviteByEmail(address, inviteRole);
      setInfo(`Invite created for ${inv.email} as ${inv.invitedRole}. Share this link: ${inviteBase}?accept=1&token=${inv.token}`);
      setEmail('');
      setInviteRole('member');
      refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setInviting(false);
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

  const visibleMembers = members.filter((m) => m.role !== 'owner');
  const panelStyle: CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--surface-1)',
    padding: 20,
    display: 'grid',
    gap: 16,
  };
  const filtersRowStyle: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
  const subtleText: CSSProperties = { fontSize: 12, opacity: 0.75 };
  const filteredMembers = visibleMembers
    .filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter))
    .filter((m) => (memberSearch.trim() ? m.email.toLowerCase().includes(memberSearch.trim().toLowerCase()) : true));

  const inviteDisabled = !email.trim() || !isApprovedOwner || inviting;
  const inviteButtonLabel = inviting ? 'Sending…' : 'Send invite';
  const emptyStateStyle: CSSProperties = { fontSize: 13, opacity: 0.7, padding: '12px 0' };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24 }}>Workspace members</h2>
        {!isApprovedOwner && (
          <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #f59e0b', padding: '6px 8px', borderRadius: 6, marginTop: 8 }}>
            You need approved owner access to invite or manage members. You can still view the roster below.
          </div>
        )}
      </div>

      {info && <div style={{ fontSize: 12, color: '#0f5132', background: '#d1fae5', border: '1px solid #6ee7b7', padding: '8px 12px', borderRadius: 8 }}>{info}</div>}
      {error && <div style={{ fontSize: 12, color: '#7f1d1d', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

      <section style={panelStyle}>
        <div>
          <h3 style={{ margin: 0 }}>Invite teammates</h3>
          <p style={{ ...subtleText, marginTop: 4 }}>Send an email invitation with the role you prefer.</p>
        </div>
        <div style={filtersRowStyle}>
          <input placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ minWidth: 220 }} />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as InvitationRole)}>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button onClick={invite} disabled={inviteDisabled}>{inviteButtonLabel}</button>
        </div>
        <p style={{ ...subtleText, margin: 0 }}>Invites expire after 30 days.</p>
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Current members</h3>
          <span style={subtleText}>{filteredMembers.length} active {filteredMembers.length === 1 ? 'member' : 'members'}</span>
          <span style={{ marginLeft: 'auto' }} />
          <input placeholder="Search email" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} style={{ minWidth: 180 }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        {filteredMembers.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Email</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Role</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Status</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.userId}>
                  <td style={{ padding: '6px 0' }}>{m.email}</td>
                  <td style={{ padding: '6px 0' }}>
                    {isApprovedOwner ? (
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
                      m.role
                    )}
                  </td>
                  <td style={{ padding: '6px 0' }}>{m.status}</td>
                  <td style={{ padding: '6px 0' }}>
                    {isApprovedOwner ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => approve(m.userId)} disabled={m.status==='approved'}>Approve</button>
                        <button onClick={() => pend(m.userId)} disabled={m.status==='pending'}>Set pending</button>
                        <button onClick={() => revoke(m.userId)} disabled={m.status==='revoked'}>Revoke</button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete ${m.email}? This removes their membership and related data.`)) return;
                            setBusyIds(prev => ({ ...prev, [m.userId]: true }));
                            try {
                              await deleteMemberCompletely(m.userId, 'delete');
                              await refresh();
                              setInfo('Member deleted successfully');
                            } catch (e: any) {
                              const msg = e?.message || String(e);
                              if (msg.toLowerCase().includes('not authorized')) {
                                setError('You must be an approved owner to delete members.');
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
                      </div>
                    ) : (
                      <span style={{ opacity: 0.6 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={emptyStateStyle}>No members yet. Send an invite to add your first teammate.</div>
        )}
      </section>

      {isOwner && (
        <section style={panelStyle}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Pending invitations</h3>
            <span style={subtleText}>{invites.length} pending</span>
          </div>
          {invites.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Email</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Role</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Status</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Expires</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const link = `${inviteBase}?accept=1&token=${i.token}`;
                  return (
                    <tr key={i.id}>
                      <td style={{ padding: '6px 0' }}>{i.email}</td>
                      <td style={{ padding: '6px 0' }}>{i.invitedRole}</td>
                      <td style={{ padding: '6px 0' }}>{i.status}</td>
                      <td style={{ padding: '6px 0' }}>{new Date(i.expiresAt).toLocaleString()}</td>
                      <td style={{ padding: '6px 0' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(link); setInfo('Invite link copied'); }
                              catch (e: any) { setError('Copy failed: ' + (e?.message || String(e))); }
                            }}
                          >Copy link</button>
                          <button
                            onClick={async () => {
                              try { setError(null); setInfo(null); await sendInviteLink(i.email, i.token); setInfo('Magic link sent to invitee'); }
                              catch (e: any) { setError(e?.message || String(e)); }
                            }}
                          >Resend email</button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete the invitation for ${i.email}? They will no longer be able to use the link.`)) return;
                              setBusyIds(prev => ({ ...prev, [i.id]: true }));
                              try {
                                await deleteInvitation(i.id);
                                await refresh();
                                setInfo('Invitation deleted');
                              } catch (e: any) {
                                setError(e?.message || String(e));
                              } finally {
                                setBusyIds(prev => { const copy = { ...prev }; delete copy[i.id]; return copy; });
                              }
                            }}
                            disabled={!!busyIds[i.id]}
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', opacity: busyIds[i.id] ? 0.6 : 1 }}
                          >Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={emptyStateStyle}>No pending invitations.</div>
          )}
        </section>
      )}
    </div>
  );
}
