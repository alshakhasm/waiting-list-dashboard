import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { SignInPage } from '../auth/SignInPage';

export function AcceptInvitePage() {
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState<string>('Accepting invitation…');
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing invitation token.');
      return;
    }
    supabase?.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setStatus('working');
        setMessage('Please sign in with the invited email to accept the invitation.');
        return;
      }
      try {
        const { error } = await (supabase as any).rpc('invitations_accept', { p_token: token });
        if (error) throw error;
        setStatus('ok');
        setMessage("You're in. Your invitation has been accepted.");
        // Clean URL so refreshes don't re-trigger
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete('accept');
          clean.searchParams.delete('token');
          window.history.replaceState({}, document.title, clean.toString());
        } catch {}
      } catch (e: any) {
        setStatus('error');
        setMessage(e?.message || String(e));
      }
    });
  }, []);
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 }}>
      <div style={{ maxWidth: 520 }}>
        <h1>Accept invitation</h1>
        <p>{message}</p>
        {!supabase && (
          <p>Supabase is not configured. Invitation acceptance requires Supabase to be enabled.</p>
        )}
        {supabase && (
          <>
            {/* If not signed in, render sign-in right here so user stays on the invite URL */}
            <SignedInGate>
              <p style={{ fontSize: 12, opacity: 0.8 }}>You are signed in; processing your invitation…</p>
            </SignedInGate>
          </>
        )}
        {status === 'ok' && (
          <div style={{ marginTop: 8 }}>
            <p>You can close this page or return to the app.</p>
            <button onClick={() => { window.location.href = window.location.origin; }}>Go to app</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SignedInGate({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setIsSignedIn(!!data.session));
    const { data: sub } = supabase?.auth.onAuthStateChange((_e, session) => setIsSignedIn(!!session)) || { data: undefined } as any;
    return () => { sub?.subscription?.unsubscribe(); };
  }, []);
  if (!supabase) return null;
  if (!isSignedIn) return <SignInPage />;
  return <>{children}</>;
}
