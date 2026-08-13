import { Module } from '@nestjs/common';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcDiscoveryController } from './oidc-discovery.controller';

@Module({
  controllers: [OidcDiscoveryController],
  providers: [OidcDiscoveryService],
})
export class AuthDiscoveryModule {}
