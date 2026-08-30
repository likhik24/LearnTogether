'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DaySlot,
  ProviderCategory,
  PROVIDER_CATEGORY_TAXONOMY,
  TravelRadius,
  type DateAvailability,
  type UpsertTeacherProfileInput,
} from '@learn-and-build/api-client';
import { createTeacherClient } from '../../lib/api';
import { Icon } from '../ui';

/* -------- option labels -------- */

const TRAVEL_LABELS: Record<TravelRadius, string> = {
  [TravelRadius.WITHIN_2KM]: 'Within 2 km',
  [TravelRadius.WITHIN_5KM]: 'Within 5 km',
  [TravelRadius.WITHIN_10KM]: 'Within 10 km',
  [TravelRadius.OVER_10KM]: '10+ km',
  [TravelRadius.OWN_LOCATION_ONLY]: 'Prefer teaching from my own location',
};

const SLOT_HOUR_LABELS: Record<DaySlot, string> = {
  [DaySlot.H_9]: '9–10 AM',
  [DaySlot.H_10]: '10–11 AM',
  [DaySlot.H_11]: '11–12 PM',
  [DaySlot.H_12]: '12–1 PM',
  [DaySlot.H_13]: '1–2 PM',
  [DaySlot.H_14]: '2–3 PM',
  [DaySlot.H_15]: '3–4 PM',
  [DaySlot.H_16]: '4–5 PM',
  [DaySlot.H_17]: '5–6 PM',
  [DaySlot.H_18]: '6–7 PM',
  [DaySlot.H_19]: '7–8 PM',
  [DaySlot.H_20]: '8–9 PM',
};

const ALL_DAY_SLOTS = Object.values(DaySlot);

/* -------- helpers -------- */

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The next `count` calendar days starting today (~2 months). */
function upcomingDates(count = 60): Date[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const DATE_FMT = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const DATE_FMT_LONG = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

/* -------- profile form state -------- */

type ProfileState = {
  category: ProviderCategory | '';
  subcategories: string[];
  homeAddress: string;
  homeLat: number | null;
  homeLng: number | null;
  travelRadius: TravelRadius | '';
  availabilityDates: DateAvailability[];
  instagramUrl: string;
  preplyUrl: string;
  urbanproUrl: string;
  teacheronUrl: string;
  portfolio: string;
};

const EMPTY: ProfileState = {
  category: '',
  subcategories: [],
  homeAddress: '',
  homeLat: null,
  homeLng: null,
  travelRadius: '',
  availabilityDates: [],
  instagramUrl: '',
  preplyUrl: '',
  urbanproUrl: '',
  teacheronUrl: '',
  portfolio: '',
};

/**
 * Provider profile editor embedded in the teacher studio. Covers: teaching
 * category (+ subcategories), a 2-month 9am–9pm availability calendar with a
 * selected-days summary, home location (GPS or address search), max commute
 * distance, and public class-profile links. Reads/writes the shared
 * TeacherProfile via the teacher service.
 */
export function ProviderProfileForm() {
  const [form, setForm] = useState<ProfileState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createTeacherClient()
      .getMyTeacherProfile()
      .then((p) =>
        setForm({
          category: p.category ?? '',
          subcategories: p.subcategories ?? [],
          homeAddress: p.homeAddress ?? '',
          homeLat: p.location?.lat ?? null,
          homeLng: p.location?.lng ?? null,
          travelRadius: p.travelRadius ?? '',
          availabilityDates: p.availabilityDates ?? [],
          instagramUrl: p.instagramUrl ?? '',
          preplyUrl: p.preplyUrl ?? '',
          urbanproUrl: p.urbanproUrl ?? '',
          teacheronUrl: p.teacheronUrl ?? '',
          portfolio: p.portfolio ?? '',
        }),
      )
      .catch(() => {
        /* no profile yet — start empty */
      });
  }, []);

  const set = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const activeSubcategories = useMemo(() => {
    if (!form.category) return [];
    return PROVIDER_CATEGORY_TAXONOMY.find((c) => c.category === form.category)?.subcategories ?? [];
  }, [form.category]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    // displayName is required by the upsert DTO; the account name is used by the
    // studio, so send a stable non-empty value here.
    const payload: UpsertTeacherProfileInput = {
      displayName: 'provider',
      category: form.category || undefined,
      subcategories: form.subcategories.length ? form.subcategories : undefined,
      homeAddress: form.homeAddress.trim() || undefined,
      location:
        form.homeLat !== null && form.homeLng !== null
          ? { lat: form.homeLat, lng: form.homeLng }
          : undefined,
      travelRadius: form.travelRadius || undefined,
      availabilityDates: form.availabilityDates.length ? form.availabilityDates : undefined,
      instagramUrl: form.instagramUrl.trim() || undefined,
      preplyUrl: form.preplyUrl.trim() || undefined,
      urbanproUrl: form.urbanproUrl.trim() || undefined,
      teacheronUrl: form.teacheronUrl.trim() || undefined,
      portfolio: form.portfolio.trim() || undefined,
    };
    try {
      // Preserve the real display name if a profile already exists.
      try {
        const existing = await createTeacherClient().getMyTeacherProfile();
        if (existing.displayName) payload.displayName = existing.displayName;
      } catch {
        /* no existing profile */
      }
      await createTeacherClient().upsertMyTeacherProfile(payload);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="provider-form" onSubmit={save}>
      {/* Category */}
      <div className="provider-section">
        <div className="section-heading">
          <h2>What you teach</h2>
          <span className="form-step">A</span>
        </div>
        <div className="provider-label">
          <span>Primary category</span>
          <small className="provider-hint">Maps your profile to how families browse on Discover.</small>
          <div className="provider-chips">
            {PROVIDER_CATEGORY_TAXONOMY.map((c) => (
              <button
                type="button"
                key={c.category}
                className={form.category === c.category ? 'chip active' : 'chip'}
                aria-pressed={form.category === c.category}
                onClick={() =>
                  setForm((prev) => ({ ...prev, category: c.category, subcategories: [] }))
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {activeSubcategories.length > 0 && (
          <div className="provider-label">
            <span>Subcategories you can teach</span>
            <div className="provider-chips">
              {activeSubcategories.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={form.subcategories.includes(s) ? 'chip active' : 'chip'}
                  aria-pressed={form.subcategories.includes(s)}
                  onClick={() => set('subcategories', toggle(form.subcategories, s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Home location + commute */}
      <div className="provider-section">
        <div className="section-heading">
          <h2>Location & travel</h2>
          <span className="form-step">B</span>
        </div>
        <HomeLocationField
          address={form.homeAddress}
          lat={form.homeLat}
          lng={form.homeLng}
          onResolve={(address, lat, lng) =>
            setForm((prev) => ({ ...prev, homeAddress: address, homeLat: lat, homeLng: lng }))
          }
        />
        <div className="provider-label">
          <span>How far are you comfortable travelling to teach?</span>
          <div className="provider-chips">
            {Object.values(TravelRadius).map((v) => (
              <button
                type="button"
                key={v}
                className={form.travelRadius === v ? 'chip active' : 'chip'}
                aria-pressed={form.travelRadius === v}
                onClick={() => set('travelRadius', v)}
              >
                {TRAVEL_LABELS[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="provider-section">
        <div className="section-heading">
          <h2>Your availability</h2>
          <span className="form-step">C</span>
        </div>
        <DateSlotPicker
          value={form.availabilityDates}
          onChange={(next) => set('availabilityDates', next)}
        />
      </div>

      {/* Profile links */}
      <div className="provider-section">
        <div className="section-heading">
          <h2>Public class profiles</h2>
          <span className="form-step">D</span>
        </div>
        <div className="provider-links">
          <LinkField label="Instagram" placeholder="https://instagram.com/yourhandle" value={form.instagramUrl} onChange={(v) => set('instagramUrl', v)} />
          <LinkField label="Preply" placeholder="https://preply.com/…" value={form.preplyUrl} onChange={(v) => set('preplyUrl', v)} />
          <LinkField label="UrbanPro" placeholder="https://urbanpro.com/…" value={form.urbanproUrl} onChange={(v) => set('urbanproUrl', v)} />
          <LinkField label="TeacherOn" placeholder="https://teacheron.com/…" value={form.teacheronUrl} onChange={(v) => set('teacheronUrl', v)} />
          <LinkField label="Other portfolio link" placeholder="YouTube, website, Google Drive…" value={form.portfolio} onChange={(v) => set('portfolio', v)} />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {saved && (
        <p className="form-success">
          <Icon name="check" size={14} /> Provider profile saved.
        </p>
      )}
      <button className="primary-wide" disabled={saving}>
        {saving ? 'Saving…' : 'Save provider profile'}
      </button>
    </form>
  );
}

function LinkField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input type="url" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** 2-month calendar of dates, each with one-hour 9am–9pm slots, + summary. */
function DateSlotPicker({
  value,
  onChange,
}: {
  value: DateAvailability[];
  onChange: (next: DateAvailability[]) => void;
}) {
  const dates = useMemo(() => upcomingDates(60), []);
  const byDate = useMemo(() => {
    const map = new Map<string, DaySlot[]>();
    for (const entry of value) map.set(entry.date, entry.slots);
    return map;
  }, [value]);
  const [openDate, setOpenDate] = useState<string | null>(null);

  function toggleDate(date: string) {
    if (byDate.has(date)) {
      onChange(value.filter((e) => e.date !== date));
      if (openDate === date) setOpenDate(null);
    } else {
      onChange([...value, { date, slots: [...ALL_DAY_SLOTS] }]);
      setOpenDate(date);
    }
  }

  function toggleSlot(date: string, slot: DaySlot) {
    onChange(value.map((e) => (e.date === date ? { ...e, slots: toggle(e.slots, slot) } : e)));
  }

  function setAll(date: string, all: boolean) {
    onChange(value.map((e) => (e.date === date ? { ...e, slots: all ? [...ALL_DAY_SLOTS] : [] } : e)));
  }

  const selected = [...value].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="provider-label">
      <span>Pick the dates and times you can teach</span>
      <small className="provider-hint">
        Choose dates in the next two months, then tap a selected date to fine-tune its 9am–9pm slots.
      </small>

      <div className="avail-calendar" role="group" aria-label="Available dates">
        {dates.map((d) => {
          const iso = isoDate(d);
          const entry = byDate.get(iso);
          const isSelected = entry !== undefined;
          const isOpen = openDate === iso;
          return (
            <button
              type="button"
              key={iso}
              className={`avail-day${isSelected ? ' selected' : ''}${isOpen ? ' open' : ''}`}
              aria-pressed={isSelected}
              onClick={() => (isSelected ? setOpenDate(isOpen ? null : iso) : toggleDate(iso))}
            >
              <small>{DATE_FMT.format(d).split(' ')[0]}</small>
              <strong>{d.getDate()}</strong>
              {isSelected && <span className="avail-day-count">{entry!.length}</span>}
            </button>
          );
        })}
      </div>

      {openDate && byDate.has(openDate) && (
        <div className="avail-slots">
          <div className="avail-slots-head">
            <strong>{DATE_FMT_LONG.format(new Date(`${openDate}T00:00:00`))}</strong>
            <div className="avail-slots-actions">
              <button type="button" onClick={() => setAll(openDate, true)}>All day</button>
              <button type="button" onClick={() => setAll(openDate, false)}>Clear</button>
              <button type="button" onClick={() => toggleDate(openDate)}>Remove date</button>
            </div>
          </div>
          <div className="provider-chips">
            {ALL_DAY_SLOTS.map((slot) => {
              const on = byDate.get(openDate)!.includes(slot);
              return (
                <button
                  type="button"
                  key={slot}
                  className={on ? 'chip active' : 'chip'}
                  aria-pressed={on}
                  onClick={() => toggleSlot(openDate, slot)}
                >
                  {SLOT_HOUR_LABELS[slot]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="avail-summary">
          <span className="avail-summary-title">Selected days ({selected.length})</span>
          <ul>
            {selected.map((e) => (
              <li key={e.date}>
                <strong>{DATE_FMT.format(new Date(`${e.date}T00:00:00`))}</strong>
                <span>
                  {e.slots.length === 0
                    ? 'no slots'
                    : e.slots
                        .slice()
                        .sort((a, b) => Number(a) - Number(b))
                        .map((s) => SLOT_HOUR_LABELS[s])
                        .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type GeoResult = { label: string; lat: number; lng: number };

/** Home location via GPS or OpenStreetMap Nominatim address search. */
function HomeLocationField({
  address,
  lat,
  lng,
  onResolve,
}: {
  address: string;
  lat: number | null;
  lng: number | null;
  onResolve: (address: string, lat: number | null, lng: number | null) => void;
}) {
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(address);
  }, [address]);

  async function searchAddress() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json();
      setResults(data.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })));
      if (data.length === 0) setError('No matching address found.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Address search failed');
    } finally {
      setSearching(false);
    }
  }

  function useGps() {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    setGeoBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = `Current location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
        setQuery(label);
        setResults([]);
        onResolve(label, latitude, longitude);
        setGeoBusy(false);
      },
      (err) => {
        setError(err.message || 'Could not get your location.');
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function pick(r: GeoResult) {
    setQuery(r.label);
    setResults([]);
    onResolve(r.label, r.lat, r.lng);
  }

  const hasCoords = lat !== null && lng !== null;

  return (
    <div className="provider-label">
      <span>Home location</span>
      <small className="provider-hint">
        Use your current location or search an address. Sets the point we measure commute distance from.
      </small>
      <div className="home-loc-row">
        <input
          type="text"
          value={query}
          placeholder="Search an address, area or landmark"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void searchAddress();
            }
          }}
        />
        <button type="button" className="home-loc-btn" onClick={() => void searchAddress()} disabled={searching}>
          {searching ? '…' : 'Search'}
        </button>
        <button type="button" className="home-loc-btn gps" onClick={useGps} disabled={geoBusy}>
          <Icon name="location" size={14} /> {geoBusy ? 'Locating…' : 'GPS'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="home-loc-results">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button type="button" onClick={() => pick(r)}>
                <Icon name="location" size={13} /> {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasCoords && (
        <p className="home-loc-coords">
          <Icon name="check" size={13} /> Pinned at {lat!.toFixed(5)}, {lng!.toFixed(5)}
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
