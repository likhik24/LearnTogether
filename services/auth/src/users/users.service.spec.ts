import { Repository } from 'typeorm';
import { AuthProvider, Role } from '@learn-and-build/types';
import { UsersService } from './users.service';
import { User } from './user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  const u = new User();
  Object.assign(
    u,
    {
      id: 'u-1',
      email: 'person@example.com',
      passwordHash: null,
      displayName: 'Person',
      role: Role.USER,
      provider: AuthProvider.LOCAL,
      providerSubject: null,
      createdAt: new Date(),
    },
    overrides,
  );
  return u;
}

describe('UsersService.findOrCreateOAuthUser', () => {
  let repo: jest.Mocked<Pick<Repository<User>, 'findOne' | 'save' | 'create'>>;
  let service: UsersService;

  beforeEach(() => {
    repo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
    repo.save.mockImplementation(async (u) => u as User);
    repo.create.mockImplementation((u) => makeUser(u as Partial<User>));
    service = new UsersService(repo as unknown as Repository<User>);
  });

  it('returns the already-linked user without creating a new one', async () => {
    const linked = makeUser({
      provider: AuthProvider.GOOGLE,
      providerSubject: 'g-sub',
    });
    repo.findOne.mockResolvedValueOnce(linked);

    const result = await service.findOrCreateOAuthUser({
      provider: AuthProvider.GOOGLE,
      providerSubject: 'g-sub',
      email: 'person@example.com',
      displayName: 'Person',
    });

    expect(result).toBe(linked);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('links an external identity to an existing local account by email', async () => {
    repo.findOne
      .mockResolvedValueOnce(null) // no provider match
      .mockResolvedValueOnce(makeUser({ provider: AuthProvider.LOCAL })); // email match

    const result = await service.findOrCreateOAuthUser({
      provider: AuthProvider.GOOGLE,
      providerSubject: 'g-sub',
      email: 'person@example.com',
      displayName: 'Person',
    });

    expect(result.provider).toBe(AuthProvider.GOOGLE);
    expect(result.providerSubject).toBe('g-sub');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates a new passwordless user on first external sign-in', async () => {
    repo.findOne.mockResolvedValue(null);

    const result = await service.findOrCreateOAuthUser({
      provider: AuthProvider.AWS,
      providerSubject: 'a-sub',
      email: 'NEW@example.com',
      displayName: 'New',
    });

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe(AuthProvider.AWS);
    expect(result.passwordHash).toBeNull();
  });

  it('creates a provider-role account for a provider OIDC flow', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.findOrCreateOAuthUser({
      provider: AuthProvider.GOOGLE,
      providerSubject: 'provider-sub',
      email: 'provider@example.com',
      displayName: 'Provider',
      role: Role.TEACHER,
    });
    expect(result.role).toBe(Role.TEACHER);
  });

  it('moves an existing customer into the moderated provider flow when requested', async () => {
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser({ role: Role.USER }));
    const result = await service.findOrCreateOAuthUser({
      provider: AuthProvider.GOOGLE,
      providerSubject: 'provider-sub',
      email: 'person@example.com',
      displayName: 'Person',
      role: Role.TEACHER,
    });
    expect(result.role).toBe(Role.TEACHER);
  });
});
