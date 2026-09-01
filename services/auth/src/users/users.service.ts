import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider, Role } from '@learn-and-build/types';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  findByProvider(provider: AuthProvider, providerSubject: string): Promise<User | null> {
    return this.users.findOne({ where: { provider, providerSubject } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role?: Role;
    emailVerified?: boolean;
    termsAccepted?: boolean;
  }): Promise<User> {
    const user = this.users.create({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      displayName: input.displayName.trim(),
      role: input.role ?? Role.USER,
      provider: AuthProvider.LOCAL,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      termsAcceptedAt: input.termsAccepted ? new Date() : null,
    });
    return this.users.save(user);
  }

  /**
   * Resolves the local user for an external OIDC identity, creating one on
   * first sign-in. If a local account already exists with the same email, the
   * external identity is linked to it rather than creating a duplicate.
   */
  async findOrCreateOAuthUser(input: {
    provider: AuthProvider;
    providerSubject: string;
    email: string;
    displayName: string;
    role?: Role;
  }): Promise<User> {
    const linked = await this.findByProvider(input.provider, input.providerSubject);
    if (linked) {
      return linked;
    }

    const byEmail = await this.findByEmail(input.email);
    if (byEmail) {
      byEmail.provider = input.provider;
      byEmail.providerSubject = input.providerSubject;
      byEmail.emailVerifiedAt ??= new Date();
      // Provider onboarding is publicly available, but its profile and classes
      // still require moderation. Let an existing customer intentionally enter
      // that flow without creating a second account for the same email.
      if (input.role === Role.TEACHER && byEmail.role === Role.USER) {
        byEmail.role = Role.TEACHER;
      }
      return this.users.save(byEmail);
    }

    const user = this.users.create({
      email: normalizeEmail(input.email),
      displayName: input.displayName.trim(),
      role: input.role ?? Role.USER,
      provider: input.provider,
      providerSubject: input.providerSubject,
      passwordHash: null,
      emailVerifiedAt: new Date(),
    });
    return this.users.save(user);
  }

  async setRole(id: string, role: Role): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    user.role = role;
    return this.users.save(user);
  }

  async markEmailVerified(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    user.emailVerifiedAt = new Date();
    return this.users.save(user);
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    user.passwordHash = passwordHash;
    return this.users.save(user);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
