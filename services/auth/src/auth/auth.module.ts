import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '@learn-and-build/nest-auth';
import { AdminSeeder } from './admin-seeder.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcService } from './oidc/oidc.service';
import { OidcConfigService } from './oidc/oidc-config.service';
import { AuthSession } from './auth-session.entity';
import { AccountToken } from './account-token.entity';
import { AccountMailerService } from './account-mailer.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([AuthSession, AccountToken]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-insecure-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
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
    AccountMailerService,
    AuthRateLimitGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
