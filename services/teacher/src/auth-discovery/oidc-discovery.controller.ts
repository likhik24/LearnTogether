import { Controller, Get } from '@nestjs/common';
import type { OidcProviderInfo } from '@learn-and-build/types';
import { OidcDiscoveryService } from './oidc-discovery.service';

/** Advertises the OIDC sign-in options (sourced from the auth service). */
@Controller('auth/oidc')
export class OidcDiscoveryController {
  constructor(private readonly discovery: OidcDiscoveryService) {}

  @Get('providers')
  providers(): Promise<OidcProviderInfo[]> {
    return this.discovery.providers();
  }
}
