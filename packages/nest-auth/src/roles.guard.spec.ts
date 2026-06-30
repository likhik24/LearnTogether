import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, type AuthPrincipal } from '@learn-and-build/types';
import { RolesGuard } from './roles.guard';

function contextWithUser(user?: AuthPrincipal): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard (shared)', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser())).toBe(true);
  });

  it('allows when the user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = contextWithUser({
      sub: 'u-1',
      email: 'admin@example.com',
      role: Role.ADMIN,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when the user lacks the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = contextWithUser({
      sub: 'u-2',
      email: 'teacher@example.com',
      role: Role.TEACHER,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(contextWithUser())).toThrow(
      ForbiddenException,
    );
  });
});
