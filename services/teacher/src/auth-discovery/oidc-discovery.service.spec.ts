import { ConfigService } from '@nestjs/config';
import { OidcDiscoveryService } from './oidc-discovery.service';

function configWith(values: Record<string, string>): ConfigService {
  return { get: (k: string, d?: string) => values[k] ?? d } as ConfigService;
}

describe('OidcDiscoveryService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns providers fetched from the auth service', async () => {
    const providers = [
      { id: 'google', label: 'Google', loginUrl: 'http://auth/x' },
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => providers }) as never;

    const svc = new OidcDiscoveryService(
      configWith({ AUTH_SERVICE_URL: 'http://auth:3001' }),
    );
    await expect(svc.providers()).resolves.toEqual(providers);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://auth:3001/auth/oidc/providers',
    );
  });

  it('returns an empty list when the auth service is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never;
    const svc = new OidcDiscoveryService(configWith({}));
    await expect(svc.providers()).resolves.toEqual([]);
  });

  it('returns an empty list on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;
    const svc = new OidcDiscoveryService(configWith({}));
    await expect(svc.providers()).resolves.toEqual([]);
  });
});
