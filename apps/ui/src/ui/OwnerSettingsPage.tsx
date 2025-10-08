import { useEffect, useState } from 'react';
import { getMyOwnerProfile, upsertMyOwnerProfile, OwnerProfile } from '../client/api';

export function OwnerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<{
    fullName: string;
    workspaceName: string;
    orgName: string;
    phone: string;
    timezone: string;
    locale: string;
  }>({ fullName: '', workspaceName: '', orgName: '', phone: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '', locale: navigator.language || 'en-US' });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const p = await getMyOwnerProfile();
        if (p) {
          setForm({
            fullName: p.fullName || '',
            workspaceName: p.workspaceName || '',
            orgName: p.orgName || '',
            phone: p.phone || '',
            timezone: p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            locale: p.locale || navigator.language || 'en-US',
          });
        }
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    })();
  }, []);

  async function onSave() {
    try {
      setSaving(true);
      setErr(null);
      const payload = {
        fullName: form.fullName.trim(),
        workspaceName: form.workspaceName.trim(),
        orgName: form.orgName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        locale: form.locale.trim() || undefined,
      } as const;
      if (!payload.fullName || !payload.workspaceName) {
        setErr('Full name and Workspace name are required');
        setSaving(false);
        return;
      }
      await upsertMyOwnerProfile(payload);
      setSaving(false);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Owner Settings</h2>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
          {err && (
            <div style={{ color: 'var(--danger)' }}>
              {String(err).includes("Could not find the table 'public.owner_profiles'") ? (
                <span>Owner profile table is not set up in this project. Your changes will be stored locally on this device.</span>
              ) : (
                <span>{err}</span>
              )}
            </div>
          )}
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Full name</span>
            <input value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Workspace name</span>
            <input value={form.workspaceName} onChange={(e) => setForm(f => ({ ...f, workspaceName: e.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Organization</span>
            <input value={form.orgName} onChange={(e) => setForm(f => ({ ...f, orgName: e.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Phone</span>
            <input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +1 555 123 4567" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Timezone</span>
            <input value={form.timezone} onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Locale</span>
            <input value={form.locale} onChange={(e) => setForm(f => ({ ...f, locale: e.target.value }))} placeholder="e.g. en-US" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
