import { ApiClient } from '@learn-and-build/api-client';
import type { VoiceQueryResponse } from '@learn-and-build/types';

/**
 * Service base URLs. Configurable via env so the same build works across
 * local/dev/prod. Defaults match the local docker-compose ports.
 */
// Same-origin API paths, proxied to the backend services by Next rewrites
// (see next.config.mjs). Using relative paths means the browser only talks to
// this app's origin, so a single public tunnel exposes everything.
export const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? '/api/auth';
export const TEACHER_API_URL =
  process.env.NEXT_PUBLIC_TEACHER_API_URL ?? '/api/teacher';
export const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? '/api/search';
export const SCHEDULING_API_URL =
  process.env.NEXT_PUBLIC_SCHEDULING_API_URL ?? '/api/scheduling';
export const VOICE_API_URL =
  process.env.NEXT_PUBLIC_VOICE_API_URL ?? '/api/voice';

export function createAuthClient(token?: string): ApiClient {
  return new ApiClient({ baseUrl: AUTH_API_URL, token });
}

export function createSchedulingClient(token?: string): ApiClient {
  return new ApiClient({ baseUrl: SCHEDULING_API_URL, token });
}

export function createTeacherClient(token?: string): ApiClient {
  return new ApiClient({ baseUrl: TEACHER_API_URL, token });
}

export function createSearchClient(): ApiClient {
  return new ApiClient({ baseUrl: SEARCH_API_URL });
}

/**
 * Natural-language search via the voice service (handles queries like
 * "evening jiu jitsu near me"). Location is optional.
 */
export async function voiceSearch(
  transcript: string,
  coords?: { lat: number; lng: number },
): Promise<VoiceQueryResponse> {
  const res = await fetch(`${VOICE_API_URL}/voice/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transcript, ...(coords ?? {}) }),
  });
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  return (await res.json()) as VoiceQueryResponse;
}
