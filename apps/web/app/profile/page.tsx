'use client';

import { useEffect, useState } from 'react';
import type { PublicUser } from '@learn-and-build/types';
import { ApiError } from '@learn-and-build/api-client';
import { createAuthClient } from '../../lib/api';
import {
  clearCustomerSession,
  hydrateCustomerSession,
  readSafeReturnTo,
  saveCustomerSession,
  signOutCustomerSession,
} from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';
import { OidcButtons } from '../oidc-buttons';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get('verify_token');
    const passwordToken = params.get('reset_token');
    if (params.get('mode') === 'forgot') setMode('forgot');
    if (passwordToken) {
      setResetToken(passwordToken);
      setMode('reset');
      setSessionReady(true);
    }
    if (verificationToken) {
      setLoading(true);
      createAuthClient()
        .confirmEmailVerification(verificationToken)
        .then(async () => {
          if (!active) return;
          setMessage('Your email address is verified.');
          const refreshed = await hydrateCustomerSession();
          if (active) setUser(refreshed);
        })
        .catch((caught) => {
          if (active) setError(authErrorMessage(caught, 'Could not verify email'));
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
          setSessionReady(true);
        });
    } else if (!passwordToken) {
      void hydrateCustomerSession().then((current) => {
        if (!active) return;
        setUser(current);
        setSessionReady(true);
      });
    }
    if (verificationToken || passwordToken) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'forgot') {
        await createAuthClient().requestPasswordReset(email);
        setMessage('If that account exists, a reset link is on its way.');
        return;
      }
      if (mode === 'reset') {
        await createAuthClient().confirmPasswordReset(resetToken, password);
        clearCustomerSession();
        setUser(null);
        setMessage('Password updated. Sign in with your new password.');
        setMode('login');
        setPassword('');
        return;
      }
      const response =
        mode === 'login'
          ? await createAuthClient().login(email.trim().toLowerCase(), password)
          : await createAuthClient().register({
              email: email.trim().toLowerCase(),
              password,
              displayName: displayName.trim(),
            });
      saveCustomerSession(response.accessToken, response.user);
      setUser(response.user);
      const returnTo = readSafeReturnTo('');
      if (returnTo && !returnTo.startsWith('/profile')) window.location.assign(returnTo);
    } catch (caught) {
      setError(authErrorMessage(caught, 'Could not complete the request', mode === 'login'));
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setLoading(true);
    setError(null);
    try {
      await createAuthClient().resendEmailVerification();
      setMessage('A fresh verification link was sent to your email.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send verification email');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await signOutCustomerSession();
    setUser(null);
    setMode('login');
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell profile-page">
        <AppHeader />
        <span className="eyebrow purple">YOUR ACCOUNT</span>
        <h1>
          {user ? `Hi ${user.displayName}, everything’s in sync.` : 'Take your plans everywhere.'}
        </h1>
        <p>
          {user
            ? 'Profiles, saved classes, bookings, and notifications are connected to your account.'
            : 'Sign in to sync your family data securely across devices.'}
        </p>
        {message && <p className="form-success account-feedback">{message}</p>}
        {error && <p className="form-error account-feedback">{error}</p>}
        {!sessionReady && mode !== 'reset' ? (
          <p className="section-hint" role="status">
            Checking your secure session…
          </p>
        ) : user && mode !== 'reset' && mode !== 'forgot' ? (
          <section className="account-card">
            <span className="account-avatar">{user.displayName.charAt(0).toUpperCase()}</span>
            <div>
              <span className="sync-pill">
                <Icon name="check" size={12} /> API CONNECTED
              </span>
              <h2>{user.displayName}</h2>
              <p>{user.email}</p>
              <p className={user.emailVerified ? 'email-verified' : 'email-unverified'}>
                {user.emailVerified ? 'Email verified' : 'Email verification required'}
              </p>
            </div>
            {!user.emailVerified && (
              <button onClick={resendVerification} disabled={loading}>
                Resend verification
              </button>
            )}
            <button onClick={signOut}>Sign out</button>
          </section>
        ) : (
          <>
            <OidcButtons returnTo="/profile" />
            <form className="customer-auth-form" onSubmit={submit}>
              {mode !== 'reset' && mode !== 'forgot' && (
                <div className="auth-tabs">
                  <button
                    type="button"
                    className={mode === 'login' ? 'active' : ''}
                    onClick={() => setMode('login')}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={mode === 'register' ? 'active' : ''}
                    onClick={() => setMode('register')}
                  >
                    Create account
                  </button>
                </div>
              )}
              {mode === 'register' && (
                <label>
                  Your name
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    placeholder="Your full name"
                    required
                  />
                </label>
              )}
              {mode !== 'reset' && (
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    required
                  />
                </label>
              )}
              {mode !== 'forgot' && (
                <label>
                  {mode === 'reset' ? 'New password' : 'Password'}
                  <input
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                </label>
              )}
              <button className="primary-wide" type="submit" disabled={loading}>
                {loading
                  ? 'Working…'
                  : mode === 'login'
                    ? 'Sign in & sync'
                    : mode === 'register'
                      ? 'Create account & sync'
                      : mode === 'forgot'
                        ? 'Send reset link'
                        : 'Update password'}
              </button>
              {mode === 'login' && (
                <button className="auth-link" type="button" onClick={() => setMode('forgot')}>
                  Forgot password?
                </button>
              )}
              {(mode === 'forgot' || mode === 'reset') && (
                <button className="auth-link" type="button" onClick={() => setMode('login')}>
                  Back to sign in
                </button>
              )}
            </form>
          </>
        )}
        <BottomNav />
      </div>
    </main>
  );
}

function authErrorMessage(caught: unknown, fallback: string, credentials = false): string {
  if (caught instanceof ApiError) {
    if (caught.status === 401 && credentials) return 'Email or password is incorrect.';
    if (caught.status === 409) return 'An account already exists for this email. Sign in instead.';
    if (caught.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (caught.status >= 500)
      return 'The account service is temporarily unavailable. Try again shortly.';
    return caught.message;
  }
  return caught instanceof Error ? caught.message : fallback;
}
