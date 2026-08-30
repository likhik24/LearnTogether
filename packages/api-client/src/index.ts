import type {
  AuthTokenResponse,
  AvailabilityDay,
  BookingDto,
  ChildAgeGroup,
  ChildrenExperience,
  ClassOccurrence,
  ClassOfferingDto,
  ClassModerationStatus,
  ClassOfferingStatus,
  ClassReservationDto,
  ClassSearchResponse,
  ClassVenuePreference,
  ChildProfileDto,
  CustomerNotificationDto,
  DateAvailability,
  DiscoverClassDto,
  GeoLocation,
  HealthResponse,
  InstructorGender,
  ModerationAuditDto,
  OidcProviderInfo,
  PresignedUploadResponse,
  PresignedImageUploadResponse,
  ProviderAgeBand,
  ProviderCategory,
  ProviderExperience,
  PublicUser,
  Role,
  SavedClassDto,
  SessionFrequency,
  TeacherProfileDto,
  TeachingFormat,
  TimeSlot,
  TravelRadius,
} from '@learn-and-build/types';
import { DocumentType } from '@learn-and-build/types';

/** Input accepted by the teacher profile upsert (mirrors the service DTO). */
export interface UpsertTeacherProfileInput {
  displayName: string;
  bio?: string;
  subjects?: string[];
  location?: GeoLocation;
  phone?: string;
  email?: string;
  ageBand?: ProviderAgeBand;
  locality?: string;
  city?: string;
  category?: ProviderCategory;
  subcategories?: string[];
  skills?: string[];
  skillDescription?: string;
  yearsExperience?: ProviderExperience;
  portfolio?: string;
  instagramUrl?: string;
  preplyUrl?: string;
  urbanproUrl?: string;
  teacheronUrl?: string;
  childrenExperience?: ChildrenExperience;
  childrenExperienceDetail?: string;
  childAgeGroups?: ChildAgeGroup[];
  teachingFormats?: TeachingFormat[];
  venuePreferences?: ClassVenuePreference[];
  travelRadius?: TravelRadius;
  homeAddress?: string;
  availableDays?: AvailabilityDay[];
  timeSlots?: TimeSlot[];
  availabilityDates?: DateAvailability[];
  preferredAvailability?: string;
  sessionFrequency?: SessionFrequency;
  whyJoin?: string;
}

export interface ApiClientOptions {
  /** Base URL of the target service, e.g. http://localhost:3001 */
  baseUrl: string;
  /** Optional bearer token for authenticated requests. */
  token?: string;
  /** Optional fetch implementation (defaults to global fetch). */
  fetchFn?: typeof fetch;
  /** Same-origin refresh endpoint used by browser cookie sessions. */
  refreshUrl?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// A single browser refresh rotation must serve requests from every service
// client; parallel refreshes would otherwise revoke one another.
let sharedRefreshPromise: Promise<boolean> | undefined;

export interface CreateClassInput {
  slug?: string;
  activity: string;
  description?: string;
  category?: string;
  ageMin?: number;
  ageMax?: number;
  priceMinor?: number;
  currency?: string;
  imageUrl?: string;
  tone?: string;
  rating?: number;
  reviewCount?: number;
  venueName?: string;
  instructorGender: InstructorGender;
  durationMinutes: number;
  seats: number;
  timings: Array<{
    weekday: number;
    startMinute: number;
  }>;
  location?: GeoLocation;
}

/**
 * Shared API client. Covers health plus the auth-service endpoints consumed by
 * the admin console. Expanded with more endpoints as services grow.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private token?: string;
  private readonly refreshUrl: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    // Bind to the global object: native fetch throws "Illegal invocation" if
    // called as a method on another object (this !== window/globalThis).
    const fetchImpl = options.fetchFn ?? globalThis.fetch;
    this.fetchFn = fetchImpl.bind(globalThis);
    this.token = options.token;
    this.refreshUrl = options.refreshUrl ?? '/api/auth/auth/refresh';
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.token) {
      headers.set('authorization', `Bearer ${this.token}`);
    }
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (
      res.status === 401 &&
      retry &&
      !this.token &&
      typeof (globalThis as { document?: unknown }).document !== 'undefined' &&
      !path.includes('/login') &&
      !path.includes('/register') &&
      !path.includes('/refresh')
    ) {
      const refreshed = await this.refreshSession();
      if (refreshed) return this.request<T>(path, init, false);
    }
    if (!res.ok) {
      const body = await res.text();
      let message = `Request failed (${res.status})`;
      try {
        const parsed = JSON.parse(body) as { message?: string | string[] };
        if (Array.isArray(parsed.message)) message = parsed.message.join(', ');
        else if (parsed.message) message = parsed.message;
      } catch {
        if (body.trim()) message = body.trim();
      }
      throw new ApiError(res.status, path, message);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private refreshSession(): Promise<boolean> {
    sharedRefreshPromise ??= this.fetchFn(this.refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        sharedRefreshPromise = undefined;
      });
    return sharedRefreshPromise;
  }

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  login(email: string, password: string): Promise<AuthTokenResponse> {
    return this.request<AuthTokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  register(input: {
    email: string;
    password: string;
    displayName: string;
    role?: Role;
  }): Promise<AuthTokenResponse> {
    return this.request<AuthTokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  me(): Promise<PublicUser> {
    return this.request<PublicUser>('/auth/me');
  }

  logout(): Promise<void> {
    return this.request<void>('/auth/logout', { method: 'POST' }, false);
  }

  resendEmailVerification(): Promise<void> {
    return this.request<void>('/auth/email-verification/resend', { method: 'POST' });
  }

  confirmEmailVerification(token: string): Promise<void> {
    return this.request<void>(
      '/auth/email-verification/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      },
      false,
    );
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.request<void>(
      '/auth/password-reset/request',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      false,
    );
  }

  confirmPasswordReset(token: string, password: string): Promise<void> {
    return this.request<void>(
      '/auth/password-reset/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      },
      false,
    );
  }

  /** The signed-in teacher's own profile (teacher service). */
  getMyTeacherProfile(): Promise<TeacherProfileDto> {
    return this.request<TeacherProfileDto>('/teachers/me');
  }

  /** Creates or updates the signed-in teacher's profile (upsert). */
  upsertMyTeacherProfile(input: UpsertTeacherProfileInput): Promise<TeacherProfileDto> {
    return this.request<TeacherProfileDto>('/teachers/me', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  submitTeacherProfile(): Promise<TeacherProfileDto> {
    return this.request<TeacherProfileDto>('/teachers/me/submit', { method: 'POST' });
  }

  /** Step 1: request a presigned S3 URL to upload a document directly. */
  presignTeacherDocument(input: {
    fileName: string;
    contentType: string;
    type: DocumentType;
  }): Promise<PresignedUploadResponse> {
    return this.request<PresignedUploadResponse>('/teachers/me/documents/presign', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /** Step 3: confirm an uploaded document, attaching it to the profile. */
  confirmTeacherDocument(input: {
    storageKey: string;
    fileName: string;
    type: DocumentType;
  }): Promise<TeacherProfileDto> {
    return this.request<TeacherProfileDto>('/teachers/me/documents', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Full document upload: presign, PUT the bytes straight to S3, then confirm.
   * Returns the updated profile with the new document attached.
   */
  async uploadTeacherDocument(
    file: File,
    type: DocumentType = DocumentType.OTHER,
  ): Promise<TeacherProfileDto> {
    const contentType = file.type || 'application/octet-stream';
    const { uploadUrl, storageKey } = await this.presignTeacherDocument({
      fileName: file.name,
      contentType,
      type,
    });
    const put = await this.fetchFn(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: file,
    });
    if (!put.ok) {
      throw new Error(`Upload to storage failed (${put.status})`);
    }
    return this.confirmTeacherDocument({
      storageKey,
      fileName: file.name,
      type,
    });
  }

  async uploadClassImage(file: File): Promise<string> {
    const contentType = file.type || 'image/jpeg';
    const presigned = await this.request<PresignedImageUploadResponse>(
      '/teachers/me/class-images/presign',
      {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType }),
      },
    );
    const put = await this.fetchFn(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: file,
    });
    if (!put.ok) throw new Error(`Upload to storage failed (${put.status})`);
    return presigned.publicUrl;
  }

  /** Lists configured OIDC providers (Google, AWS) for sign-in buttons. */
  oidcProviders(): Promise<OidcProviderInfo[]> {
    return this.request<OidcProviderInfo[]>('/auth/oidc/providers');
  }

  listUsers(): Promise<PublicUser[]> {
    return this.request<PublicUser[]>('/admin/users');
  }

  setUserRole(id: string, role: Role): Promise<PublicUser> {
    return this.request<PublicUser>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  listChildren(): Promise<ChildProfileDto[]> {
    return this.request<ChildProfileDto[]>('/customer/children');
  }

  createChild(input: {
    name: string;
    birthDate?: string;
    interests?: string[];
    avatarColor?: string;
  }): Promise<ChildProfileDto> {
    return this.request<ChildProfileDto>('/customer/children', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateChild(
    id: string,
    input: { name?: string; birthDate?: string; interests?: string[]; avatarColor?: string },
  ): Promise<ChildProfileDto> {
    return this.request<ChildProfileDto>(`/customer/children/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  listSavedClasses(): Promise<SavedClassDto[]> {
    return this.request<SavedClassDto[]>('/customer/saved-classes');
  }

  saveClass(classRef: string, title: string): Promise<SavedClassDto> {
    return this.request<SavedClassDto>(`/customer/saved-classes/${encodeURIComponent(classRef)}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }

  removeSavedClass(classRef: string): Promise<void> {
    return this.request<void>(`/customer/saved-classes/${encodeURIComponent(classRef)}`, {
      method: 'DELETE',
    });
  }

  listBookings(): Promise<BookingDto[]> {
    return this.request<BookingDto[]>('/customer/bookings');
  }

  createBooking(input: {
    childId: string;
    classRef: string;
    classSlug?: string;
    title: string;
    scheduledStart: string;
    amountMinor: number;
    currency: string;
  }): Promise<BookingDto> {
    return this.request<BookingDto>('/customer/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  cancelBooking(id: string): Promise<BookingDto> {
    return this.request<BookingDto>(`/customer/bookings/${id}/cancel`, { method: 'PATCH' });
  }

  listNotifications(unreadOnly = false): Promise<CustomerNotificationDto[]> {
    return this.request<CustomerNotificationDto[]>(
      `/customer/notifications${unreadOnly ? '?unreadOnly=true' : ''}`,
    );
  }

  markNotificationRead(id: string): Promise<CustomerNotificationDto> {
    return this.request<CustomerNotificationDto>(`/customer/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  markAllNotificationsRead(): Promise<void> {
    return this.request<void>('/customer/notifications/read-all', { method: 'POST' });
  }

  discoverClasses(
    params: {
      query?: string;
      lat?: number;
      lng?: number;
      radiusMeters?: number;
      days?: number;
    } = {},
  ): Promise<DiscoverClassDto[]> {
    const query = new URLSearchParams();
    if (params.query) query.set('q', params.query);
    if (params.lat !== undefined) query.set('lat', String(params.lat));
    if (params.lng !== undefined) query.set('lng', String(params.lng));
    if (params.radiusMeters !== undefined) query.set('radius', String(params.radiusMeters));
    if (params.days !== undefined) query.set('days', String(params.days));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request<DiscoverClassDto[]>(`/classes/discover${suffix}`);
  }

  getClassBySlug(slug: string): Promise<ClassOfferingDto> {
    return this.request<ClassOfferingDto>(`/classes/slug/${encodeURIComponent(slug)}`);
  }

  classAvailability(id: string, days = 21): Promise<ClassOccurrence[]> {
    return this.request<ClassOccurrence[]>(
      `/classes/${encodeURIComponent(id)}/availability?days=${days}`,
    );
  }

  listMyClasses(): Promise<ClassOfferingDto[]> {
    return this.request<ClassOfferingDto[]>('/classes/mine');
  }

  createClass(input: CreateClassInput): Promise<ClassOfferingDto> {
    return this.request<ClassOfferingDto>('/classes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateClass(id: string, input: Partial<CreateClassInput>): Promise<ClassOfferingDto> {
    return this.request<ClassOfferingDto>(`/classes/mine/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  setClassStatus(id: string, status: ClassOfferingStatus): Promise<ClassOfferingDto> {
    return this.request<ClassOfferingDto>(`/classes/mine/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  listClassesForModeration(status?: ClassModerationStatus): Promise<ClassOfferingDto[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<ClassOfferingDto[]>(`/classes/admin/moderation${suffix}`);
  }

  approveClass(id: string, reason?: string): Promise<ClassOfferingDto> {
    return this.request<ClassOfferingDto>(`/classes/admin/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  rejectClass(id: string, reason: string): Promise<ClassOfferingDto> {
    return this.request<ClassOfferingDto>(`/classes/admin/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  classModerationHistory(): Promise<ModerationAuditDto[]> {
    return this.request<ModerationAuditDto[]>('/classes/admin/moderation/history');
  }

  listTeachersForModeration(status?: string): Promise<TeacherProfileDto[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<TeacherProfileDto[]>(`/admin/teachers${suffix}`);
  }

  startTeacherReview(id: string): Promise<TeacherProfileDto> {
    return this.request<TeacherProfileDto>(
      `/admin/teachers/${encodeURIComponent(id)}/start-review`,
      { method: 'POST' },
    );
  }

  approveTeacher(id: string): Promise<TeacherProfileDto> {
    return this.request<TeacherProfileDto>(`/admin/teachers/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
  }

  rejectTeacher(id: string, reason: string): Promise<TeacherProfileDto> {
    return this.request<TeacherProfileDto>(`/admin/teachers/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  teacherModerationHistory(): Promise<ModerationAuditDto[]> {
    return this.request<ModerationAuditDto[]>('/admin/teachers/history');
  }

  reserveClass(id: string, occurrenceStart: string, seats = 1): Promise<ClassReservationDto> {
    return this.request<ClassReservationDto>(`/classes/${encodeURIComponent(id)}/reservations`, {
      method: 'POST',
      body: JSON.stringify({ occurrenceStart, seats }),
    });
  }

  cancelClassReservation(classId: string, reservationId: string): Promise<ClassReservationDto> {
    return this.request<ClassReservationDto>(
      `/classes/${encodeURIComponent(classId)}/reservations/${encodeURIComponent(reservationId)}`,
      { method: 'DELETE' },
    );
  }

  searchClasses(
    queryText: string,
    coords?: { lat: number; lng: number; radiusMeters?: number },
  ): Promise<ClassSearchResponse> {
    const query = new URLSearchParams({ q: queryText });
    if (coords) {
      query.set('lat', String(coords.lat));
      query.set('lng', String(coords.lng));
      query.set('radius', String(coords.radiusMeters ?? 5000));
    }
    return this.request<ClassSearchResponse>(`/search?${query.toString()}`);
  }
}

export type {
  AuthTokenResponse,
  BookingDto,
  ClassOccurrence,
  ClassOfferingDto,
  ClassReservationDto,
  ClassSearchResponse,
  ChildProfileDto,
  CustomerNotificationDto,
  DateAvailability,
  DiscoverClassDto,
  GeoLocation,
  HealthResponse,
  OidcProviderInfo,
  PresignedUploadResponse,
  PresignedImageUploadResponse,
  ProviderCategoryDef,
  PublicUser,
  SavedClassDto,
  TeacherDocumentDto,
  TeacherProfileDto,
  ModerationAuditDto,
} from '@learn-and-build/types';
export {
  AvailabilityDay,
  ChildAgeGroup,
  ChildrenExperience,
  ClassVenuePreference,
  ClassModerationStatus,
  ClassOfferingStatus,
  DaySlot,
  discoverQueryForCategory,
  DocumentType,
  InstructorGender,
  ProviderAgeBand,
  ProviderCategory,
  ProviderExperience,
  PROVIDER_CATEGORY_TAXONOMY,
  Role,
  SessionFrequency,
  TeachingFormat,
  TimeSlot,
  TravelRadius,
} from '@learn-and-build/types';
