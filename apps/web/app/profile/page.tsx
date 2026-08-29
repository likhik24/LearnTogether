'use client';

import { useEffect, useState } from 'react';
import type { PublicUser } from '@learn-and-build/types';
import { createAuthClient } from '../../lib/api';
import {
  clearCustomerSession,
  readCustomerUser,
  saveCustomerSession,
  signOutCustomerSession,
} from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('Priya');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = readCustomerUser();
    setUser(existing);
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get('verify_token');
    const passwordToken = params.get('reset_token');
    if (passwordToken) {
      setResetToken(passwordToken);
      setMode('reset');
    }
    if (verificationToken) {
      setLoading(true);
      createAuthClient()
        .confirmEmailVerification(verificationToken)
        .then(async () => {
          setMessage('Your email address is verified.');
          if (existing) {
            const refreshed = await createAuthClient().me();
            saveCustomerSession('', refreshed);
            setUser(refreshed);
          }
        })
        .catch((caught) =>
          setError(caught instanceof Error ? caught.message : 'Could not verify email'),
        )
        .finally(() => setLoading(false));
    }
    if (verificationToken || passwordToken) {
      window.history.replaceState(null, '', window.location.pathname);
    }
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
          ? await createAuthClient().login(email, password)
          : await createAuthClient().register({ email, password, displayName });
      saveCustomerSession(response.accessToken, response.user);
      setUser(response.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete the request');
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
        {user && mode !== 'reset' ? (
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
        )}
        <BottomNav />
      </div>
    </main>
  );
}
