import type { PublicUser } from '@learn-and-build/types';
import { createAuthClient, createSchedulingClient } from './api';

export const CUSTOMER_TOKEN_KEY = 'learn-together-access-token';
export const CUSTOMER_USER_KEY = 'learn-together-user';

export function getCustomerClient() {
  if (typeof window === 'undefined') return null;
  return readCustomerUser() ? createAuthClient() : null;
}

export function getCustomerSchedulingClient() {
  if (typeof window === 'undefined') return null;
  return readCustomerUser() ? createSchedulingClient() : null;
}

export function saveCustomerSession(_accessToken: string, user: PublicUser) {
  // Authentication lives in rotating HttpOnly cookies. Keep only public UI
  // state here and remove tokens left behind by older releases.
  window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  window.localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
}

export function readCustomerUser(): PublicUser | null {
  const raw = window.localStorage.getItem(CUSTOMER_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicUser;
  } catch {
    return null;
  }
}

export function clearCustomerSession() {
  window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  window.localStorage.removeItem(CUSTOMER_USER_KEY);
  primaryChildPromise = null;
}

export async function signOutCustomerSession(): Promise<void> {
  try {
    await createAuthClient().logout();
  } finally {
    clearCustomerSession();
  }
}

export interface PrimaryChild {
  name: string;
  interests: string[];
}

let primaryChildPromise: Promise<PrimaryChild | null> | null = null;

function loadLocalChild(): PrimaryChild | null {
  try {
    const raw = window.localStorage.getItem('learn-together-child-profile');
    if (!raw) return null;
    const local = JSON.parse(raw) as { name?: string; interests?: string[] };
    return local.name ? { name: local.name, interests: local.interests ?? [] } : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the signed-in parent's first child (API, with a localStorage
 * fallback). Memoized per page load so many components can call it cheaply.
 */
/** Clears the memoized child so the next read reflects a just-saved profile. */
export function invalidatePrimaryChild() {
  primaryChildPromise = null;
}

export function getPrimaryChild(): Promise<PrimaryChild | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (primaryChildPromise) return primaryChildPromise;
  const client = getCustomerClient();
  primaryChildPromise = client
    ? client
        .listChildren()
        .then((items) =>
          items[0]
            ? { name: items[0].name, interests: items[0].interests ?? [] }
            : loadLocalChild(),
        )
        .catch(() => loadLocalChild())
    : Promise.resolve(loadLocalChild());
  return primaryChildPromise;
}
