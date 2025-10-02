import { useState } from 'react';
import { supabase } from '../supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';

export function AuthBox() {
  const { user, role } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  if (!supabase) return null;

  async function signIn() {
    setStatus(null);
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setStatus(error.message);
    else setStatus('Check your email for the sign-in link.');
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {user ? (
        <>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Signed in{role ? ` (${role})` : ''}</span>
          <button onClick={signOut}>Sign out</button>
        </>
      ) : (
        <>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button disabled={!email} onClick={signIn}>Sign in</button>
          {status && <small style={{ opacity: 0.8 }}>{status}</small>}
        </>
      )}
    </div>
  );
}
