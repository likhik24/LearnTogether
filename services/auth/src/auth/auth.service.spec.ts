import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@learn-and-build/types';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { AuthSession } from './auth-session.entity';
import { AccountToken } from './account-token.entity';
import { AccountMailerService } from './account-mailer.service';
import type { Repository } from 'typeorm';

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  Object.assign(
    user,
    {
      id: 'u-1',
      email: 'teacher@example.com',
      displayName: 'Tess',
      role: Role.USER,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    },
    overrides,
  );
  return user;
}

describe('AuthService', () => {
  let users: jest.Mocked<
    Pick<
      UsersService,
      'findByEmail' | 'findById' | 'create' | 'markEmailVerified' | 'updatePassword'
    >
  >;
  let jwt: { sign: jest.Mock };
  let sessions: jest.Mocked<
    Pick<Repository<AuthSession>, 'create' | 'save' | 'findOne' | 'update'>
  >;
  let accountTokens: jest.Mocked<
    Pick<Repository<AccountToken>, 'create' | 'save' | 'findOne' | 'update'>
  >;
  let mailer: jest.Mocked<Pick<AccountMailerService, 'verification' | 'passwordReset'>>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      markEmailVerified: jest.fn(),
      updatePassword: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    sessions = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), update: jest.fn() };
    sessions.create.mockImplementation((value) => Object.assign(new AuthSession(), value));
    sessions.save.mockImplementation(async (value) => value as AuthSession);
    accountTokens = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), update: jest.fn() };
    accountTokens.create.mockImplementation((value) => Object.assign(new AccountToken(), value));
    accountTokens.save.mockImplementation(async (value) => value as AccountToken);
    mailer = {
      verification: jest.fn().mockResolvedValue(undefined),
      passwordReset: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuthService(
      users as unknown as UsersService,
      jwt as never,
      sessions as unknown as Repository<AuthSession>,
      accountTokens as unknown as Repository<AccountToken>,
      mailer as unknown as AccountMailerService,
    );
  });

  it('registers a new user and returns a token', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockImplementation(async (input) =>
      makeUser({
        email: input.email.toLowerCase(),
        role: input.role,
        passwordHash: input.passwordHash,
      }),
    );

    const result = await service.register({
      email: '  NEW@example.com  ',
      password: 'supersecret',
      displayName: '  New User  ',
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.email).toBe('new@example.com');
    expect(result.user.role).toBe(Role.USER);
    expect(users.create).toHaveBeenCalledTimes(1);
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', displayName: 'New User' }),
    );
    expect(result.refreshToken).toBeTruthy();
    expect(mailer.verification).toHaveBeenCalled();
  });

  it('allows self-signup as TEACHER but never as ADMIN', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockImplementation(async (input) => makeUser({ role: input.role }));

    const asAdmin = await service.register({
      email: 'a@example.com',
      password: 'supersecret',
      displayName: 'A',
      role: Role.ADMIN,
    });
    expect(asAdmin.user.role).toBe(Role.USER);

    const asTeacher = await service.register({
      email: 'b@example.com',
      password: 'supersecret',
      displayName: 'B',
      role: Role.TEACHER,
    });
    expect(asTeacher.user.role).toBe(Role.TEACHER);
  });

  it('rejects duplicate email registration', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    await expect(
      service.register({
        email: 'teacher@example.com',
        password: 'supersecret',
        displayName: 'Dup',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('supersecret', 10);
    users.findByEmail.mockResolvedValue(makeUser({ passwordHash }));

    const result = await service.login({
      email: '  TEACHER@example.com ',
      password: 'supersecret',
    });
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(users.findByEmail).toHaveBeenCalledWith('teacher@example.com');
  });

  it('rejects login with wrong password', async () => {
    const passwordHash = await bcrypt.hash('supersecret', 10);
    users.findByEmail.mockResolvedValue(makeUser({ passwordHash }));

    await expect(
      service.login({ email: 'teacher@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for unknown email', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ghost@example.com', password: 'whatever12' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates a valid refresh session and revokes the previous one', async () => {
    const session = Object.assign(new AuthSession(), { userId: 'u-1', revokedAt: null });
    sessions.findOne.mockResolvedValue(session);
    users.findById.mockResolvedValue(makeUser());

    const result = await service.refresh('opaque-refresh-token');

    expect(session.revokedAt).toBeInstanceOf(Date);
    expect(sessions.save).toHaveBeenCalledWith(session);
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe('opaque-refresh-token');
  });
});
