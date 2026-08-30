import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { OidcProviderInfo } from '@learn-and-build/types';
import { OidcService } from './oidc.service';
import { OidcConfigService } from './oidc-config.service';
import { sessionMetadata, writeSessionCookies } from '../session-cookies';
import { Role } from '@learn-and-build/types';

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
    @Query('returnTo') returnTo: string | undefined,
    @Query('account') account: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const role = account === 'provider' ? Role.TEACHER : Role.USER;
    const url = await this.oidc.createAuthorizationUrl(provider, returnTo, role);
    res.redirect(url);
  }

  /** Provider redirects back here; we exchange the code and hand off a JWT. */
  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
    @Req() request: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.oidc.handleCallback(provider, query, sessionMetadata(request));
      writeSessionCookies(res, result.session);
      const target = new URL(result.returnTo, this.config.successRedirect);
      res.redirect(target.toString());
    } catch {
      const target = new URL('/profile', this.config.successRedirect);
      target.searchParams.set('error', 'oidc_login_failed');
      res.redirect(target.toString());
    }
  }
}
