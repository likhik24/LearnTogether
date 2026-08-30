'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ChildProfileDto } from '@learn-and-build/types';
import {
  getCustomerClient,
  hydrateCustomerSession,
  invalidatePrimaryChild,
  readSafeReturnTo,
} from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';

const interestOptions = ['Vehicles', 'STEM', 'Music', 'Art', 'Stories', 'Sports'];
type PageState = 'checking' | 'anonymous' | 'loading' | 'ready' | 'error';

export default function ChildrenPage() {
  const [children, setChildren] = useState<ChildProfileDto[]>([]);
  const [child, setChild] = useState<ChildProfileDto | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [message, setMessage] = useState('Ready to create');
  const [pageState, setPageState] = useState<PageState>('checking');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState('/');

  useEffect(() => {
    let active = true;
    setReturnTo(readSafeReturnTo('/'));
    void hydrateCustomerSession().then(async (user) => {
      if (!active) return;
      if (!user) {
        setPageState('anonymous');
        return;
      }
      const client = getCustomerClient();
      if (!client) {
        setPageState('anonymous');
        return;
      }
      setPageState('loading');
      try {
        const items = await client.listChildren();
        if (!active) return;
        const first = items[0];
        if (first) {
          setChildren(items);
          setChild(first);
          setName(first.name);
          setBirthDate(first.birthDate ?? '');
          setInterests(first.interests);
          setMessage('Synced with LearnTogether');
        }
        setPageState('ready');
      } catch {
        if (!active) return;
        setPageState('error');
        setError('We could not load your child profile. Please try again.');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  }

  function editChild(next: ChildProfileDto) {
    setChild(next);
    setName(next.name);
    setBirthDate(next.birthDate ?? '');
    setInterests(next.interests);
    setError(null);
  }

  function addChild() {
    setChild(null);
    setName('');
    setBirthDate('');
    setInterests([]);
    setMessage('Ready to create');
    setError(null);
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter your child’s name.');
      return;
    }
    if (birthDate && new Date(`${birthDate}T00:00:00`) > new Date()) {
      setError('Birthday cannot be in the future.');
      return;
    }
    const client = getCustomerClient();
    if (!client) {
      setPageState('anonymous');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = child
        ? await client.updateChild(child.id, {
            name: trimmedName,
            birthDate: birthDate || undefined,
            interests,
          })
        : await client.createChild({
            name: trimmedName,
            birthDate: birthDate || undefined,
            interests,
          });
      setChild(result);
      setChildren((items) =>
        child ? items.map((item) => (item.id === result.id ? result : item)) : [...items, result],
      );
      setName(result.name);
      invalidatePrimaryChild();
      setMessage('Saved to LearnTogether');
      if (returnTo !== '/') window.location.assign(returnTo);
    } catch {
      setError('Your child profile was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell child-page">
        <AppHeader />
        <span className="eyebrow purple">{(name || 'Your child').toUpperCase()}’S SPACE</span>
        <h1>
          Growing interests,
          <br />
          all in one place.
        </h1>
        <p>These details help us make calmer, more useful recommendations.</p>

        {(pageState === 'checking' || pageState === 'loading') && (
          <p className="section-hint" role="status">
            Checking your secure family profile…
          </p>
        )}
        {pageState === 'anonymous' && (
          <div className="empty-bookings customer-page-gate">
            <span>
              <Icon name="profile" size={35} />
            </span>
            <h2>Sign in to manage child profiles</h2>
            <p>
              Family profiles contain personal details, so they are only stored in your secure
              account.
            </p>
            <Link
              href={`/profile?returnTo=${encodeURIComponent(`/children?returnTo=${encodeURIComponent(returnTo)}`)}`}
            >
              Sign in or create account →
            </Link>
          </div>
        )}
        {pageState === 'error' && (
          <div className="empty-bookings customer-page-gate">
            <span>
              <Icon name="child" size={35} />
            </span>
            <h2>Profile unavailable</h2>
            <p>{error}</p>
            <button className="primary-wide" type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}
        {pageState === 'ready' && (
          <>
            <div className="child-switcher" aria-label="Child profiles">
              {children.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={child?.id === item.id}
                  className={child?.id === item.id ? 'active' : ''}
                  onClick={() => editChild(item)}
                >
                  {item.name}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={child === null}
                className={child === null ? 'active' : ''}
                onClick={addChild}
              >
                + Add child
              </button>
            </div>
            <section className="child-profile-card">
              <div className="profile-card-heading">
                <span className="account-avatar">
                  {name.charAt(0).toUpperCase() || <Icon name="child" />}
                </span>
                <div>
                  <h2>{name || 'Your child'}</h2>
                  <small>
                    <Icon name="check" size={12} /> {message}
                  </small>
                </div>
              </div>
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                Birthday
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                />
              </label>
              <fieldset>
                <legend>Things they love</legend>
                <div>
                  {interestOptions.map((interest) => (
                    <button
                      type="button"
                      aria-pressed={interests.includes(interest)}
                      className={interests.includes(interest) ? 'active' : ''}
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-wide" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : returnTo !== '/' ? 'Save & continue booking' : 'Save profile'}
              </button>
            </section>
          </>
        )}
        <BottomNav />
      </div>
    </main>
  );
}
