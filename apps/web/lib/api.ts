import { ApiClient } from '@learn-and-build/api-client';
import type { VoiceQueryResponse } from '@learn-and-build/types';

/**
 * Service base URLs. Configurable via env so the same build works across
 * local/dev/prod. Defaults match the local docker-compose ports.
 */
export const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://localhost:3001';
export const SEARCH_API_URL =
  process.env.NEXT_PUBLIC_SEARCH_API_URL ?? 'http://localhost:3003';
export const VOICE_API_URL =
  process.env.NEXT_PUBLIC_VOICE_API_URL ?? 'http://localhost:3005';

export function createAuthClient(token?: string): ApiClient {
  return new ApiClient({ baseUrl: AUTH_API_URL, token });
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
