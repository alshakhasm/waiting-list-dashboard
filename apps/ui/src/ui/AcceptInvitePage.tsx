import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase/client';
import { getInvitationByToken, Invitation, InvitationRole } from '../client/api';
import { SignInPage } from '../auth/SignInPage';
import { getRedirectBase } from './url';

function describeRole(role: InvitationRole): string {
  if (role === 'viewer') return 'viewer (read-only access)';
  if (role === 'editor') return 'editor (can update schedules)';
  return 'member';
}

type Phase = 'loading' | 'needs-register' | 'waiting-confirmation' | 'processing' | 'accepted' | 'error';

export function AcceptInvitePage() {
  const token = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }, []);
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [statusMessage, setStatusMessage] = useState('Checking invitation…');
  const [session, setSession] = useState<any>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const workspaceName = useMemo(() => {
    const envTitle = (import.meta as any)?.env?.VITE_APP_TITLE as string | undefined;
    try {
      return localStorage.getItem('ui-app-title') || envTitle || 'Workspace';
    } catch {
      return envTitle || 'Workspace';
    }
  }, []);

  const invitedRoleLabel = useMemo(() => invite ? describeRole(invite.invitedRole) : null, [invite]);
  const mismatchEmail = useMemo(() => {
    if (!invite || !session?.user?.email) return false;
    return session.user.email.toLowerCase() !== invite.email.toLowerCase();
  }, [invite, session?.user?.email]);

  useEffect(() => {
    if (!supabase) {
      setPhase('error');
      setStatusMessage('Supabase is not configured. Invitation acceptance requires Supabase to be enabled.');
      return;
    }
    if (!token) {
      setPhase('error');
      setStatusMessage('Missing invitation token.');
      return;
    }
    let cancelled = false;
    setStatusMessage('Verifying invitation…');
    (async () => {
      try {
        const inv = await getInvitationByToken(token);
        if (cancelled) return;
        if (!inv) {
          setPhase('error');
          setStatusMessage('Invitation not found.');
          return;
        }
        if (inv.status !== 'pending') {
          setPhase('error');
          setStatusMessage('This invitation has already been used.');
          return;
        }
        if (inv.expiresAt) {
          const expires = new Date(inv.expiresAt);
          if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
            setPhase('error');
            setStatusMessage('This invitation has expired.');
            return;
          }
        }
        setInvite(inv);
        setPhase('needs-register');
        setStatusMessage('Create your account to join the workspace.');
      } catch (err: any) {
        if (cancelled) return;
        setPhase('error');
        setStatusMessage(err?.message || String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession ?? null);
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!invite || !token) return;
    if (!session) return;
    const email = session.user?.email ?? '';
    if (!email) {
      setPhase('error');
      setStatusMessage('Signed-in user is missing an email. Please sign out and try again.');
      return;
    }
    if (email.toLowerCase() !== invite.email.toLowerCase()) {
      setPhase('error');
      setStatusMessage(`This invitation was sent to ${invite.email}, but you are signed in as ${email}. Please sign in with the invited email.`);
      return;
    }
    let cancelled = false;
    setPhase('processing');
    setStatusMessage('Finalizing your access…');
    (async () => {
      try {
        const { error } = await (supabase as any).rpc('invitations_accept', { p_token: token });
        if (error) throw error;
        if (cancelled) return;
        setPhase('accepted');
        setStatusMessage("You're in! Your invitation has been accepted.");
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete('accept');
          clean.searchParams.delete('token');
          window.history.replaceState({}, document.title, clean.toString());
        } catch {}
      } catch (err: any) {
        if (cancelled) return;
        setPhase('error');
        setErrorDetails(err?.message || String(err));
        setStatusMessage('We could not accept your invitation.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invite, session, token]);

  const handleSignUpComplete = (needsVerification: boolean) => {
    if (needsVerification) {
      setPhase('waiting-confirmation');
      setStatusMessage('Check your email to confirm your account, then return to this page to finish accepting the invitation.');
    } else {
      setPhase('processing');
      setStatusMessage('Finalizing your access…');
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 24, background: 'var(--surface-0)' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 28,
          background: 'var(--surface-1)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, letterSpacing: 1.6, textTransform: 'uppercase', color: 'var(--accent-text)', opacity: 0.75 }}>Join {workspaceName}</div>
          <h1 style={{ margin: '6px 0 10px', fontSize: 28 }}>Team invitation</h1>
          <p style={{ margin: 0, color: 'var(--text)', opacity: 0.85 }}>{statusMessage}</p>
          {invitedRoleLabel && (
            <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.75 }}>Role on join: <strong>{invitedRoleLabel}</strong></p>
          )}
        </div>
        {!supabase && (
          <p>Supabase is not configured. Invitation acceptance requires Supabase to be enabled.</p>
        )}
        {phase === 'needs-register' && invite && !session && (
          <InviteRegistrationForm
            email={invite.email}
            token={token!}
            onSignUpComplete={handleSignUpComplete}
            workspaceName={workspaceName}
            invitedRole={invite.invitedRole}
          />
        )}
        {phase === 'waiting-confirmation' && (
          <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
            <p style={{ margin: 0 }}>Once you confirm your email, this page will automatically finish accepting the invitation. If you already confirmed, refresh the page.</p>
          </div>
        )}
        {phase === 'error' && errorDetails && (
          <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: '#ffecec', color: '#8a1f11' }}>
            <strong>Error:</strong> {errorDetails}
          </div>
        )}
        {phase === 'accepted' && (
          <div style={{ marginTop: 16 }}>
            <p>You can close this page or head straight into the app.</p>
            <button onClick={() => { window.location.href = getRedirectBase(); }}>Go to app</button>
          </div>
        )}
        {phase === 'needs-register' && invite && !session && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Already have an account for <strong>{invite.email}</strong>? Sign in to join instantly.</div>
            {!showSignIn ? (
              <button
                style={{ marginTop: 10 }}
                onClick={() => setShowSignIn(true)}
              >
                I already have a password
              </button>
            ) : (
              <div style={{ marginTop: 18 }}>
                <SignInPage />
              </div>
            )}
          </div>
        )}
        {invite && mismatchEmail && session?.user?.email && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
              Signed in as {session.user.email}. This invitation was sent to {invite.email}.
            </div>
            <button
              onClick={async () => {
                try {
                  if (!supabase) return;
                  await supabase.auth.signOut();
                  setStatusMessage('Signed out. Please sign in with the invited email to continue.');
                  setShowSignIn(true);
                } catch (err: any) {
                  setErrorDetails(err?.message || String(err));
                  setPhase('error');
                }
              }}
            >
              Sign out & switch account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type InviteRegistrationFormProps = {
  email: string;
  token: string;
  onSignUpComplete: (needsVerification: boolean) => void;
  workspaceName: string;
  invitedRole: InvitationRole;
};

function InviteRegistrationForm({ email, token, onSignUpComplete, workspaceName, invitedRole }: InviteRegistrationFormProps) {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    if (!password || password.length < 8) {
      setStatus('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setStatus('Passwords do not match.');
      return;
    }
    if (!supabase) {
      setStatus('Supabase is not configured.');
      return;
    }
    setBusy(true);
    try {
      const redirect = (() => {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('accept', '1');
          url.searchParams.set('token', token);
          return url.toString();
        } catch {
          return window.location.href;
        }
      })();
      const options: Record<string, any> = { emailRedirectTo: redirect };
      if (fullName.trim()) {
        options.data = { full_name: fullName.trim() };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options,
      });
      if (error) throw error;
      if (!data.session) {
        setStatus('Account created. Check your email to confirm, then return to this page.');
        onSignUpComplete(true);
      } else {
        setStatus('Account created. Finalizing your invitation…');
        onSignUpComplete(false);
      }
    } catch (err: any) {
      setStatus(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 18, background: 'var(--surface-2)' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.65 }}>Invitation for</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{email}</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
          You’re joining <strong>{workspaceName}</strong> as a <strong>{describeRole(invitedRole)}</strong>. Create your account to continue.
        </div>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Full name (optional)</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Create password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            required
          />
        </label>
      </div>
      {status && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text)', opacity: 0.85 }}>{status}</div>
      )}
      <button type="submit" style={{ marginTop: 18, padding: '10px 16px' }} disabled={busy}>
        {busy ? 'Creating account…' : `Join ${workspaceName}`}
      </button>
    </form>
  );
}
