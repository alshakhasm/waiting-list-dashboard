import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { getCurrentAppUser } from '../client/api';

export function AccountSettingsPage() {
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          setError('Supabase not configured');
          setLoading(false);
          return;
        }
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          setEmail(auth.user.email || '');
          // Try to get full name from database first
          const appUser = await getCurrentAppUser();
          if (appUser?.fullName) {
            setFullName(appUser.fullName);
          } else {
            // Fallback to auth metadata
            const authFullName = (auth.user.user_metadata as any)?.full_name || (auth.user.user_metadata as any)?.name || '';
            setFullName(authFullName);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('Error loading account:', err);
        setError('Failed to load account information');
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Full name cannot be empty');
      return;
    }

    if (!supabase) {
      setError('Supabase not configured');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Not authenticated');

      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });

      if (authError) throw authError;

      // Update app_users table
      const { error: dbError } = await (supabase as any)
        .from('app_users')
        .update({ full_name: fullName.trim() })
        .eq('user_id', auth.user.id);

      if (dbError) throw dbError;

      setMessage('✅ Profile saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Account Settings</h2>
        <div style={{ opacity: 0.7 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 500 }}>
      <h2 style={{ marginTop: 0 }}>Account Settings</h2>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>Manage your account information that appears across the workspace.</p>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Email (Read-only) */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>Email</label>
          <input
            type="email"
            value={email}
            disabled
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              opacity: 0.7,
              cursor: 'not-allowed',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Email cannot be changed here. Contact support if you need to update it.</div>
        </div>

        {/* Full Name */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--surface-1)',
              color: 'var(--text)',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>This name will appear in the workspace header and member lists.</div>
        </div>

        {/* Messages */}
        {error && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 6,
            background: '#fee',
            border: '1px solid #fcc',
            color: '#c33',
            fontSize: 13
          }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 6,
            background: '#efe',
            border: '1px solid #cfc',
            color: '#3a3',
            fontSize: 13
          }}>
            {message}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 16px',
            background: 'var(--primary)',
            color: 'var(--primary-contrast)',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'opacity 0.2s'
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
