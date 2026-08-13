import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '@learn-and-build/nest-auth';
import { AdminSeeder } from './admin-seeder.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcService } from './oidc/oidc.service';
import { OidcConfigService } from './oidc/oidc-config.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-insecure-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
    }),
  ],
  controllers: [AuthController, OidcController],
  providers: [
    AuthService,
    JwtStrategy,
    AdminSeeder,
    OidcService,
    OidcConfigService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
