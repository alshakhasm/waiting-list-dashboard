import { useState } from 'react';
import { becomeOwner } from '../client/api';
import { supabase } from '../supabase/client';

export function AccessDeniedPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function doBecomeOwner() {
    setBusy(true); setMsg(null);
    const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
    ]) as Promise<T>;
    try {
      await withTimeout(becomeOwner(), 15000);
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || String(e));
      setBusy(false);
    }
  }

  async function doSignOut() {
    try { await (supabase?.auth as any).signOut({ scope: 'local' }); } catch {}
    try {
      await Promise.race([
        (supabase?.auth as any).signOut(),
        new Promise((r) => setTimeout(r, 3000))
      ]);
    } catch {}
    const u = new URL(window.location.href);
    u.searchParams.set('signin','1');
    window.location.href = u.toString();
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 }}>
      <div style={{ maxWidth: 520 }}>
        <h1>Access denied</h1>
        <p style={{ opacity: 0.85 }}>Your account is signed in, but no access record was found. This sometimes happens if you just signed up - try refreshing the page first. If this persists, you can create your own owner workspace now.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.location.reload()} disabled={busy}>Refresh page</button>
          <button onClick={doBecomeOwner} disabled={busy}>{busy ? 'Creating access…' : 'Become owner now'}</button>
          <button onClick={() => { const u = new URL(window.location.href); u.searchParams.set('signin','1'); window.location.href = u.toString(); }} disabled={busy}>Go to Sign in</button>
          <button onClick={doSignOut} disabled={busy}>Sign out</button>
        </div>
        {msg && <div style={{ marginTop: 8, color: '#a11', fontSize: 12 }}>Error: {msg}</div>}
      </div>
    </div>
  );
}
