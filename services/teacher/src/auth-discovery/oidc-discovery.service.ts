import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OidcProviderInfo } from '@learn-and-build/types';

/**
 * Thin passthrough to the auth service's OIDC provider list. Identity stays
 * centralized in the auth service; the teacher service only advertises the
 * same sign-in entrypoints so its own clients can authenticate. Tokens issued
 * by that flow are already accepted here via the shared JWT strategy.
 */
@Injectable()
export class OidcDiscoveryService {
  private readonly logger = new Logger(OidcDiscoveryService.name);

  constructor(private readonly config: ConfigService) {}

  private get authServiceUrl(): string {
    return this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');
  }

  async providers(): Promise<OidcProviderInfo[]> {
    try {
      const res = await fetch(`${this.authServiceUrl}/auth/oidc/providers`);
      if (!res.ok) {
        return [];
      }
      return (await res.json()) as OidcProviderInfo[];
    } catch (err) {
      this.logger.warn(
        `Failed to reach auth service for OIDC providers: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }
}
