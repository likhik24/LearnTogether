'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  VerificationStatus,
  type PublicUser,
  type TeacherProfileDto,
} from '@learn-and-build/types';
import {
  AvailabilityDay,
  ChildAgeGroup,
  ChildrenExperience,
  ClassVenuePreference,
  DaySlot,
  DocumentType,
  ProviderAgeBand,
  ProviderCategory,
  ProviderExperience,
  PROVIDER_CATEGORY_TAXONOMY,
  Role,
  SessionFrequency,
  TeachingFormat,
  TimeSlot,
  TravelRadius,
  type DateAvailability,
  type TeacherDocumentDto,
  type UpsertTeacherProfileInput,
} from '@learn-and-build/api-client';
import { createAuthClient, createTeacherClient } from '../../lib/api';
import {
  hydrateCustomerSession,
  readCustomerUser,
  saveCustomerSession,
  signOutCustomerSession,
} from '../../lib/customer-session';
import { AppHeader, Icon, ProviderNav } from '../ui';
import { OidcButtons } from '../oidc-buttons';

/* -------- option label maps (value -> human label) -------- */

const AGE_BAND_LABELS: Record<ProviderAgeBand, string> = {
  [ProviderAgeBand.A_23_29]: '23–29',
  [ProviderAgeBand.A_30_39]: '30–39',
  [ProviderAgeBand.A_40_50]: '40–50',
  [ProviderAgeBand.A_50_PLUS]: '50+',
  [ProviderAgeBand.PREFER_NOT_SAY]: 'Prefer not to say',
};

const EXPERIENCE_LABELS: Record<ProviderExperience, string> = {
  [ProviderExperience.LT_1]: 'Less than 1 year',
  [ProviderExperience.Y_1_3]: '1–3 years',
  [ProviderExperience.Y_3_5]: '3–5 years',
  [ProviderExperience.Y_5_10]: '5–10 years',
  [ProviderExperience.Y_10_PLUS]: '10+ years',
};

const CHILDREN_EXPERIENCE_LABELS: Record<ChildrenExperience, string> = {
  [ChildrenExperience.REGULARLY]: 'Yes — regularly',
  [ChildrenExperience.OCCASIONALLY]: 'Yes — occasionally',
  [ChildrenExperience.INFORMALLY]: 'Not formally, but I interact/work with children',
  [ChildrenExperience.FIRST_TIME]: 'No — this would be my first time',
};

const CHILD_AGE_GROUP_LABELS: Record<ChildAgeGroup, string> = {
  [ChildAgeGroup.G_2_5_4]: '2.5–4 years',
  [ChildAgeGroup.G_4_6]: '4–6 years',
  [ChildAgeGroup.G_6_8]: '6–8 years',
  [ChildAgeGroup.G_8_10]: '8–10 years',
  [ChildAgeGroup.G_10_12]: '10–12 years',
  [ChildAgeGroup.G_12_PLUS]: '12+ years',
};

const TEACHING_FORMAT_LABELS: Record<TeachingFormat, string> = {
  [TeachingFormat.SMALL_GROUP]: 'Small group classes',
  [TeachingFormat.ONE_ON_ONE]: 'One-on-one',
  [TeachingFormat.WORKSHOPS]: 'Workshops',
  [TeachingFormat.WEEKEND_EXPERIENCES]: 'Weekend experiences',
  [TeachingFormat.RECURRING_WEEKLY]: 'Recurring weekly classes',
  [TeachingFormat.SHORT_PROGRAMS]: 'Short 3–4 week programs',
  [TeachingFormat.OPEN_TO_EXPLORING]: 'Open to exploring',
};

const VENUE_LABELS: Record<ClassVenuePreference, string> = {
  [ClassVenuePreference.HOME_STUDIO]: 'At my home/studio',
  [ClassVenuePreference.GATED_COMMUNITY]: 'Inside a gated community',
  [ClassVenuePreference.PARENT_VENUE]: "At the parent's/community venue",
  [ClassVenuePreference.PARTNER_SPACE]: 'Learn & Build partner space',
  [ClassVenuePreference.OUTDOORS]: 'Outdoors',
  [ClassVenuePreference.ONLINE]: 'Online',
  [ClassVenuePreference.OPEN_TO_DISCUSS]: 'Open to discussing',
};

const TRAVEL_LABELS: Record<TravelRadius, string> = {
  [TravelRadius.WITHIN_2KM]: 'Within 2 km',
  [TravelRadius.WITHIN_5KM]: 'Within 5 km',
  [TravelRadius.WITHIN_10KM]: 'Within 10 km',
  [TravelRadius.OVER_10KM]: '10+ km',
  [TravelRadius.OWN_LOCATION_ONLY]: 'Prefer teaching from my own location',
};

const DAY_LABELS: Record<AvailabilityDay, string> = {
  [AvailabilityDay.MONDAY]: 'Monday',
  [AvailabilityDay.TUESDAY]: 'Tuesday',
  [AvailabilityDay.WEDNESDAY]: 'Wednesday',
  [AvailabilityDay.THURSDAY]: 'Thursday',
  [AvailabilityDay.FRIDAY]: 'Friday',
  [AvailabilityDay.SATURDAY]: 'Saturday',
  [AvailabilityDay.SUNDAY]: 'Sunday',
};

const SLOT_LABELS: Record<TimeSlot, string> = {
  [TimeSlot.S_7_9]: '7–9 AM',
  [TimeSlot.S_9_11]: '9–11 AM',
  [TimeSlot.S_11_1]: '11 AM–1 PM',
  [TimeSlot.S_1_3]: '1–3 PM',
  [TimeSlot.S_3_5]: '3–5 PM',
  [TimeSlot.S_5_7]: '5–7 PM',
  [TimeSlot.S_7_9_PM]: '7–9 PM',
};

const FREQUENCY_LABELS: Record<SessionFrequency, string> = {
  [SessionFrequency.ONE_PER_WEEK]: '1 session/week',
  [SessionFrequency.TWO_THREE_PER_WEEK]: '2–3 sessions/week',
  [SessionFrequency.FOUR_PLUS_PER_WEEK]: '4+ sessions/week',
  [SessionFrequency.WEEKENDS_ONLY]: 'Only weekends',
  [SessionFrequency.OCCASIONAL_WORKSHOPS]: 'Occasional workshops',
  [SessionFrequency.FLEXIBLE]: 'Flexible',
};

/** Flat list of every skill checkbox (form question 7). */
const SKILL_OPTIONS = [
  'Storytelling',
  'Telugu / Indian stories',
  'Sanatana / mythology stories',
  'Piano',
  'Guitar',
  'Carnatic music',
  'Hindustani music',
  'Other classical music',
  'Musical instruments',
  'Classical dance',
  'Art / painting',
  'Crafts',
  'Woodworking / wooden toy making',
  'STEM / science',
  'Lego / building',
  'Cooking / baking',
  'Yoga',
  'Mindfulness',
  'Sports / physical activities',
  'Karra Samu / traditional martial arts',
  'Nature-based activities',
  'Life skills',
  'Other',
];

/** One-hour slot labels (9am–9pm). */
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

/* -------- small helpers -------- */

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Local `YYYY-MM-DD` for a date (avoids UTC shift from toISOString). */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The next `count` calendar days starting today (default ~2 months). */
function upcomingDates(count = 60): Date[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const DATE_FMT_LONG = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  ageBand: ProviderAgeBand | '';
  locality: string;
  city: string;
  category: ProviderCategory | '';
  subcategories: string[];
  skills: string[];
  skillDescription: string;
  yearsExperience: ProviderExperience | '';
  portfolio: string;
  instagramUrl: string;
  preplyUrl: string;
  urbanproUrl: string;
  teacheronUrl: string;
  childrenExperience: ChildrenExperience | '';
  childrenExperienceDetail: string;
  childAgeGroups: ChildAgeGroup[];
  teachingFormats: TeachingFormat[];
  venuePreferences: ClassVenuePreference[];
  travelRadius: TravelRadius | '';
  homeAddress: string;
  homeLat: number | null;
  homeLng: number | null;
  availableDays: AvailabilityDay[];
  timeSlots: TimeSlot[];
  availabilityDates: DateAvailability[];
  preferredAvailability: string;
  sessionFrequency: SessionFrequency | '';
  whyJoin: string;
};

const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  email: '',
  ageBand: '',
  locality: '',
  city: 'Hyderabad',
  category: '',
  subcategories: [],
  skills: [],
  skillDescription: '',
  yearsExperience: '',
  portfolio: '',
  instagramUrl: '',
  preplyUrl: '',
  urbanproUrl: '',
  teacheronUrl: '',
  childrenExperience: '',
  childrenExperienceDetail: '',
  childAgeGroups: [],
  teachingFormats: [],
  venuePreferences: [],
  travelRadius: '',
  homeAddress: '',
  homeLat: null,
  homeLng: null,
  availableDays: [],
  timeSlots: [],
  availabilityDates: [],
  preferredAvailability: '',
  sessionFrequency: '',
  whyJoin: '',
};

/** Prefills the editable form from an existing saved profile. */
function formFromProfile(p: TeacherProfileDto): FormState {
  return {
    fullName: p.displayName ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    ageBand: p.ageBand ?? '',
    locality: p.locality ?? '',
    city: p.city ?? 'Hyderabad',
    category: p.category ?? '',
    subcategories: p.subcategories ?? [],
    skills: p.skills ?? [],
    skillDescription: p.skillDescription ?? '',
    yearsExperience: p.yearsExperience ?? '',
    portfolio: p.portfolio ?? '',
    instagramUrl: p.instagramUrl ?? '',
    preplyUrl: p.preplyUrl ?? '',
    urbanproUrl: p.urbanproUrl ?? '',
    teacheronUrl: p.teacheronUrl ?? '',
    childrenExperience: p.childrenExperience ?? '',
    childrenExperienceDetail: p.childrenExperienceDetail ?? '',
    childAgeGroups: p.childAgeGroups ?? [],
    teachingFormats: p.teachingFormats ?? [],
    venuePreferences: p.venuePreferences ?? [],
    travelRadius: p.travelRadius ?? '',
    homeAddress: p.homeAddress ?? '',
    homeLat: p.location?.lat ?? null,
    homeLng: p.location?.lng ?? null,
    availableDays: p.availableDays ?? [],
    timeSlots: p.timeSlots ?? [],
    availabilityDates: p.availabilityDates ?? [],
    preferredAvailability: p.preferredAvailability ?? '',
    sessionFrequency: p.sessionFrequency ?? '',
    whyJoin: p.whyJoin ?? '',
  };
}

export default function ProviderPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [customerAccount, setCustomerAccount] = useState<PublicUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [documents, setDocuments] = useState<TeacherDocumentDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Restore any existing session + saved profile on load.
  useEffect(() => {
    let active = true;
    if (new URLSearchParams(window.location.search).get('mode') === 'register') {
      setMode('register');
    }
    void hydrateCustomerSession().then((existing) => {
      if (!active) return;
      if (existing && existing.role !== Role.TEACHER) {
        setCustomerAccount(existing);
        setSessionReady(true);
        return;
      }
      setUser(existing);
      setSessionReady(true);
      if (!existing) return;
      setForm((current) => ({
        ...current,
        fullName: current.fullName || existing.displayName,
        email: current.email || existing.email,
      }));
      createTeacherClient()
        .getMyTeacherProfile()
        .then((profile) => {
          setForm(formFromProfile(profile));
          setDocuments(profile.documents ?? []);
          setVerificationStatus(profile.verificationStatus);
          setRejectionReason(profile.rejectionReason);
        })
        .catch(() => {
          /* No profile yet — start from an empty form. */
        });
    });
    return () => {
      active = false;
    };
  }, []);

  async function activateProviderAccount() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await createAuthClient().becomeProvider();
      saveCustomerSession(response.accessToken, response.user);
      setCustomerAccount(null);
      setUser(response.user);
      setForm((current) => ({
        ...current,
        fullName: current.fullName || response.user.displayName,
        email: current.email || response.user.email,
      }));
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : 'Could not start provider onboarding');
    } finally {
      setAuthLoading(false);
    }
  }

  async function useAnotherAccount() {
    await signOutCustomerSession();
    setCustomerAccount(null);
    setUser(null);
    setAuthError(null);
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Subcategories available for the chosen category (from the shared taxonomy).
  const activeSubcategories = useMemo(() => {
    if (!form.category) return [];
    return (
      PROVIDER_CATEGORY_TAXONOMY.find((c) => c.category === form.category)?.subcategories ?? []
    );
  }, [form.category]);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const client = createAuthClient();
      const response =
        mode === 'login'
          ? await client.login(email.trim().toLowerCase(), password)
          : await client.register({
              email: email.trim().toLowerCase(),
              password,
              displayName: displayName.trim(),
              role: Role.TEACHER,
            });
      saveCustomerSession(response.accessToken, response.user);
      if (response.user.role !== Role.TEACHER) {
        setCustomerAccount(response.user);
        return;
      }
      setUser(response.user);
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || response.user.displayName,
        email: prev.email || response.user.email,
      }));
      // Load any existing profile for this account.
      try {
        const profile = await createTeacherClient().getMyTeacherProfile();
        setForm(formFromProfile(profile));
        setDocuments(profile.documents ?? []);
        setVerificationStatus(profile.verificationStatus);
        setRejectionReason(profile.rejectionReason);
      } catch {
        /* first-time provider, no profile yet */
      }
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : 'Could not sign in');
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    await signOutCustomerSession();
    setUser(null);
    setCustomerAccount(null);
    setForm(EMPTY_FORM);
    setDocuments([]);
    setVerificationStatus(null);
    setRejectionReason(null);
    setSaved(false);
  }

  async function uploadPortfolio(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file later by clearing the input value.
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Please upload a PDF file.');
      return;
    }
    if (!readCustomerUser()) {
      setUploadError('Your session expired. Please sign in again.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const profile = await createTeacherClient().uploadTeacherDocument(file, DocumentType.OTHER);
      setDocuments(profile.documents ?? []);
      setVerificationStatus(profile.verificationStatus);
      setRejectionReason(profile.rejectionReason);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : 'Could not upload the file');
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    if (!readCustomerUser()) {
      setSaveError('Your session expired. Please sign in again.');
      setSaving(false);
      return;
    }
    // Only send fields the provider actually filled in.
    const payload: UpsertTeacherProfileInput = {
      displayName: form.fullName.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      ageBand: form.ageBand || undefined,
      locality: form.locality.trim() || undefined,
      city: form.city.trim() || undefined,
      category: form.category || undefined,
      subcategories: form.subcategories.length ? form.subcategories : undefined,
      skills: form.skills.length ? form.skills : undefined,
      skillDescription: form.skillDescription.trim() || undefined,
      yearsExperience: form.yearsExperience || undefined,
      portfolio: form.portfolio.trim() || undefined,
      instagramUrl: form.instagramUrl.trim() || undefined,
      preplyUrl: form.preplyUrl.trim() || undefined,
      urbanproUrl: form.urbanproUrl.trim() || undefined,
      teacheronUrl: form.teacheronUrl.trim() || undefined,
      childrenExperience: form.childrenExperience || undefined,
      childrenExperienceDetail: form.childrenExperienceDetail.trim() || undefined,
      childAgeGroups: form.childAgeGroups.length ? form.childAgeGroups : undefined,
      teachingFormats: form.teachingFormats.length ? form.teachingFormats : undefined,
      venuePreferences: form.venuePreferences.length ? form.venuePreferences : undefined,
      travelRadius: form.travelRadius || undefined,
      homeAddress: form.homeAddress.trim() || undefined,
      location:
        form.homeLat !== null && form.homeLng !== null
          ? { lat: form.homeLat, lng: form.homeLng }
          : undefined,
      availableDays: form.availableDays.length ? form.availableDays : undefined,
      timeSlots: form.timeSlots.length ? form.timeSlots : undefined,
      availabilityDates: form.availabilityDates.length ? form.availabilityDates : undefined,
      preferredAvailability: form.preferredAvailability.trim() || undefined,
      sessionFrequency: form.sessionFrequency || undefined,
      whyJoin: form.whyJoin.trim() || undefined,
    };
    try {
      const profile = await createTeacherClient().upsertMyTeacherProfile(payload);
      setVerificationStatus(profile.verificationStatus);
      setRejectionReason(profile.rejectionReason);
      setSaved(true);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    setSubmittingReview(true);
    setSaveError(null);
    try {
      const profile = await createTeacherClient().submitTeacherProfile();
      setVerificationStatus(profile.verificationStatus);
      setRejectionReason(profile.rejectionReason);
      setSaved(true);
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : 'Could not submit your profile for review',
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell provider-page">
        <AppHeader greeting={false} />
        <span className="eyebrow purple">PROVIDER ACCESS</span>
        <h1>{user ? `Welcome, ${user.displayName}.` : 'Share your craft with young learners.'}</h1>
        <p>
          {user
            ? 'Tell us what you teach and when you’re available. Your answers help us match you with the right families.'
            : 'Sign in or create a provider account to build your profile and availability.'}
        </p>

        {!sessionReady ? (
          <p className="section-hint" role="status">Checking your secure provider session…</p>
        ) : customerAccount ? (
          <section className="provider-account-choice">
            <span className="eyebrow purple">CONTINUE WITH THIS ACCOUNT</span>
            <h2>{customerAccount.displayName}, become a provider?</h2>
            <p>
              You’re signed in as {customerAccount.email}. We’ll keep this account and start the
              moderated educator onboarding process—no second login is needed.
            </p>
            {authError && <p className="form-error">{authError}</p>}
            <button
              className="primary-wide"
              type="button"
              disabled={authLoading}
              onClick={() => void activateProviderAccount()}
            >
              {authLoading ? 'Preparing provider account…' : 'Continue as a provider'}
            </button>
            <button
              className="secondary-wide"
              type="button"
              disabled={authLoading}
              onClick={() => void useAnotherAccount()}
            >
              Use another account
            </button>
          </section>
        ) : !user ? (
          <>
            <OidcButtons returnTo="/provider" providerAccount />
            <form className="customer-auth-form" onSubmit={authenticate}>
              <div className="auth-tabs">
                <button
                  type="button"
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => setMode('login')}
                >
                  Provider sign in
                </button>
                <button
                  type="button"
                  className={mode === 'register' ? 'active' : ''}
                  onClick={() => setMode('register')}
                >
                  Apply to teach
                </button>
              </div>
              {mode === 'register' && (
                <label>
                  Full name
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {authError && <p className="form-error">{authError}</p>}
              <button className="primary-wide" type="submit" disabled={authLoading}>
                {authLoading
                  ? 'Connecting…'
                  : mode === 'register'
                    ? 'Create provider account'
                    : 'Sign in to Provider Studio'}
              </button>
              {mode === 'login' && (
                <Link className="auth-link" href="/profile?mode=forgot&returnTo=%2Fprovider">
                  Forgot your password?
                </Link>
              )}
            </form>
          </>
        ) : (
          <>
            <ProviderWorkflow status={verificationStatus} />
            <form className="provider-form" onSubmit={saveProfile}>
            {/* Section 1 — About you */}
            <ProviderSection eyebrow="SECTION 1" title="About you">
              <TextField
                label="Full name"
                required
                value={form.fullName}
                onChange={(v) => set('fullName', v)}
              />
              <TextField
                label="Phone / WhatsApp number"
                required
                value={form.phone}
                onChange={(v) => set('phone', v)}
              />
              <TextField
                label="Email address"
                required
                type="email"
                value={form.email}
                onChange={(v) => set('email', v)}
              />
              <ChoiceGroup
                label="Your age"
                options={Object.values(ProviderAgeBand).map((v) => ({
                  value: v,
                  label: AGE_BAND_LABELS[v],
                }))}
                value={form.ageBand}
                onChange={(v) => set('ageBand', v as ProviderAgeBand)}
              />
              <TextField
                label="Which area/locality do you live in?"
                required
                placeholder="Nanakramguda, Kondapur, Gachibowli, Jubilee Hills"
                value={form.locality}
                onChange={(v) => set('locality', v)}
              />
              <TextField
                label="Your city"
                required
                value={form.city}
                onChange={(v) => set('city', v)}
              />
            </ProviderSection>

            {/* Section 2 — What would you love to share? */}
            <ProviderSection eyebrow="SECTION 2" title="What would you love to share?">
              <ChoiceGroup
                label="Primary category"
                hint="Maps your profile to how families browse on Discover."
                options={PROVIDER_CATEGORY_TAXONOMY.map((c) => ({
                  value: c.category,
                  label: c.label,
                }))}
                value={form.category}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    category: v as ProviderCategory,
                    subcategories: [],
                  }))
                }
              />
              {activeSubcategories.length > 0 && (
                <CheckGroup
                  label="Subcategory you can teach"
                  options={activeSubcategories.map((s) => ({ value: s, label: s }))}
                  values={form.subcategories}
                  onToggle={(v) => set('subcategories', toggle(form.subcategories, v))}
                />
              )}
              <CheckGroup
                label="What skills would you like to teach/share with children?"
                required
                options={SKILL_OPTIONS.map((s) => ({ value: s, label: s }))}
                values={form.skills}
                onToggle={(v) => set('skills', toggle(form.skills, v))}
              />
              <TextArea
                label="Tell us about your skill in your own words"
                required
                hint="What do you love about it? How long have you been practising it? What would you enjoy sharing with children?"
                value={form.skillDescription}
                onChange={(v) => set('skillDescription', v)}
              />
              <ChoiceGroup
                label="How many years have you been practising this skill?"
                options={Object.values(ProviderExperience).map((v) => ({
                  value: v,
                  label: EXPERIENCE_LABELS[v],
                }))}
                value={form.yearsExperience}
                onChange={(v) => set('yearsExperience', v as ProviderExperience)}
              />
            </ProviderSection>

            {/* Section 3 — Show us your work */}
            <ProviderSection eyebrow="SECTION 3" title="Show us your work">
              <div className="provider-links">
                <TextField
                  label="Instagram"
                  type="url"
                  placeholder="https://instagram.com/yourhandle"
                  value={form.instagramUrl}
                  onChange={(v) => set('instagramUrl', v)}
                />
                <TextField
                  label="Preply"
                  type="url"
                  placeholder="https://preply.com/…"
                  value={form.preplyUrl}
                  onChange={(v) => set('preplyUrl', v)}
                />
                <TextField
                  label="UrbanPro"
                  type="url"
                  placeholder="https://urbanpro.com/…"
                  value={form.urbanproUrl}
                  onChange={(v) => set('urbanproUrl', v)}
                />
                <TextField
                  label="TeacherOn"
                  type="url"
                  placeholder="https://teacheron.com/…"
                  value={form.teacheronUrl}
                  onChange={(v) => set('teacheronUrl', v)}
                />
              </div>
              <TextArea
                label="Other portfolio / work links"
                hint="YouTube, website, Google Drive portfolio, performances, workshops, artwork, projects or anything else that helps us understand your work."
                value={form.portfolio}
                onChange={(v) => set('portfolio', v)}
              />
              <div className="provider-label">
                <span>Upload your portfolio (PDF)</span>
                <small className="provider-hint">
                  {verificationStatus === null
                    ? 'Save your provider profile first, then attach a PDF portfolio or resume.'
                    : 'Attach a PDF portfolio or resume. Uploaded straight to secure storage.'}
                </small>
                {documents.length > 0 && (
                  <ul className="provider-docs">
                    {documents.map((doc) => (
                      <li key={doc.id}>
                        <Icon name="check" size={13} /> {doc.fileName}
                      </li>
                    ))}
                  </ul>
                )}
                <label className="provider-upload">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={uploadPortfolio}
                    disabled={uploading || verificationStatus === null}
                  />
                  <span>
                    {uploading
                      ? 'Uploading…'
                      : verificationStatus === null
                        ? 'Save profile to enable upload'
                        : 'Choose PDF file'}
                  </span>
                </label>
                {uploadError && <p className="form-error">{uploadError}</p>}
              </div>
              <ChoiceGroup
                label="Have you taught or worked with children before?"
                options={Object.values(ChildrenExperience).map((v) => ({
                  value: v,
                  label: CHILDREN_EXPERIENCE_LABELS[v],
                }))}
                value={form.childrenExperience}
                onChange={(v) => set('childrenExperience', v as ChildrenExperience)}
              />
              <TextArea
                label="If yes, tell us briefly about your experience with children"
                value={form.childrenExperienceDetail}
                onChange={(v) => set('childrenExperienceDetail', v)}
              />
            </ProviderSection>

            {/* Section 4 — What would you like to teach? */}
            <ProviderSection eyebrow="SECTION 4" title="What would you like to teach?">
              <CheckGroup
                label="Which child age groups would you be comfortable working with?"
                options={Object.values(ChildAgeGroup).map((v) => ({
                  value: v,
                  label: CHILD_AGE_GROUP_LABELS[v],
                }))}
                values={form.childAgeGroups}
                onToggle={(v) =>
                  set('childAgeGroups', toggle(form.childAgeGroups, v as ChildAgeGroup))
                }
              />
              <CheckGroup
                label="How would you prefer to teach?"
                options={Object.values(TeachingFormat).map((v) => ({
                  value: v,
                  label: TEACHING_FORMAT_LABELS[v],
                }))}
                values={form.teachingFormats}
                onToggle={(v) =>
                  set('teachingFormats', toggle(form.teachingFormats, v as TeachingFormat))
                }
              />
              <CheckGroup
                label="Where would you be comfortable conducting a class?"
                options={Object.values(ClassVenuePreference).map((v) => ({
                  value: v,
                  label: VENUE_LABELS[v],
                }))}
                values={form.venuePreferences}
                onToggle={(v) =>
                  set('venuePreferences', toggle(form.venuePreferences, v as ClassVenuePreference))
                }
              />
              <HomeLocationField
                address={form.homeAddress}
                lat={form.homeLat}
                lng={form.homeLng}
                onResolve={(address, lat, lng) =>
                  setForm((prev) => ({
                    ...prev,
                    homeAddress: address,
                    homeLat: lat,
                    homeLng: lng,
                  }))
                }
              />
              <ChoiceGroup
                label="How far are you comfortable travelling to conduct a class?"
                options={Object.values(TravelRadius).map((v) => ({
                  value: v,
                  label: TRAVEL_LABELS[v],
                }))}
                value={form.travelRadius}
                onChange={(v) => set('travelRadius', v as TravelRadius)}
              />
            </ProviderSection>

            {/* Section 5 — Your availability */}
            <ProviderSection eyebrow="SECTION 5" title="Your availability">
              <CheckGroup
                label="Which days are you generally available?"
                options={Object.values(AvailabilityDay).map((v) => ({
                  value: v,
                  label: DAY_LABELS[v],
                }))}
                values={form.availableDays}
                onToggle={(v) =>
                  set('availableDays', toggle(form.availableDays, v as AvailabilityDay))
                }
              />
              <CheckGroup
                label="What time slots usually work for you?"
                options={Object.values(TimeSlot).map((v) => ({ value: v, label: SLOT_LABELS[v] }))}
                values={form.timeSlots}
                onToggle={(v) => set('timeSlots', toggle(form.timeSlots, v as TimeSlot))}
              />
              <DateSlotPicker
                value={form.availabilityDates}
                onChange={(next) => set('availabilityDates', next)}
              />
              <TextArea
                label="Tell us your preferred availability more specifically"
                hint="Example: Saturday 10 AM–1 PM, Sunday 4–7 PM, weekday evenings after 5 PM."
                value={form.preferredAvailability}
                onChange={(v) => set('preferredAvailability', v)}
              />
              <ChoiceGroup
                label="How often would you ideally like to conduct sessions?"
                options={Object.values(SessionFrequency).map((v) => ({
                  value: v,
                  label: FREQUENCY_LABELS[v],
                }))}
                value={form.sessionFrequency}
                onChange={(v) => set('sessionFrequency', v as SessionFrequency)}
              />
            </ProviderSection>

            {/* Final */}
            <ProviderSection
              eyebrow="ONE LAST THING"
              title="Why would you like to be part of Learn & Build? 🌱"
            >
              <TextArea
                label="Share what draws you to teaching with us"
                required
                value={form.whyJoin}
                onChange={(v) => set('whyJoin', v)}
              />
            </ProviderSection>

            {saveError && <p className="form-error">{saveError}</p>}
            {verificationStatus && (
              <p className="provider-status-line">
                Verification status: <strong>{verificationStatus.replaceAll('_', ' ')}</strong>
              </p>
            )}
            {verificationStatus === VerificationStatus.REJECTED && rejectionReason && (
              <p className="form-error">Moderator note: {rejectionReason}</p>
            )}
            {saved && (
              <p className="provider-saved">
                <Icon name="check" size={14} /> Profile changes saved.
              </p>
            )}
            <button className="primary-wide" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save provider profile'}
            </button>
            {(verificationStatus === VerificationStatus.PENDING ||
              verificationStatus === VerificationStatus.REJECTED) && (
              <button
                className="secondary-wide"
                type="button"
                onClick={submitForReview}
                disabled={submittingReview || documents.length === 0}
              >
                {submittingReview ? 'Submitting…' : 'Submit profile for review'}
              </button>
            )}
            {verificationStatus === VerificationStatus.PENDING && documents.length === 0 && (
              <p className="section-hint">Upload at least one PDF before submitting for review.</p>
            )}
            <button className="secondary-wide" type="button" onClick={signOut}>
              Sign out of provider account
            </button>
            </form>
          </>
        )}
        <ProviderNav />
      </div>
    </main>
  );
}

function ProviderWorkflow({ status }: { status: VerificationStatus | null }) {
  const reviewLabel = status ? status.replaceAll('_', ' ') : 'not submitted';
  return (
    <div className="provider-workflow" aria-label="Provider setup progress">
      <span className="active">
        <strong>1. Profile</strong>
        <small>Tell us about your teaching.</small>
      </span>
      <span>
        <strong>2. Review</strong>
        <small>{reviewLabel}</small>
      </span>
      <span>
        <strong>3. Studio</strong>
        <small>Create and manage classes.</small>
      </span>
    </div>
  );
}

/* -------- presentational sub-components (match app styling) -------- */

function ProviderSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-block provider-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow coral">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="provider-fields">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="provider-label">
      <span>
        {label}
        {required && <em className="req"> *</em>}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="provider-label">
      <span>
        {label}
        {required && <em className="req"> *</em>}
      </span>
      {hint && <small className="provider-hint">{hint}</small>}
      <textarea
        rows={4}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div className="provider-label">
      <span>{label}</span>
      {hint && <small className="provider-hint">{hint}</small>}
      <div className="provider-chips" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            type="button"
            key={opt.value}
            className={value === opt.value ? 'chip active' : 'chip'}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckGroup<T extends string>({
  label,
  options,
  values,
  onToggle,
  required,
}: {
  label: string;
  options: { value: T; label: string }[];
  values: T[];
  onToggle: (v: T) => void;
  required?: boolean;
}) {
  return (
    <div className="provider-label">
      <span>
        {label}
        {required && <em className="req"> *</em>}
      </span>
      <div className="provider-chips" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            type="button"
            key={opt.value}
            className={values.includes(opt.value) ? 'chip active' : 'chip'}
            aria-pressed={values.includes(opt.value)}
            onClick={() => onToggle(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Availability picker: pick specific dates over the next ~2 months, and for
 * each selected date choose one-hour slots between 9am and 9pm.
 */
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
      // Default a newly-picked date to all-day; the provider trims from there.
      onChange([...value, { date, slots: [...ALL_DAY_SLOTS] }]);
      setOpenDate(date);
    }
  }

  function toggleSlot(date: string, slot: DaySlot) {
    onChange(
      value.map((e) =>
        e.date === date ? { ...e, slots: toggle(e.slots, slot) } : e,
      ),
    );
  }

  function setAll(date: string, all: boolean) {
    onChange(
      value.map((e) =>
        e.date === date ? { ...e, slots: all ? [...ALL_DAY_SLOTS] : [] } : e,
      ),
    );
  }

  const selected = [...value].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="provider-label">
      <span>Pick the dates and times you can teach</span>
      <small className="provider-hint">
        Choose dates in the next two months, then tap a selected date to fine-tune its
        9am–9pm slots.
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
              <button type="button" onClick={() => setAll(openDate, true)}>
                All day
              </button>
              <button type="button" onClick={() => setAll(openDate, false)}>
                Clear
              </button>
              <button type="button" onClick={() => toggleDate(openDate)}>
                Remove date
              </button>
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
          <span className="avail-summary-title">
            Selected days ({selected.length})
          </span>
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

/**
 * Home location: use the browser's GPS, or search an address (OpenStreetMap
 * Nominatim) and pick a result. Both resolve to lat/lng coordinates.
 */
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

  async function searchAddress() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=' +
        encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json();
      setResults(
        data.map((r) => ({
          label: r.display_name,
          lat: Number(r.lat),
          lng: Number(r.lon),
        })),
      );
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
        Use your current location or search an address. This sets the map point we
        measure commute distance from.
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
