import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Role, type AuthTokenResponse } from '@learn-and-build/types';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthSession } from './auth-session.entity';
import { AccountToken, AccountTokenKind } from './account-token.entity';
import { AccountMailerService } from './account-mailer.service';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1_000;
const RESET_TTL_MS = 30 * 60 * 1_000;

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionResult extends AuthTokenResponse {
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    @InjectRepository(AccountToken)
    private readonly accountTokens: Repository<AccountToken>,
    private readonly mailer: AccountMailerService,
  ) {}

  async register(dto: RegisterDto, metadata: SessionMetadata = {}): Promise<SessionResult> {
    const email = normalizeEmail(dto.email);
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const role = dto.role === Role.TEACHER ? Role.TEACHER : Role.USER;
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create({
      email,
      passwordHash,
      displayName: dto.displayName.trim(),
      role,
    });
    const verificationToken = await this.createAccountToken(
      user.id,
      AccountTokenKind.EMAIL_VERIFICATION,
      VERIFY_TTL_MS,
    );
    void this.mailer
      .verification(user.email, user.displayName, verificationToken)
      .catch(() => undefined);
    return this.issueSession(user, metadata);
  }

  async login(dto: LoginDto, metadata: SessionMetadata = {}): Promise<SessionResult> {
    const user = await this.users.findByEmail(normalizeEmail(dto.email));
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueSession(user, metadata);
  }

  async becomeProvider(userId: string, metadata: SessionMetadata = {}): Promise<SessionResult> {
    const existing = await this.users.findById(userId);
    if (!existing) throw new UnauthorizedException('Session user no longer exists');
    if (existing.role === Role.ADMIN) {
      throw new ConflictException(
        'Administrator accounts cannot be converted to provider accounts',
      );
    }
    const provider =
      existing.role === Role.TEACHER
        ? existing
        : await this.users.setRole(existing.id, Role.TEACHER);
    return this.issueSession(provider, metadata);
  }

  issueTokenFor(user: User, metadata: SessionMetadata = {}): Promise<SessionResult> {
    return this.issueSession(user, metadata);
  }

  async refresh(rawRefreshToken: string, metadata: SessionMetadata = {}): Promise<SessionResult> {
    const refreshTokenHash = hashToken(rawRefreshToken);
    const session = await this.sessions.findOne({
      where: { refreshTokenHash, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!session) throw new UnauthorizedException('Session expired');
    const user = await this.users.findById(session.userId);
    if (!user) throw new UnauthorizedException('Session user no longer exists');
    session.revokedAt = new Date();
    await this.sessions.save(session);
    return this.issueSession(user, metadata);
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    const session = await this.sessions.findOne({
      where: { refreshTokenHash: hashToken(rawRefreshToken), revokedAt: IsNull() },
    });
    if (!session) return;
    session.revokedAt = new Date();
    await this.sessions.save(session);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.emailVerifiedAt) return;
    const token = await this.createAccountToken(
      user.id,
      AccountTokenKind.EMAIL_VERIFICATION,
      VERIFY_TTL_MS,
    );
    void this.mailer.verification(user.email, user.displayName, token).catch(() => undefined);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const token = await this.consumeAccountToken(rawToken, AccountTokenKind.EMAIL_VERIFICATION);
    await this.users.markEmailVerified(token.userId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user?.passwordHash) return;
    const token = await this.createAccountToken(
      user.id,
      AccountTokenKind.PASSWORD_RESET,
      RESET_TTL_MS,
    );
    void this.mailer.passwordReset(user.email, user.displayName, token).catch(() => undefined);
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const token = await this.consumeAccountToken(rawToken, AccountTokenKind.PASSWORD_RESET);
    await this.users.updatePassword(token.userId, await bcrypt.hash(password, 12));
    await this.sessions.update(
      { userId: token.userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueSession(user: User, metadata: SessionMetadata): Promise<SessionResult> {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        revokedAt: null,
        ipAddress: metadata.ipAddress?.slice(0, 100) ?? null,
        userAgent: metadata.userAgent?.slice(0, 1_000) ?? null,
      }),
    );
    return { accessToken, refreshToken, user: user.toPublic() };
  }

  private async createAccountToken(
    userId: string,
    kind: AccountTokenKind,
    ttlMs: number,
  ): Promise<string> {
    await this.accountTokens.update(
      { userId, kind, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
    const rawToken = randomBytes(32).toString('base64url');
    await this.accountTokens.save(
      this.accountTokens.create({
        userId,
        kind,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + ttlMs),
        consumedAt: null,
      }),
    );
    return rawToken;
  }

  private async consumeAccountToken(
    rawToken: string,
    kind: AccountTokenKind,
  ): Promise<AccountToken> {
    const token = await this.accountTokens.findOne({
      where: {
        tokenHash: hashToken(rawToken),
        kind,
        consumedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!token) throw new UnauthorizedException('This link is invalid or has expired');
    token.consumedAt = new Date();
    return this.accountTokens.save(token);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
