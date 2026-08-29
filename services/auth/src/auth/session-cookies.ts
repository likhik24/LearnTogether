import type { Request, Response } from 'express';
import type { SessionResult } from './auth.service';

export const ACCESS_COOKIE = 'lt_access';
export const REFRESH_COOKIE = 'lt_refresh';

export function writeSessionCookies(response: Response, result: SessionResult): void {
  const secure = process.env.NODE_ENV === 'production';
  response.cookie(ACCESS_COOKIE, result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1_000,
  });
  response.cookie(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1_000,
  });
}

export function clearSessionCookies(response: Response): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  response.clearCookie(ACCESS_COOKIE, options);
  response.clearCookie(REFRESH_COOKIE, options);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const item of header.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

export function sessionMetadata(request: Request): { ipAddress?: string; userAgent?: string } {
  const forwarded = request.headers['x-forwarded-for'];
  return {
    ipAddress:
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() || request.ip,
    userAgent: request.headers['user-agent'],
  };
}
