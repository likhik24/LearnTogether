import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@learn-and-build/types';
import { OidcConfigService } from './oidc-config.service';

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

describe('OidcConfigService', () => {
  it('enables no providers when nothing is configured', () => {
    const svc = new OidcConfigService(configWith({}));
    expect(svc.getProviders()).toHaveLength(0);
  });

  it('enables Google when a client id is present', () => {
    const svc = new OidcConfigService(
      configWith({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec' }),
    );
    const providers = svc.getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe(AuthProvider.GOOGLE);
    expect(providers[0].issuer).toBe('https://accounts.google.com');
  });

  it('requires both issuer and client id for AWS Cognito', () => {
    const missingIssuer = new OidcConfigService(
      configWith({ AWS_COGNITO_CLIENT_ID: 'aid' }),
    );
    expect(missingIssuer.getProviders()).toHaveLength(0);

    const svc = new OidcConfigService(
      configWith({
        AWS_COGNITO_CLIENT_ID: 'aid',
        AWS_COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/pool',
      }),
    );
    expect(svc.getProvider('aws')?.id).toBe(AuthProvider.AWS);
  });

  it('builds a provider-specific redirect URI', () => {
    const svc = new OidcConfigService(
      configWith({ OIDC_REDIRECT_BASE: 'https://auth.example.com' }),
    );
    expect(svc.redirectUri('google')).toBe(
      'https://auth.example.com/auth/oidc/google/callback',
    );
  });
});
