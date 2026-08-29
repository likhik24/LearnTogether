import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthPrincipal } from '@learn-and-build/types';

/**
 * Validates JWTs signed by the auth service. Every service uses the same
 * JWT_SECRET so tokens issued at login are accepted platform-wide.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieToken,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-insecure-secret'),
    });
  }

  validate(payload: AuthPrincipal): AuthPrincipal {
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}

function cookieToken(request: { headers?: { cookie?: string } } | undefined): string | null {
  const header = request?.headers?.cookie;
  if (!header) return null;
  for (const item of header.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === 'lt_access') return decodeURIComponent(value.join('='));
  }
  return null;
}
