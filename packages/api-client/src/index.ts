import type {
  AuthTokenResponse,
  HealthResponse,
  OidcProviderInfo,
  PublicUser,
  Role,
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
}

export type {
  AuthTokenResponse,
  HealthResponse,
  OidcProviderInfo,
  PublicUser,
} from '@learn-and-build/types';
export { Role } from '@learn-and-build/types';
