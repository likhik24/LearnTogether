import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { OidcProviderInfo } from '@learn-and-build/types';
import { OidcService } from './oidc.service';
import { OidcConfigService } from './oidc-config.service';

@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly oidc: OidcService,
    private readonly config: OidcConfigService,
  ) {}

  /** Lists configured providers so the client can render sign-in buttons. */
  @Get('providers')
  providers(): OidcProviderInfo[] {
    return this.config.getProviders().map((p) => ({
      id: p.slug,
      label: p.label,
      loginUrl: `${this.config.redirectBase}/auth/oidc/${p.slug}/login`,
    }));
  }

  /** Starts the login flow by redirecting to the provider. */
  @Get(':provider/login')
  async login(
    @Param('provider') provider: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.oidc.createAuthorizationUrl(provider);
    res.redirect(url);
  }

  /** Provider redirects back here; we exchange the code and hand off a JWT. */
  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.oidc.handleCallback(provider, query);
      const target = new URL(this.config.successRedirect);
      // Deliver the token in the URL fragment so it never hits server logs.
      target.hash = `access_token=${encodeURIComponent(result.accessToken)}`;
      res.redirect(target.toString());
    } catch {
      const target = new URL(this.config.successRedirect);
      target.hash = 'error=oidc_login_failed';
      res.redirect(target.toString());
    }
  }
}
