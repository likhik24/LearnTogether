import type { PublicUser } from '@learn-and-build/types';
import { createAuthClient } from './api';

export const CUSTOMER_TOKEN_KEY = 'learn-together-access-token';
export const CUSTOMER_USER_KEY = 'learn-together-user';

export function getCustomerClient() {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);
  return token ? createAuthClient(token) : null;
}

export function saveCustomerSession(accessToken: string, user: PublicUser) {
  window.localStorage.setItem(CUSTOMER_TOKEN_KEY, accessToken);
  window.localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
}

export function readCustomerUser(): PublicUser | null {
  const raw = window.localStorage.getItem(CUSTOMER_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as PublicUser; } catch { return null; }
}

export function clearCustomerSession() {
  window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  window.localStorage.removeItem(CUSTOMER_USER_KEY);
}
