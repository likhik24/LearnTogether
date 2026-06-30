import { ApiClient } from '@learn-and-build/api-client';

/**
 * Base URL of the auth service. Configurable via env so the same build works
 * across local/dev/prod. Defaults to the local docker-compose port.
 */
export const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://localhost:3001';

export function createAuthClient(token?: string): ApiClient {
  return new ApiClient({ baseUrl: AUTH_API_URL, token });
}
