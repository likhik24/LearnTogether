'use client';

import { useCallback, useState } from 'react';
import type {
  ClassSearchHit,
  PublicUser,
  VoiceIntent,
} from '@learn-and-build/types';
import { createAuthClient, voiceSearch } from '../../lib/api';

export default function DiscoverPage() {
  const [user, setUser] = useState<PublicUser | null>(null);

  return (
    <section style={{ maxWidth: 640 }}>
      <h1>Discover Classes</h1>
      {!user ? (
        <CustomerAuth onSignedIn={setUser} />
      ) : (
        <>
          <p style={{ opacity: 0.8 }}>
            Signed in as {user.displayName} ({user.role}){' '}
            <button onClick={() => setUser(null)} style={linkBtn}>
              sign out
            </button>
          </p>
          <SearchPanel />
        </>
      )}
    </section>
  );
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#60a5fa',
  cursor: 'pointer',
  textDecoration: 'underline',
};

function CustomerAuth({ onSignedIn }: { onSignedIn: (u: PublicUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        const client = createAuthClient();
        const res =
          mode === 'login'
            ? await client.login(email, password)
            : await client.register({ email, password, displayName });
        onSignedIn(res.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    },
    [mode, email, password, displayName, onSignedIn],
  );

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <label>
          <input
            type="radio"
            checked={mode === 'login'}
            onChange={() => setMode('login')}
          />{' '}
          Sign in
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'register'}
            onChange={() => setMode('register')}
          />{' '}
          Create account
        </label>
      </div>
      {mode === 'register' && (
        <input
          placeholder="your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      )}
      <input
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="password (min 8 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
    </form>
  );
}

function SearchPanel() {
  const [q, setQ] = useState('evening jiu jitsu near me');
  const [useLocation, setUseLocation] = useState(true);
  const [hits, setHits] = useState<ClassSearchHit[] | null>(null);
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCoords = useCallback(async () => {
    if (!useLocation || !navigator.geolocation) return undefined;
    return new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        // Fall back to a demo location (Bangalore) if the browser denies.
        () => resolve({ lat: 12.975, lng: 77.6 }),
        { timeout: 4000 },
      );
    });
  }, [useLocation]);

  const search = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setNote(null);
      try {
        const coords = await getCoords();
        const res = await voiceSearch(q, coords);
        setIntent(res.intent);
        // If nothing is nearby, fall back to a global search so the customer
        // still sees relevant classes (listings may be in another city).
        if (coords && res.results.hits.length === 0) {
          const globalRes = await voiceSearch(q);
          if (globalRes.results.hits.length > 0) {
            setNote('No classes within range near you — showing results everywhere.');
            setHits(globalRes.results.hits);
          } else {
            setHits([]);
          }
        } else {
          setHits(res.results.hits);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [q, getCoords],
  );

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      <form onSubmit={search} style={{ display: 'grid', gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try: evening jiu jitsu near me"
          style={{ padding: 10, fontSize: 16 }}
        />
        <label style={{ fontSize: 14 }}>
          <input
            type="checkbox"
            checked={useLocation}
            onChange={(e) => setUseLocation(e.target.checked)}
          />{' '}
          Search near me
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {note && <p style={{ color: '#fbbf24', fontSize: 14 }}>{note}</p>}
      {intent && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          Interpreted: activity={String(intent.activity)}, evening=
          {String(intent.eveningOnly)}, radius={intent.radiusMeters}m
        </p>
      )}
      {hits && <Results hits={hits} />}
    </div>
  );
}

function Results({ hits }: { hits: ClassSearchHit[] }) {
  if (hits.length === 0) return <p>No classes found. Try a different search.</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
      {hits.map((h) => (
        <li
          key={h.classId}
          style={{ padding: 14, background: '#111a33', borderRadius: 10 }}
        >
          <div style={{ fontWeight: 600 }}>{h.activity}</div>
          {h.description && (
            <div style={{ opacity: 0.8, fontSize: 14 }}>{h.description}</div>
          )}
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
            {h.distanceMeters != null
              ? `${Math.round(h.distanceMeters)} m away`
              : 'distance n/a'}{' '}
            · relevance {h.score.toFixed(2)}
          </div>
        </li>
      ))}
    </ul>
  );
}
