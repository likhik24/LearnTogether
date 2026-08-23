import type {
  AuthTokenResponse,
  BookingDto,
  ClassOccurrence,
  ClassOfferingDto,
  ClassReservationDto,
  ClassSearchResponse,
  ChildProfileDto,
  CustomerNotificationDto,
  DiscoverClassDto,
  HealthResponse,
  OidcProviderInfo,
  PublicUser,
  Role,
  SavedClassDto,
} from '@learn-and-build/types';

export interface ApiClientOptions {
  /** Base URL of the target service, e.g. http://localhost:3001 */
  baseUrl: string;
  /** Optional bearer token for authenticated requests. */
  token?: string;
  /** Optional fetch implementation (defaults to global fetch). */
  fetchFn?: typeof fetch;
}

/**
 * Shared API client. Covers health plus the auth-service endpoints consumed by
 * the admin console. Expanded with more endpoints as services grow.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private token?: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    // Bind to the global object: native fetch throws "Illegal invocation" if
    // called as a method on another object (this !== window/globalThis).
    const fetchImpl = options.fetchFn ?? globalThis.fetch;
    this.fetchFn = fetchImpl.bind(globalThis);
    this.token = options.token;
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.token) {
      headers.set('authorization', `Bearer ${this.token}`);
    }
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Request ${path} failed (${res.status}): ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
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

  createChild(input: { name: string; birthDate?: string; interests?: string[]; avatarColor?: string }): Promise<ChildProfileDto> {
    return this.request<ChildProfileDto>('/customer/children', { method: 'POST', body: JSON.stringify(input) });
  }

  updateChild(id: string, input: { name?: string; birthDate?: string; interests?: string[]; avatarColor?: string }): Promise<ChildProfileDto> {
    return this.request<ChildProfileDto>(`/customer/children/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  }

  listSavedClasses(): Promise<SavedClassDto[]> {
    return this.request<SavedClassDto[]>('/customer/saved-classes');
  }

  saveClass(classRef: string, title: string): Promise<SavedClassDto> {
    return this.request<SavedClassDto>(`/customer/saved-classes/${encodeURIComponent(classRef)}`, { method: 'PUT', body: JSON.stringify({ title }) });
  }

  removeSavedClass(classRef: string): Promise<void> {
    return this.request<void>(`/customer/saved-classes/${encodeURIComponent(classRef)}`, { method: 'DELETE' });
  }

  listBookings(): Promise<BookingDto[]> {
    return this.request<BookingDto[]>('/customer/bookings');
  }

  createBooking(input: { classRef: string; classSlug?: string; title: string; scheduledStart: string; amountMinor: number; currency: string }): Promise<BookingDto> {
    return this.request<BookingDto>('/customer/bookings', { method: 'POST', body: JSON.stringify(input) });
  }

  cancelBooking(id: string): Promise<BookingDto> {
    return this.request<BookingDto>(`/customer/bookings/${id}/cancel`, { method: 'PATCH' });
  }

  listNotifications(unreadOnly = false): Promise<CustomerNotificationDto[]> {
    return this.request<CustomerNotificationDto[]>(`/customer/notifications${unreadOnly ? '?unreadOnly=true' : ''}`);
  }

  markNotificationRead(id: string): Promise<CustomerNotificationDto> {
    return this.request<CustomerNotificationDto>(`/customer/notifications/${id}/read`, { method: 'PATCH' });
  }

  markAllNotificationsRead(): Promise<void> {
    return this.request<void>('/customer/notifications/read-all', { method: 'POST' });
  }

  discoverClasses(params: { query?: string; lat?: number; lng?: number; radiusMeters?: number; days?: number } = {}): Promise<DiscoverClassDto[]> {
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
    return this.request<ClassOccurrence[]>(`/classes/${encodeURIComponent(id)}/availability?days=${days}`);
  }

  reserveClass(id: string, occurrenceStart: string, seats = 1): Promise<ClassReservationDto> {
    return this.request<ClassReservationDto>(`/classes/${encodeURIComponent(id)}/reservations`, { method: 'POST', body: JSON.stringify({ occurrenceStart, seats }) });
  }

  cancelClassReservation(classId: string, reservationId: string): Promise<ClassReservationDto> {
    return this.request<ClassReservationDto>(`/classes/${encodeURIComponent(classId)}/reservations/${encodeURIComponent(reservationId)}`, { method: 'DELETE' });
  }

  searchClasses(queryText: string, coords?: { lat: number; lng: number; radiusMeters?: number }): Promise<ClassSearchResponse> {
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
  DiscoverClassDto,
  HealthResponse,
  OidcProviderInfo,
  PublicUser,
  SavedClassDto,
} from '@learn-and-build/types';
export { Role } from '@learn-and-build/types';
