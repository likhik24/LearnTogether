import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@learn-and-build/types';

export interface OidcProviderConfig {
  id: AuthProvider;
  /** URL slug used in routes, e.g. "google" / "aws". */
  slug: string;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  scope: string;
}

/**
 * Builds the set of OIDC providers from environment configuration. A provider
 * is only enabled when its client id is present, so the service runs fine with
 * zero, one, or both providers configured.
 */
@Injectable()
export class OidcConfigService {
  constructor(private readonly config: ConfigService) {}

  get redirectBase(): string {
    return this.config.get<string>('OIDC_REDIRECT_BASE', 'http://localhost:3001');
  }

  get successRedirect(): string {
    return this.config.get<string>(
      'OIDC_SUCCESS_REDIRECT',
      'http://localhost:3100/admin',
    );
  }

  redirectUri(slug: string): string {
    return `${this.redirectBase}/auth/oidc/${slug}/callback`;
  }

  getProviders(): OidcProviderConfig[] {
    return [this.google(), this.aws()].filter(
      (p): p is OidcProviderConfig => p !== null,
    );
  }

  getProvider(slug: string): OidcProviderConfig | undefined {
    return this.getProviders().find((p) => p.slug === slug);
  }

  private google(): OidcProviderConfig | null {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) return null;
    return {
      id: AuthProvider.GOOGLE,
      slug: 'google',
      label: 'Google',
      issuer: this.config.get<string>('GOOGLE_ISSUER', 'https://accounts.google.com'),
      clientId,
      clientSecret: this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      scope: 'openid email profile',
    };
  }

  private aws(): OidcProviderConfig | null {
    const clientId = this.config.get<string>('AWS_COGNITO_CLIENT_ID');
    const issuer = this.config.get<string>('AWS_COGNITO_ISSUER');
    if (!clientId || !issuer) return null;
    return {
      id: AuthProvider.AWS,
      slug: 'aws',
      label: 'AWS',
      issuer,
      clientId,
      clientSecret: this.config.get<string>('AWS_COGNITO_CLIENT_SECRET'),
      scope: 'openid email profile',
    };
  }
}
