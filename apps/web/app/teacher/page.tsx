'use client';

import { useEffect, useState } from 'react';
import {
  InstructorGender,
  Role,
  type ClassOfferingDto,
  type PublicUser,
} from '@learn-and-build/types';
import { createAuthClient } from '../../lib/api';
import {
  getCustomerSchedulingClient,
  readCustomerUser,
  saveCustomerSession,
} from '../../lib/customer-session';
import { AppHeader, BottomNav } from '../ui';

type ScheduleRow = { weekday: number; start: string };
const categoryOptions = ['Art', 'Music', 'LEGO'];
const weekdays = [
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export default function TeacherPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [activity, setActivity] = useState('');
  const [category, setCategory] = useState('Art');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [seats, setSeats] = useState('8');
  const [keywords, setKeywords] = useState('');
  const [rows, setRows] = useState<ScheduleRow[]>([
    { weekday: 6, start: '10:00' },
  ]);
  const [classes, setClasses] = useState<ClassOfferingDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = readCustomerUser();
    setUser(existing);
    if (existing?.role === Role.TEACHER) void loadClasses();
  }, []);

  async function loadClasses() {
    const client = getCustomerSchedulingClient();
    if (!client) return;
    try {
      setClasses(await client.listMyClasses());
    } catch {
      setClasses([]);
    }
  }

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response =
        mode === 'login'
          ? await createAuthClient().login(email, password)
          : await createAuthClient().register({ email, password, displayName, role: Role.TEACHER });
      if (response.user.role !== Role.TEACHER)
        throw new Error('This account is not a provider account.');
      saveCustomerSession(response.accessToken, response.user);
      setUser(response.user);
      await loadClasses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, patch: Partial<ScheduleRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    const client = getCustomerSchedulingClient();
    if (!client) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await client.createClass({
        activity,
        category,
        description: [
          description,
          keywords.trim()
            ? `Keywords: ${keywords
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
                .join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        ageMin: 3,
        ageMax: 12,
        priceMinor: 0,
        currency: 'INR',
        imageUrl: undefined,
        tone: 'mint',
        instructorGender: InstructorGender.ANY,
        durationMinutes: Number(duration),
        seats: Number(seats),
        timings: rows.map((row) => ({
          weekday: row.weekday,
          startMinute: minutesFromTime(row.start),
        })),
      });
      setMessage('Class published. It will appear in discovery with your keywords.');
      setActivity('');
      setDescription('');
      setKeywords('');
      await loadClasses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not publish class');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell teacher-page">
        <AppHeader />
        <span className="eyebrow coral">PROVIDER STUDIO</span>
        <h1>Build your weekend classes.</h1>
        <p className="teacher-lede">
          Choose what you teach, publish a recurring schedule, and help families find you by the
          words they search.
        </p>
        {!user ? (
          <form className="customer-auth-form" onSubmit={authenticate}>
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
                Become a provider
              </button>
            </div>
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
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-wide" disabled={busy}>
              {busy
                ? 'Connecting…'
                : mode === 'login'
                  ? 'Open provider studio'
                  : 'Create provider account'}
            </button>
          </form>
        ) : (
          <>
            <form className="provider-form" onSubmit={publish}>
              <div className="provider-section">
                <div className="section-heading">
                  <h2>Class details</h2>
                  <span className="form-step">01</span>
                </div>
                <label>
                  Class name
                  <input
                    value={activity}
                    onChange={(event) => setActivity(event.target.value)}
                    placeholder="Saturday Art Lab"
                    required
                  />
                </label>
                <label>
                  Category
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {categoryOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  What will families learn?
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="A playful, hands-on class for curious makers."
                    rows={3}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Minutes
                    <input
                      type="number"
                      min="15"
                      max="300"
                      value={duration}
                      onChange={(event) => setDuration(event.target.value)}
                    />
                  </label>
                  <label>
                    Seats
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={seats}
                      onChange={(event) => setSeats(event.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div className="provider-section">
                <div className="section-heading">
                  <h2>Recurring schedule</h2>
                  <span className="form-step">02</span>
                </div>
                <p className="section-hint">
                  Add one or both weekend days. Published slots repeat every week.
                </p>
                {rows.map((row, index) => (
                  <div className="schedule-row" key={`${index}-${row.weekday}`}>
                    <select
                      aria-label="Day"
                      value={row.weekday}
                      onChange={(event) =>
                        updateRow(index, { weekday: Number(event.target.value) })
                      }
                    >
                      {weekdays.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Start time"
                      type="time"
                      value={row.start}
                      onChange={(event) => updateRow(index, { start: event.target.value })}
                    />
                    <span className="schedule-repeat">Every week</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="remove-row"
                        aria-label="Remove schedule"
                        onClick={() =>
                          setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="add-row"
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      { weekday: 7, start: '10:00' },
                    ])
                  }
                >
                  + Add another weekend slot
                </button>
              </div>
              <div className="provider-section">
                <div className="section-heading">
                  <h2>Discovery keywords</h2>
                  <span className="form-step">03</span>
                </div>
                <p className="section-hint">
                  Add words parents might search for. Separate tags with commas.
                </p>
                <input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder="painting, craft, creative, beginner"
                />
                <div className="keyword-preview">
                  {keywords
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
              {message && <p className="form-success">{message}</p>}
              <button className="primary-wide" disabled={busy}>
                {busy ? 'Publishing…' : 'Publish class schedule'}
              </button>
            </form>
            <section className="provider-list">
              <div className="section-heading">
                <h2>Your published classes</h2>
                <span>{classes.length}</span>
              </div>
              {classes.map((item) => (
                <article key={item.id}>
                  <strong>{item.activity}</strong>
                  <small>
                    {item.category} · {item.timings.length} recurring slot
                    {item.timings.length === 1 ? '' : 's'}
                  </small>
                </article>
              ))}
              {!classes.length && (
                <p className="section-hint">Your published classes will appear here.</p>
              )}
            </section>
          </>
        )}
        <BottomNav />
      </div>
    </main>
  );
}
