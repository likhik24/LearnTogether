'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ClassOfferingStatus,
  InstructorGender,
  PROVIDER_CATEGORY_TAXONOMY,
  Role,
  VerificationStatus,
  type ClassOfferingDto,
  type PublicUser,
} from '@learn-and-build/types';
import { ApiError } from '@learn-and-build/api-client';
import { createAuthClient, createTeacherClient } from '../../../lib/api';
import {
  getCustomerSchedulingClient,
  hydrateCustomerSession,
  saveCustomerSession,
  signOutCustomerSession,
} from '../../../lib/customer-session';
import { AppHeader, ProviderNav } from '../../ui';
import { OidcButtons } from '../../oidc-buttons';
import { ProviderOperations } from './provider-operations';

type ScheduleRow = { weekday: number; start: string };
const categoryOptions = PROVIDER_CATEGORY_TAXONOMY.map((item) => item.label);
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
  const [customerAccount, setCustomerAccount] = useState<PublicUser | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [activity, setActivity] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [description, setDescription] = useState('');
  const [ageMin, setAgeMin] = useState('3');
  const [ageMax, setAgeMax] = useState('6');
  const [price, setPrice] = useState('499');
  const [duration, setDuration] = useState('60');
  const [seats, setSeats] = useState('8');
  const [venueName, setVenueName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [venueQuery, setVenueQuery] = useState('');
  const [venueResults, setVenueResults] = useState<
    Array<{ label: string; lat: string; lng: string }>
  >([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const [venueSearchError, setVenueSearchError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState('');
  const [rows, setRows] = useState<ScheduleRow[]>([{ weekday: 6, start: '10:00' }]);
  const [classes, setClasses] = useState<ClassOfferingDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void hydrateCustomerSession().then((existing) => {
      if (!active) return;
      if (existing && existing.role !== Role.TEACHER) {
        setCustomerAccount(existing);
        setWorkspaceReady(true);
        return;
      }
      setUser(existing);
      if (existing) void loadWorkspace();
      else setWorkspaceReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function loadWorkspace() {
    setWorkspaceReady(false);
    try {
      const profile = await createTeacherClient().getMyTeacherProfile();
      setVerificationStatus(profile.verificationStatus);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setVerificationStatus(null);
      else setError(caught instanceof Error ? caught.message : 'Could not load provider profile');
    }
    await loadClasses();
    setWorkspaceReady(true);
  }

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
      saveCustomerSession(response.accessToken, response.user);
      if (response.user.role !== Role.TEACHER) {
        setCustomerAccount(response.user);
        return;
      }
      setUser(response.user);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await signOutCustomerSession();
    setUser(null);
    setCustomerAccount(null);
    setVerificationStatus(null);
    setClasses([]);
    setWorkspaceReady(true);
  }

  async function activateProviderAccount() {
    setBusy(true);
    setError(null);
    try {
      const response = await createAuthClient().becomeProvider();
      saveCustomerSession(response.accessToken, response.user);
      setCustomerAccount(null);
      setUser(response.user);
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start provider onboarding');
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, patch: Partial<ScheduleRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  /** Search venues/addresses via OpenStreetMap Nominatim. */
  async function searchVenue() {
    const q = venueQuery.trim();
    if (!q) return;
    setVenueSearching(true);
    setVenueSearchError(null);
    setVenueResults([]);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const { results } = (await res.json()) as {
        results: Array<{ label: string; lat: string; lng: string }>;
      };
      setVenueResults(results);
      if (results.length === 0) setVenueSearchError('No matching venue found.');
    } catch (caught) {
      setVenueSearchError(caught instanceof Error ? caught.message : 'Venue search failed');
    } finally {
      setVenueSearching(false);
    }
  }

  /** Pick a venue result: fills the venue name and locks in its coordinates. */
  function pickVenue(result: { label: string; lat: string; lng: string }) {
    setVenueName(result.label);
    setLatitude(result.lat);
    setLongitude(result.lng);
    setVenueQuery(result.label);
    setVenueResults([]);
  }

  /** Clears the selected venue so the provider can search again. */
  function clearVenue() {
    setVenueName('');
    setLatitude('');
    setLongitude('');
    setVenueQuery('');
    setVenueResults([]);
    setVenueSearchError(null);
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    const client = getCustomerSchedulingClient();
    if (!client) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const input = {
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
        ageMin: Number(ageMin),
        ageMax: Number(ageMax),
        priceMinor: Math.round(Number(price) * 100),
        currency: 'INR',
        imageUrl: imageUrl || undefined,
        tone: 'mint',
        venueName: venueName || undefined,
        instructorGender: InstructorGender.ANY,
        durationMinutes: Number(duration),
        seats: Number(seats),
        timings: rows.map((row) => ({
          weekday: row.weekday,
          startMinute: minutesFromTime(row.start),
        })),
        location:
          latitude && longitude ? { lat: Number(latitude), lng: Number(longitude) } : undefined,
      };
      if (Number(ageMin) > Number(ageMax))
        throw new Error('Minimum age cannot exceed maximum age.');
      if (!venueName || !latitude || !longitude)
        throw new Error('Search and select a venue before submitting.');
      if (editingId) await client.updateClass(editingId, input);
      else await client.createClass(input);
      setMessage(
        editingId
          ? 'Class updated and returned to moderation.'
          : 'Class submitted. It will appear in discovery after moderation.',
      );
      resetEditor();
      await loadClasses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save class');
    } finally {
      setBusy(false);
    }
  }

  function resetEditor() {
    setEditingId(null);
    setActivity('');
    setCategory(categoryOptions[0]);
    setDescription('');
    setAgeMin('3');
    setAgeMax('6');
    setPrice('499');
    setDuration('60');
    setSeats('8');
    setKeywords('');
    setImageUrl('');
    setVenueName('');
    setLatitude('');
    setLongitude('');
    setVenueQuery('');
    setVenueResults([]);
    setVenueSearchError(null);
    setRows([{ weekday: 6, start: '10:00' }]);
  }

  async function changeStatus(id: string, status: ClassOfferingStatus) {
    const client = getCustomerSchedulingClient();
    if (!client) return;
    setError(null);
    try {
      await client.setClassStatus(id, status);
      await loadClasses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update class status');
    }
  }

  /** Inline schedule edit: update only a class's recurring weekly timings. */
  async function saveTimings(id: string, timings: { weekday: number; startMinute: number }[]) {
    const client = getCustomerSchedulingClient();
    if (!client) return;
    setError(null);
    await client.updateClass(id, { timings });
    await loadClasses();
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    setImageUploading(true);
    setError(null);
    try {
      setImageUrl(await createTeacherClient().uploadClassImage(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload class image');
    } finally {
      setImageUploading(false);
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
        {!workspaceReady ? (
          <p className="section-hint" role="status">Loading your Provider Studio…</p>
        ) : customerAccount ? (
          <section className="provider-gate">
            <span className="eyebrow purple">PROVIDER ACCOUNT REQUIRED</span>
            <h2>Continue your educator setup first.</h2>
            <p>
              {customerAccount.email} is currently a family account. Continue with the same secure
              login to add provider access—your family profiles and bookings remain available.
            </p>
            <button
              className="primary-wide"
              type="button"
              disabled={busy}
              onClick={() => void activateProviderAccount()}
            >
              {busy ? 'Preparing provider account…' : 'Continue as a provider'}
            </button>
          </section>
        ) : !user ? (
          <>
            <OidcButtons returnTo="/provider/classes" providerAccount />
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
          </>
        ) : verificationStatus === null ? (
          <section className="provider-gate">
            <span className="eyebrow purple">STEP 1 OF 3</span>
            <h2>Complete your provider profile.</h2>
            <p>
              Add your teaching background and availability before creating classes for review.
            </p>
            <Link className="primary-wide" href="/provider">
              Complete provider profile
            </Link>
            <button className="secondary-wide" type="button" onClick={() => void signOut()}>
              Sign out of provider account
            </button>
          </section>
        ) : (
          <>
            <section className="provider-status-line">
              Profile review: <strong>{verificationStatus.replaceAll('_', ' ')}</strong>. You can
              prepare classes now; a class cannot be approved for families until your identity
              review is approved.
            </section>
            <nav className="provider-subnav" aria-label="Provider studio tabs">
              <Link className="active" href="/provider/classes">
                Classes
              </Link>
              <Link href="/provider/earnings">Earnings</Link>
            </nav>
            <ProviderOperations
              classControls={{
                classes,
                onChangeStatus: changeStatus,
                onSaveTimings: saveTimings,
              }}
            />
            <section className="provider-status-line">
              Manage your profile, availability, and verification documents on your{' '}
              <Link href="/provider">provider profile</Link>.
            </section>

            <form id="class-editor" className="provider-form" onSubmit={publish}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow purple">NEW CLASS</span>
                  <h2>Create a class</h2>
                </div>
              </div>
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
                    Minimum age
                    <input
                      type="number"
                      min="1"
                      max="18"
                      value={ageMin}
                      onChange={(event) => setAgeMin(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Maximum age
                    <input
                      type="number"
                      min="1"
                      max="18"
                      value={ageMax}
                      onChange={(event) => setAgeMax(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Trial price (₹)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      required
                    />
                  </label>
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
                <div className="provider-label venue-search">
                  <span>Venue</span>
                  <small className="section-hint">
                    Search for the venue or address. Selecting a result fills the coordinates
                    automatically (they can’t be edited by hand).
                  </small>
                  {venueName && latitude && longitude ? (
                    <div className="venue-selected">
                      <div>
                        <strong>{venueName}</strong>
                        <small>
                          {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
                        </small>
                      </div>
                      <button type="button" className="venue-clear" onClick={clearVenue}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="home-loc-row">
                        <input
                          type="text"
                          value={venueQuery}
                          placeholder="Search a studio, address or landmark"
                          onChange={(event) => setVenueQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void searchVenue();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="home-loc-btn"
                          onClick={() => void searchVenue()}
                          disabled={venueSearching}
                        >
                          {venueSearching ? '…' : 'Search'}
                        </button>
                      </div>
                      {venueResults.length > 0 && (
                        <ul className="home-loc-results">
                          {venueResults.map((r, i) => (
                            <li key={`${r.lat},${r.lng},${i}`}>
                              <button type="button" onClick={() => pickVenue(r)}>
                                {r.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {venueSearchError && <p className="form-error">{venueSearchError}</p>}
                    </>
                  )}
                </div>
                <label className="class-image-upload">
                  Class cover image
                  <span>
                    {imageUploading
                      ? 'Uploading…'
                      : imageUrl
                        ? 'Replace image'
                        : 'Choose JPG, PNG, or WebP'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadImage}
                    disabled={imageUploading}
                  />
                </label>
                {imageUrl && (
                  <img className="class-image-preview" src={imageUrl} alt="Class cover preview" />
                )}
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
                  onClick={() => setRows((current) => [...current, { weekday: 7, start: '10:00' }])}
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
                {busy ? 'Saving…' : editingId ? 'Save class changes' : 'Submit class for approval'}
              </button>
              {editingId && (
                <button className="secondary-wide" type="button" onClick={resetEditor}>
                  Cancel editing
                </button>
              )}
            </form>
            <button
              className="secondary-wide provider-studio-link"
              type="button"
              onClick={() => void signOut()}
            >
              Sign out of Provider Studio
            </button>
          </>
        )}
        <ProviderNav />
      </div>
    </main>
  );
}
