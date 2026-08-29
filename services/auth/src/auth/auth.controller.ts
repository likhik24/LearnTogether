import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthPrincipal, AuthTokenResponse, PublicUser } from '@learn-and-build/types';
import { AuthService, type SessionResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard, CurrentUser } from '@learn-and-build/nest-auth';
import { UsersService } from '../users/users.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { RequestAccountTokenDto } from './dto/request-account-token.dto';
import { ConsumeAccountTokenDto } from './dto/consume-account-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  clearSessionCookies,
  readCookie,
  REFRESH_COOKIE,
  sessionMetadata,
  writeSessionCookies,
} from './session-cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    return this.finishSession(response, await this.auth.register(dto, sessionMetadata(request)));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    return this.finishSession(response, await this.auth.login(dto, sessionMetadata(request)));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    const token = readCookie(request, REFRESH_COOKIE);
    if (!token)
      return this.finishSession(response, await this.auth.refresh('', sessionMetadata(request)));
    return this.finishSession(response, await this.auth.refresh(token, sessionMetadata(request)));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(request, REFRESH_COOKIE));
    clearSessionCookies(response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() principal: AuthPrincipal): Promise<PublicUser> {
    const user = await this.users.findById(principal.sub);
    if (!user) throw new Error('User not found');
    return user.toPublic();
  }

  @Post('email-verification/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, AuthRateLimitGuard)
  resendVerification(@CurrentUser() principal: AuthPrincipal): Promise<void> {
    return this.auth.resendVerification(principal.sub);
  }

  @Post('email-verification/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  verifyEmail(@Body() dto: ConsumeAccountTokenDto): Promise<void> {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  requestPasswordReset(@Body() dto: RequestAccountTokenDto): Promise<void> {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.password);
    clearSessionCookies(response);
  }

  private finishSession(response: Response, result: SessionResult): AuthTokenResponse {
    writeSessionCookies(response, result);
    // Compatibility field remains until all clients move to SessionResponse,
    // but the bearer token is never exposed to browser JavaScript.
    return { accessToken: '', user: result.user };
  }
}
