'use client';

import { useEffect, useState } from 'react';
import type { PublicUser } from '@learn-and-build/types';
import { createAuthClient } from '../../lib/api';
import { clearCustomerSession, readCustomerUser, saveCustomerSession } from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('Priya');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setUser(readCustomerUser()), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = mode === 'login'
        ? await createAuthClient().login(email, password)
        : await createAuthClient().register({ email, password, displayName });
      saveCustomerSession(response.accessToken, response.user);
      setUser(response.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    clearCustomerSession();
    setUser(null);
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell profile-page">
        <AppHeader />
        <span className="eyebrow purple">YOUR ACCOUNT</span>
        <h1>{user ? `Hi ${user.displayName}, everything’s in sync.` : 'Take your plans everywhere.'}</h1>
        <p>{user ? 'Profiles, saved classes, bookings, and notifications are connected to your account.' : 'Sign in to move your family data from this browser into the LearnTogether API.'}</p>
        {user ? (
          <section className="account-card">
            <span className="account-avatar">{user.displayName.charAt(0).toUpperCase()}</span>
            <div><span className="sync-pill"><Icon name="check" size={12} /> API CONNECTED</span><h2>{user.displayName}</h2><p>{user.email}</p></div>
            <button onClick={signOut}>Sign out</button>
          </section>
        ) : (
          <form className="customer-auth-form" onSubmit={submit}>
            <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button></div>
            {mode === 'register' && <label>Your name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>}
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-wide" type="submit" disabled={loading}>{loading ? 'Connecting…' : mode === 'login' ? 'Sign in & sync' : 'Create account & sync'}</button>
          </form>
        )}
        <BottomNav />
      </div>
    </main>
  );
}
