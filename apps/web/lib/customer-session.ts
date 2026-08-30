import type { PublicUser } from '@learn-and-build/types';
import { ApiError } from '@learn-and-build/api-client';
import { createAuthClient, createSchedulingClient } from './api';

export const CUSTOMER_TOKEN_KEY = 'learn-together-access-token';
export const CUSTOMER_USER_KEY = 'learn-together-user';
export const CUSTOMER_SESSION_EVENT = 'learn-together-session-change';

let sessionHydrationPromise: Promise<PublicUser | null> | null = null;

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
  sessionHydrationPromise = null;
  primaryChildPromise = null;
  persistCustomerUser(user);
  notifyCustomerSession(user);
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
  sessionHydrationPromise = null;
  primaryChildPromise = null;
  notifyCustomerSession(null);
}

/**
 * Resolves the server-side cookie session and reconciles the non-sensitive UI
 * cache. A cached user is never treated as proof that a browser is signed in.
 */
export async function hydrateCustomerSession(): Promise<PublicUser | null> {
  if (sessionHydrationPromise) return sessionHydrationPromise;
  // The HttpOnly cookie is the source of truth. localStorage is only a display
  // cache and may be cleared independently while a valid secure session remains.
  sessionHydrationPromise = createAuthClient()
    .me()
    .then((user) => {
      persistCustomerUser(user);
      return user;
    })
    .catch((caught) => {
      if (caught instanceof ApiError && caught.status === 401) clearCustomerSession();
      return null;
    })
    .finally(() => {
      sessionHydrationPromise = null;
    });
  return sessionHydrationPromise;
}

export function subscribeCustomerSession(listener: (user: PublicUser | null) => void): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<PublicUser | null>).detail);
  };
  window.addEventListener(CUSTOMER_SESSION_EVENT, handler);
  return () => window.removeEventListener(CUSTOMER_SESSION_EVENT, handler);
}

/** Reads a same-origin return path without allowing an open redirect. */
export function readSafeReturnTo(defaultPath = '/'): string {
  if (typeof window === 'undefined') return defaultPath;
  const value = new URLSearchParams(window.location.search).get('returnTo');
  if (!value) return defaultPath;
  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || !value.startsWith('/') || value.startsWith('//')) {
      return defaultPath;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return defaultPath;
  }
}

function persistCustomerUser(user: PublicUser): void {
  window.localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
}

function notifyCustomerSession(user: PublicUser | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CUSTOMER_SESSION_EVENT, { detail: user }));
}

export async function signOutCustomerSession(): Promise<void> {
  try {
    await createAuthClient().logout();
  } catch {
    // The browser must still forget local UI state if the server is briefly
    // unavailable; the HttpOnly cookies will expire independently.
  } finally {
    clearCustomerSession();
  }
}

export interface PrimaryChild {
  name: string;
  interests: string[];
}

let primaryChildPromise: Promise<PrimaryChild | null> | null = null;

/**
 * Resolves the signed-in parent's first server-backed child. Anonymous and
 * stale browser state must never be mistaken for a real family profile.
 * Memoized per page load so many components can call it cheaply.
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
            : null,
        )
        .catch(() => null)
    : Promise.resolve(null);
  return primaryChildPromise;
}
